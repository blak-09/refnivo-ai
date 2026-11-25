import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { createCampaign, transitionCampaign } from "@/lib/services/campaigns";
import { joinCampaign } from "@/lib/services/partners";
import { contestConversion, ConversionError, recordOrder, rejectConversion, resolveContest, reverseConversion, verifyConversion } from "@/lib/services/conversions";
import { eligibleItems, heldItems } from "@/lib/services/payouts";
import { moderateCampaign } from "@/lib/services/admin";
import { REMINDER_TITLE, sendPendingReminders } from "@/lib/services/reminders";
import { createUser } from "@/lib/services/users";
import { campaignValues, makeCreator, makeOwnerWithBrand, uniq } from "../helpers";

/** docs/AUDIT.md fixes: W2 (late orders), W3 (hold, refund window, contests), W5 (reminders), W6 (review). */

const DAY = 24 * 60 * 60 * 1000;

async function setup(opts: { holdDays?: number; endInDays?: number } = {}) {
  const owner = await makeOwnerWithBrand(`Audit ${uniq("b")}`);
  const now = new Date();
  const campaign = await createCampaign(
    owner.brand.id,
    owner.brand.name,
    owner.user.id,
    campaignValues(owner.product.id, {
      name: `Audit ${uniq("c")}`,
      requiresApproval: false,
      creatorCommissionType: "FIXED_AMOUNT",
      creatorCommissionValue: 600,
      holdDays: opts.holdDays ?? 0,
      endDate: opts.endInDays !== undefined ? new Date(now.getTime() + opts.endInDays * DAY).toISOString().slice(0, 10) : "",
    }),
  );
  await transitionCampaign(owner.brand.id, owner.user.id, campaign.id, "PUBLISH", { confirmed: true });
  const creator = await makeCreator();
  const { code } = await joinCampaign({ id: creator.id, name: creator.name, role: "CREATOR" }, campaign.id);
  return { owner, campaign, creator, code: code!, now };
}

async function makeAdmin() {
  const admin = await createUser({ name: "Admin", email: `${uniq("admin")}@test.local`, password: "Password1", role: "ADMIN" });
  await prisma.user.update({ where: { id: admin.id }, data: { status: "APPROVED" } });
  return admin;
}

afterAll(() => prisma.$disconnect());

describe("W2: orders placed while a campaign ran can be recorded after it ends or pauses", () => {
  it("ended campaign: an order dated inside the run is accepted; one dated after the end is refused; the late window closes", async () => {
    const { owner, campaign, code } = await setup({ endInDays: 3 });
    const end = (await prisma.campaign.findUniqueOrThrow({ where: { id: campaign.id } })).endDate!;
    const later = new Date(end.getTime() + 2 * DAY); // campaign is over

    const inside = await recordOrder(owner.brand.id, owner.user.id, { code, orderReference: uniq("ORD"), amountMinor: 100_000, orderedAt: new Date(end.getTime() - DAY) }, later);
    expect(inside.conversion.orderedAt?.getTime()).toBe(end.getTime() - DAY);

    await expect(
      recordOrder(owner.brand.id, owner.user.id, { code, orderReference: uniq("ORD"), amountMinor: 100_000, orderedAt: new Date(end.getTime() + DAY) }, later),
    ).rejects.toThrow(/after the campaign stopped/);

    const tooLate = new Date(end.getTime() + 31 * DAY);
    await expect(
      recordOrder(owner.brand.id, owner.user.id, { code, orderReference: uniq("ORD"), amountMinor: 100_000, orderedAt: new Date(end.getTime() - DAY) }, tooLate),
    ).rejects.toThrow(/window has closed/);
  });

  it("paused campaign: an order from before the pause is accepted; today's order and a future date are refused", async () => {
    const { owner, campaign, code, now } = await setup();
    await transitionCampaign(owner.brand.id, owner.user.id, campaign.id, "PAUSE");
    const paused = await prisma.campaign.findUniqueOrThrow({ where: { id: campaign.id } });
    expect(paused.stoppedAt).not.toBeNull();

    const ok = await recordOrder(owner.brand.id, owner.user.id, { code, orderReference: uniq("ORD"), amountMinor: 100_000, orderedAt: new Date(now.getTime() - 60_000) });
    expect(ok.referral.status).toBe("PURCHASED");
    await expect(recordOrder(owner.brand.id, owner.user.id, { code, orderReference: uniq("ORD"), amountMinor: 100_000 }, new Date(Date.now() + 60_000))).rejects.toThrow(
      /after the campaign stopped/,
    );
    await expect(
      recordOrder(owner.brand.id, owner.user.id, { code, orderReference: uniq("ORD"), amountMinor: 100_000, orderedAt: new Date(Date.now() + 2 * DAY) }),
    ).rejects.toThrow(/future/);

    // Resuming clears the stop time; orders are taken normally again.
    await transitionCampaign(owner.brand.id, owner.user.id, campaign.id, "RESUME");
    expect((await prisma.campaign.findUniqueOrThrow({ where: { id: campaign.id } })).stoppedAt).toBeNull();
    await recordOrder(owner.brand.id, owner.user.id, { code, orderReference: uniq("ORD"), amountMinor: 100_000 });
  });

  it("a calendar-day order date (date input) counts if any moment of that day was inside the campaign", async () => {
    const { owner, code } = await setup();
    const today = new Date(new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10) + "T00:00:00Z");
    const order = await recordOrder(owner.brand.id, owner.user.id, { code, orderReference: uniq("ORD"), amountMinor: 100_000, orderedAt: today, orderedOnDay: true });
    expect(order.conversion.orderedAt).not.toBeNull();
    expect(order.conversion.orderedAt!.getTime()).toBeLessThanOrEqual(Date.now());
  });
});

describe("W3: refund window, payout hold and partner contests", () => {
  it("verified commissions wait for the hold before they can be paid; the brand can refund only during the hold", async () => {
    const { owner, creator, code } = await setup({ holdDays: 14 });
    const order = await recordOrder(owner.brand.id, owner.user.id, { code, orderReference: uniq("ORD"), amountMinor: 250_000 });
    await verifyConversion(owner.brand.id, owner.user.id, order.referral.id);
    const commission = await prisma.commission.findFirstOrThrow({ where: { referralId: order.referral.id } });
    expect(commission.status).toBe("APPROVED");
    expect(commission.payableAt).not.toBeNull();

    expect(await eligibleItems(creator.id, "COMMISSION")).toHaveLength(0);
    expect((await heldItems(creator.id, "COMMISSION")).amount).toBe(60_000);
    const afterHold = new Date(commission.payableAt!.getTime() + 1000);
    expect(await eligibleItems(creator.id, "COMMISSION", prisma, afterHold)).toHaveLength(1);

    // After the hold the brand can no longer refund.
    await expect(reverseConversion(owner.brand.id, owner.user.id, order.referral.id, "returned", afterHold)).rejects.toThrow(/refund window/);
    // During the hold it can (and that is audited in the same transaction).
    await reverseConversion(owner.brand.id, owner.user.id, order.referral.id, "returned");
    expect(await prisma.auditLog.count({ where: { action: "CONVERSION_REVERSED", entityId: order.referral.id } })).toBe(1);
  });

  it("a rejected order can be contested once; upholding sends it back to the brand as pending", async () => {
    const { owner, creator, code } = await setup();
    const admin = await makeAdmin();
    const order = await recordOrder(owner.brand.id, owner.user.id, { code, orderReference: uniq("ORD"), amountMinor: 250_000 });
    await rejectConversion(owner.brand.id, owner.user.id, order.referral.id, "not in our store");

    await expect(contestConversion(creator.id, order.referral.id, "short")).rejects.toBeInstanceOf(ConversionError);
    const stranger = await makeCreator();
    await expect(contestConversion(stranger.id, order.referral.id, "this is not my order at all")).rejects.toThrow(/not found/i);

    await contestConversion(creator.id, order.referral.id, "The buyer sent me the delivered order screenshot.");
    await expect(contestConversion(creator.id, order.referral.id, "Trying to contest a second time")).rejects.toThrow(/already contested/);
    expect(await prisma.notification.count({ where: { userId: admin.id, title: { startsWith: "Order contested" } } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { action: "CONVERSION_CONTESTED", entityId: order.referral.id } })).toBe(1);

    await resolveContest(admin.id, order.referral.id, "UPHELD", "Order exists in the store export.");
    const after = await prisma.referral.findUniqueOrThrow({ where: { id: order.referral.id }, include: { commissions: true, conversion: true } });
    expect(after.status).toBe("PURCHASED");
    expect(after.commissions[0].status).toBe("PENDING");
    expect(after.conversion?.contestOutcome).toBe("UPHELD");
    await expect(resolveContest(admin.id, order.referral.id, "DISMISSED", "again")).rejects.toThrow(/already been resolved/);
    expect(await prisma.auditLog.count({ where: { action: "CONTEST_RESOLVED", entityId: order.referral.id } })).toBe(1);
  });

  it("upholding a contested refund reinstates the order; the brand cannot refund it again", async () => {
    const { owner, creator, code } = await setup({ holdDays: 14 });
    const admin = await makeAdmin();
    const order = await recordOrder(owner.brand.id, owner.user.id, { code, orderReference: uniq("ORD"), amountMinor: 250_000 });
    await verifyConversion(owner.brand.id, owner.user.id, order.referral.id);
    await reverseConversion(owner.brand.id, owner.user.id, order.referral.id, "customer returned it");
    await contestConversion(creator.id, order.referral.id, "The buyer kept the product; no return was made.");
    await resolveContest(admin.id, order.referral.id, "UPHELD", "Brand could not show a return.");
    const after = await prisma.referral.findUniqueOrThrow({ where: { id: order.referral.id }, include: { commissions: true, conversion: true } });
    expect(after.status).toBe("VERIFIED");
    expect(after.conversion?.reversedAt).toBeNull();
    expect(after.commissions[0].status).toBe("APPROVED");
    expect(await eligibleItems(creator.id, "COMMISSION")).toHaveLength(1);
    await expect(reverseConversion(owner.brand.id, owner.user.id, order.referral.id, "again")).rejects.toThrow(/contest/);
  });
});

describe("W6: a brand's first campaign is reviewed before it goes live", () => {
  it("first publish → PENDING_REVIEW (admins notified); approve → live; the next campaign publishes directly", async () => {
    const admin = await makeAdmin();
    const owner = await makeOwnerWithBrand(`Review ${uniq("b")}`);
    const first = await createCampaign(owner.brand.id, owner.brand.name, owner.user.id, campaignValues(owner.product.id, { name: `First ${uniq("c")}` }));
    const pending = await transitionCampaign(owner.brand.id, owner.user.id, first.id, "PUBLISH", { confirmed: true, reviewMode: "first" });
    expect(pending.status).toBe("PENDING_REVIEW");
    expect(pending.publishedAt).toBeNull();
    expect(await prisma.notification.count({ where: { userId: admin.id, title: { contains: "Campaign to review" } } })).toBeGreaterThanOrEqual(1);
    // The brand cannot self-publish while it is in review.
    await expect(transitionCampaign(owner.brand.id, owner.user.id, first.id, "PUBLISH", { confirmed: true, reviewMode: "first" })).rejects.toThrow(/cannot be published/);

    await moderateCampaign(admin.id, first.id, "APPROVE", "ok");
    const live = await prisma.campaign.findUniqueOrThrow({ where: { id: first.id } });
    expect(live.status).toBe("ACTIVE");
    expect(live.publishedAt).not.toBeNull();

    const second = await createCampaign(owner.brand.id, owner.brand.name, owner.user.id, campaignValues(owner.product.id, { name: `Second ${uniq("c")}` }));
    expect((await transitionCampaign(owner.brand.id, owner.user.id, second.id, "PUBLISH", { confirmed: true, reviewMode: "first" })).status).toBe("ACTIVE");
  });

  it("send back → draft with the reason; mode 'all' reviews every campaign; 'off' never", async () => {
    const admin = await makeAdmin();
    const owner = await makeOwnerWithBrand(`Review ${uniq("b")}`);
    const c = await createCampaign(owner.brand.id, owner.brand.name, owner.user.id, campaignValues(owner.product.id, { name: `C ${uniq("c")}` }));
    await transitionCampaign(owner.brand.id, owner.user.id, c.id, "PUBLISH", { confirmed: true, reviewMode: "all" });
    await moderateCampaign(admin.id, c.id, "REJECT", "Land listings are not allowed.");
    expect((await prisma.campaign.findUniqueOrThrow({ where: { id: c.id } })).status).toBe("DRAFT");
    const n = await prisma.notification.findFirstOrThrow({ where: { userId: owner.user.id, title: { contains: "needs changes" } } });
    expect(n.body).toContain("Land listings are not allowed.");
    expect((await transitionCampaign(owner.brand.id, owner.user.id, c.id, "PUBLISH", { confirmed: true, reviewMode: "off" })).status).toBe("ACTIVE");
  });
});

describe("W5: brand reminders for undecided orders", () => {
  it("sends one digest when an order turns 3 days old, and never twice on the same day", async () => {
    const { owner, code } = await setup();
    const order = await recordOrder(owner.brand.id, owner.user.id, { code, orderReference: uniq("ORD"), amountMinor: 100_000 });
    await prisma.conversion.update({ where: { id: order.conversion.id }, data: { createdAt: new Date(Date.now() - 3 * DAY - 60_000) } });
    await sendPendingReminders();
    await sendPendingReminders();
    const reminders = await prisma.notification.findMany({ where: { userId: owner.user.id, title: REMINDER_TITLE } });
    expect(reminders).toHaveLength(1);
    expect(reminders[0].body).toContain("1 recorded order");
  });
});
