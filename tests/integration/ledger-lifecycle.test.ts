import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { createCampaign, transitionCampaign } from "@/lib/services/campaigns";
import { joinCampaign, removePartner, withdrawApplication, PartnerError } from "@/lib/services/partners";
import { ConversionError, recordOrder, reverseConversion, verifyConversion } from "@/lib/services/conversions";
import { canReviewPayout, PayoutError, payoutSummary, requestPayout, reviewPayout } from "@/lib/services/payouts";
import { resolveReferralCode } from "@/lib/services/tracking";
import { createUser } from "@/lib/services/users";
import { campaignValues, makeCreator, makeOwnerWithBrand, uniq } from "../helpers";

/**
 * End-to-end ledger lifecycle: order → verify → payout request → admin review →
 * settled, plus refund reversal and partner removal / withdrawal. Everything
 * runs against the local test database.
 */

async function liveCampaign(opts: { requiresApproval?: boolean; commissionRupees?: number } = {}) {
  const owner = await makeOwnerWithBrand(`Ledger ${uniq("b")}`);
  const campaign = await createCampaign(
    owner.brand.id,
    owner.brand.name,
    owner.user.id,
    campaignValues(owner.product.id, {
      name: `Ledger ${uniq("c")}`,
      requiresApproval: opts.requiresApproval ?? false,
      creatorCommissionType: "FIXED_AMOUNT",
      creatorCommissionValue: opts.commissionRupees ?? 600, // ₹600 = 60 000 paise ≥ default payout minimum (₹500)
    }),
  );
  await transitionCampaign(owner.brand.id, owner.user.id, campaign.id, "PUBLISH", { confirmed: true });
  return { owner, campaign };
}

async function makeAdmin() {
  const admin = await createUser({ name: "Admin", email: `${uniq("admin")}@test.local`, password: "Password1", role: "ADMIN" });
  await prisma.user.update({ where: { id: admin.id }, data: { status: "APPROVED" } });
  return admin;
}

afterAll(() => prisma.$disconnect());

describe("payout workflow (manual settlement)", () => {
  it("verified commission → request → approve → mark paid sets the commission PAID; nothing is paid before that", async () => {
    const { owner, campaign } = await liveCampaign();
    const creator = await makeCreator();
    const { code } = await joinCampaign({ id: creator.id, name: creator.name, role: "CREATOR" }, campaign.id);
    const order = await recordOrder(owner.brand.id, owner.user.id, { code: code!, orderReference: uniq("ORD"), amountMinor: 250_000 });

    // Nothing eligible before verification.
    let summary = await payoutSummary(creator.id, "COMMISSION");
    expect(summary.eligible).toBe(0);
    expect(summary.canRequest).toBe(false);
    await expect(requestPayout(creator.id, "COMMISSION", "UPI")).rejects.toBeInstanceOf(PayoutError);

    await verifyConversion(owner.brand.id, owner.user.id, order.referral.id);
    summary = await payoutSummary(creator.id, "COMMISSION");
    expect(summary.eligible).toBe(60_000);
    expect(summary.canRequest).toBe(true);

    const admin = await makeAdmin(); // exists before the request so it receives the PAYOUT_REQUESTED notification
    const request = await requestPayout(creator.id, "COMMISSION", "UPI");
    expect(request.status).toBe("REQUESTED");
    expect(request.amount).toBe(60_000);
    // A second concurrent request is refused, and the commission is no longer "eligible".
    await expect(requestPayout(creator.id, "COMMISSION", "UPI")).rejects.toThrow(/in progress/);
    expect((await payoutSummary(creator.id, "COMMISSION")).eligible).toBe(0);
    // Admins were notified.
    expect(await prisma.notification.count({ where: { userId: admin.id, type: "PAYOUT_REQUESTED" } })).toBe(1);

    // Commission is still only APPROVED — approval of the request does not pay.
    await reviewPayout(admin.id, request.id, "APPROVE", { note: "looks good" });
    expect((await prisma.commission.findFirstOrThrow({ where: { referralId: order.referral.id } })).status).toBe("APPROVED");

    // Marking paid without an external reference is refused.
    await expect(reviewPayout(admin.id, request.id, "MARK_PAID", {})).rejects.toThrow(/reference/i);

    await reviewPayout(admin.id, request.id, "MARK_PAID", { reference: "UPI-TXN-123" });
    const paid = await prisma.payoutRequest.findUniqueOrThrow({ where: { id: request.id } });
    expect(paid.status).toBe("PAID");
    expect(paid.payoutReference).toBe("UPI-TXN-123");
    expect(paid.processedById).toBe(admin.id);
    expect((await prisma.commission.findFirstOrThrow({ where: { referralId: order.referral.id } })).status).toBe("PAID");
    // Terminal: cannot be re-reviewed.
    expect(canReviewPayout("PAID", "MARK_PAID")).toBe(false);
    await expect(reviewPayout(admin.id, request.id, "REJECT", { note: "x" })).rejects.toBeInstanceOf(PayoutError);
    // Requester was notified and the decision audited with the admin as actor.
    expect(await prisma.notification.count({ where: { userId: creator.id, type: "PAYOUT_UPDATED" } })).toBeGreaterThanOrEqual(2);
    const audit = await prisma.auditLog.findFirst({ where: { action: "PAYOUT_MARK_PAID", entityId: request.id } });
    expect(audit?.userId).toBe(admin.id);
    expect(JSON.stringify(audit?.metadata)).not.toContain("UPI-TXN-123"); // reference lives on the request, not in the log
  });

  it("declining a request releases the commissions so they can be requested again", async () => {
    const { owner, campaign } = await liveCampaign();
    const creator = await makeCreator();
    const { code } = await joinCampaign({ id: creator.id, name: creator.name, role: "CREATOR" }, campaign.id);
    const order = await recordOrder(owner.brand.id, owner.user.id, { code: code!, orderReference: uniq("ORD"), amountMinor: 250_000 });
    await verifyConversion(owner.brand.id, owner.user.id, order.referral.id);
    const request = await requestPayout(creator.id, "COMMISSION", "Bank transfer");
    const admin = await makeAdmin();
    await expect(reviewPayout(admin.id, request.id, "REJECT", {})).rejects.toThrow(/reason/i);
    await reviewPayout(admin.id, request.id, "REJECT", { note: "details incomplete" });
    expect(await prisma.payoutItem.count({ where: { payoutRequestId: request.id } })).toBe(0);
    expect((await prisma.commission.findFirstOrThrow({ where: { referralId: order.referral.id } })).status).toBe("APPROVED");
    const again = await payoutSummary(creator.id, "COMMISSION");
    expect(again.canRequest).toBe(true);
  });

  it("customers redeem rewards through the same workflow (kind REWARD → REDEEMED)", async () => {
    const { owner, campaign } = await liveCampaign();
    await prisma.campaign.update({ where: { id: campaign.id }, data: { customerRewardValue: 60_000 } });
    const customer = await createUser({ name: "Cust", email: `${uniq("cust")}@test.local`, password: "Password1", role: "CUSTOMER" });
    const { code } = await joinCampaign({ id: customer.id, name: customer.name, role: "CUSTOMER" }, campaign.id);
    const order = await recordOrder(owner.brand.id, owner.user.id, { code: code!, orderReference: uniq("ORD"), amountMinor: 250_000 });
    await verifyConversion(owner.brand.id, owner.user.id, order.referral.id);
    const request = await requestPayout(customer.id, "REWARD", "Brand voucher");
    const admin = await makeAdmin();
    await reviewPayout(admin.id, request.id, "APPROVE");
    await reviewPayout(admin.id, request.id, "MARK_PAID", { reference: "VOUCHER-9" });
    expect((await prisma.reward.findFirstOrThrow({ where: { referralId: order.referral.id } })).status).toBe("REDEEMED");
  });
});

describe("refund / reversal", () => {
  it("reverses approved ledger entries, marks the referral REFUNDED, frees campaign budget and notifies the partner", async () => {
    const { owner, campaign } = await liveCampaign();
    await prisma.campaign.update({ where: { id: campaign.id }, data: { budget: 60_000 } }); // room for exactly one commission
    const creator = await makeCreator();
    const { code } = await joinCampaign({ id: creator.id, name: creator.name, role: "CREATOR" }, campaign.id);
    const o1 = await recordOrder(owner.brand.id, owner.user.id, { code: code!, orderReference: uniq("ORD"), amountMinor: 250_000 });
    const o2 = await recordOrder(owner.brand.id, owner.user.id, { code: code!, orderReference: uniq("ORD"), amountMinor: 250_000 });
    await verifyConversion(owner.brand.id, owner.user.id, o1.referral.id);
    await expect(verifyConversion(owner.brand.id, owner.user.id, o2.referral.id)).rejects.toThrow(/budget/i);

    // Only VERIFIED orders can be refunded.
    await expect(reverseConversion(owner.brand.id, owner.user.id, o2.referral.id, "nope")).rejects.toBeInstanceOf(ConversionError);

    const result = await reverseConversion(owner.brand.id, owner.user.id, o1.referral.id, "order returned");
    expect(result.reversedAmount).toBe(60_000);
    expect(result.alreadySettled).toBe(false);
    const referral = await prisma.referral.findUniqueOrThrow({ where: { id: o1.referral.id }, include: { conversion: true, commissions: true } });
    expect(referral.status).toBe("REFUNDED");
    expect(referral.conversion?.reversedAt).not.toBeNull();
    expect(referral.conversion?.reversalReason).toBe("order returned");
    expect(referral.commissions[0].status).toBe("REVERSED");
    // Idempotent / cannot reverse twice.
    await expect(reverseConversion(owner.brand.id, owner.user.id, o1.referral.id, "again")).rejects.toThrow(/already|Only verified/);
    // Budget was freed: the second order can now be verified.
    await verifyConversion(owner.brand.id, owner.user.id, o2.referral.id);
    expect(await prisma.notification.count({ where: { userId: creator.id, type: "CONVERSION_REVERSED" } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { action: "CONVERSION_REVERSED", entityId: o1.referral.id } })).toBe(1);
  });

  it("a reversed commission is excluded from payout eligibility; a paid one is flagged as already settled", async () => {
    const { owner, campaign } = await liveCampaign();
    const creator = await makeCreator();
    const { code } = await joinCampaign({ id: creator.id, name: creator.name, role: "CREATOR" }, campaign.id);
    const order = await recordOrder(owner.brand.id, owner.user.id, { code: code!, orderReference: uniq("ORD"), amountMinor: 250_000 });
    await verifyConversion(owner.brand.id, owner.user.id, order.referral.id);
    const request = await requestPayout(creator.id, "COMMISSION", "UPI");
    const admin = await makeAdmin();
    await reviewPayout(admin.id, request.id, "APPROVE");
    await reviewPayout(admin.id, request.id, "MARK_PAID", { reference: "TXN-1" });
    const result = await reverseConversion(owner.brand.id, owner.user.id, order.referral.id, "chargeback");
    expect(result.alreadySettled).toBe(true);
    expect((await prisma.commission.findFirstOrThrow({ where: { referralId: order.referral.id } })).status).toBe("REVERSED");
    expect((await payoutSummary(creator.id, "COMMISSION")).eligible).toBe(0);
  });

  it("another brand cannot reverse the order", async () => {
    const { owner, campaign } = await liveCampaign();
    const creator = await makeCreator();
    const { code } = await joinCampaign({ id: creator.id, name: creator.name, role: "CREATOR" }, campaign.id);
    const order = await recordOrder(owner.brand.id, owner.user.id, { code: code!, orderReference: uniq("ORD"), amountMinor: 250_000 });
    await verifyConversion(owner.brand.id, owner.user.id, order.referral.id);
    const other = await makeOwnerWithBrand("Other");
    await expect(reverseConversion(other.brand.id, other.user.id, order.referral.id, "x")).rejects.toThrow(/not found/i);
  });
});

describe("partner lifecycle: withdraw and remove", () => {
  it("a creator can withdraw a pending application and apply again; approved ones cannot be withdrawn", async () => {
    const { campaign } = await liveCampaign({ requiresApproval: true });
    const creator = await makeCreator();
    const first = await joinCampaign({ id: creator.id, name: creator.name, role: "CREATOR" }, campaign.id, "hi");
    expect(first.status).toBe("PENDING");
    const app = await prisma.partnerApplication.findUniqueOrThrow({ where: { campaignId_userId: { campaignId: campaign.id, userId: creator.id } } });

    const other = await makeCreator();
    await expect(withdrawApplication(other.id, app.id)).rejects.toThrow(/not found/i); // IDOR: not theirs

    await withdrawApplication(creator.id, app.id);
    expect((await prisma.partnerApplication.findUniqueOrThrow({ where: { id: app.id } })).status).toBe("WITHDRAWN");
    await expect(withdrawApplication(creator.id, app.id)).rejects.toThrow(/pending/i);

    const again = await joinCampaign({ id: creator.id, name: creator.name, role: "CREATOR" }, campaign.id);
    expect(again.status).toBe("PENDING");
  });

  it("a brand removing an approved partner disables the link so it stops resolving; the partner cannot rejoin", async () => {
    const { owner, campaign } = await liveCampaign();
    const creator = await makeCreator();
    const { code } = await joinCampaign({ id: creator.id, name: creator.name, role: "CREATOR" }, campaign.id);
    const app = await prisma.partnerApplication.findUniqueOrThrow({ where: { campaignId_userId: { campaignId: campaign.id, userId: creator.id } } });
    expect((await resolveReferralCode(code!)).ok).toBe(true);

    const stranger = await makeOwnerWithBrand("Stranger");
    await expect(removePartner(stranger.brand.id, stranger.user.id, app.id)).rejects.toBeInstanceOf(PartnerError);

    await removePartner(owner.brand.id, owner.user.id, app.id, "campaign full");
    const resolved = await resolveReferralCode(code!);
    expect(resolved.ok).toBe(false);
    if (!resolved.ok) expect(resolved.reason).toBe("DISABLED");
    expect((await prisma.partnerApplication.findUniqueOrThrow({ where: { id: app.id } })).status).toBe("REMOVED");
    await expect(joinCampaign({ id: creator.id, name: creator.name, role: "CREATOR" }, campaign.id)).rejects.toThrow(/removed/i);
    expect(await prisma.notification.count({ where: { userId: creator.id, type: "PARTNER_REMOVED" } })).toBe(1);
    // Orders through a disabled link are refused.
    await expect(recordOrder(owner.brand.id, owner.user.id, { code: code!, orderReference: uniq("ORD"), amountMinor: 1000 })).rejects.toThrow(/disabled/i);
  });
});

describe("payout reconciliation (PAY-01) and request race (PAY-02)", () => {
  it("a refund AFTER the payout request trims the request to what is still owed; MARK_PAID pays only that", async () => {
    const { owner, campaign } = await liveCampaign();
    const creator = await makeCreator();
    const admin = await makeAdmin();
    const { code } = await joinCampaign({ id: creator.id, name: creator.name, role: "CREATOR" }, campaign.id);
    const a = await recordOrder(owner.brand.id, owner.user.id, { code: code!, orderReference: uniq("ORD"), amountMinor: 100_000 });
    const b = await recordOrder(owner.brand.id, owner.user.id, { code: code!, orderReference: uniq("ORD"), amountMinor: 100_000 });
    await verifyConversion(owner.brand.id, owner.user.id, a.referral.id);
    await verifyConversion(owner.brand.id, owner.user.id, b.referral.id);

    const request = await requestPayout(creator.id, "COMMISSION", "UPI");
    expect(request.amount).toBe(120_000); // 2 × ₹600

    // Order A is refunded while the request is open → admins are told.
    await reverseConversion(owner.brand.id, owner.user.id, a.referral.id, "returned");
    const heads = await prisma.notification.findMany({ where: { userId: admin.id, title: { contains: "refund touched" } } });
    expect(heads).toHaveLength(1);

    const approved = await reviewPayout(admin.id, request.id, "APPROVE", { note: "ok" });
    expect(approved.amount).toBe(60_000);
    expect(await prisma.payoutItem.count({ where: { payoutRequestId: request.id } })).toBe(1);

    const paid = await reviewPayout(admin.id, request.id, "MARK_PAID", { reference: "UPI-1" });
    expect(paid.amount).toBe(60_000);
    const rows = await prisma.commission.findMany({ where: { creatorId: creator.id }, select: { referralId: true, status: true } });
    expect(rows.find((r) => r.referralId === a.referral.id)?.status).toBe("REVERSED");
    expect(rows.find((r) => r.referralId === b.referral.id)?.status).toBe("PAID");

    const audit = await prisma.auditLog.findFirst({ where: { action: "PAYOUT_APPROVE", entityId: request.id } });
    expect(JSON.stringify(audit?.metadata)).toContain('"droppedAmount":60000');
    const note = await prisma.notification.findFirst({ where: { userId: creator.id, title: { contains: "approved" } } });
    expect(note?.body).toMatch(/reversed by a refund/);
  });

  it("refuses to approve a request in which every entry was reversed", async () => {
    const { owner, campaign } = await liveCampaign();
    const creator = await makeCreator();
    const admin = await makeAdmin();
    const { code } = await joinCampaign({ id: creator.id, name: creator.name, role: "CREATOR" }, campaign.id);
    const a = await recordOrder(owner.brand.id, owner.user.id, { code: code!, orderReference: uniq("ORD"), amountMinor: 100_000 });
    await verifyConversion(owner.brand.id, owner.user.id, a.referral.id);
    const request = await requestPayout(creator.id, "COMMISSION", "UPI");
    await reverseConversion(owner.brand.id, owner.user.id, a.referral.id, "returned");
    await expect(reviewPayout(admin.id, request.id, "APPROVE", { note: "ok" })).rejects.toThrow(/nothing is owed/i);
    // Rejecting still works and releases the (now reversed) row.
    await reviewPayout(admin.id, request.id, "REJECT", { note: "refunded" });
    expect((await prisma.payoutRequest.findUniqueOrThrow({ where: { id: request.id } })).status).toBe("REJECTED");
  });

  it("two simultaneous payout requests: exactly one is created, the other gets a clear error", async () => {
    const { owner, campaign } = await liveCampaign();
    const creator = await makeCreator();
    const { code } = await joinCampaign({ id: creator.id, name: creator.name, role: "CREATOR" }, campaign.id);
    const a = await recordOrder(owner.brand.id, owner.user.id, { code: code!, orderReference: uniq("ORD"), amountMinor: 100_000 });
    await verifyConversion(owner.brand.id, owner.user.id, a.referral.id);

    const results = await Promise.allSettled([requestPayout(creator.id, "COMMISSION", "UPI"), requestPayout(creator.id, "COMMISSION", "UPI")]);
    const ok = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(ok).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect(failed[0].reason).toBeInstanceOf(PayoutError);
    expect(await prisma.payoutRequest.count({ where: { userId: creator.id } })).toBe(1);
  });
});
