import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { createCampaign, transitionCampaign } from "@/lib/services/campaigns";
import { ConversionError, recordOrder } from "@/lib/services/conversions";
import { confirmOrderClaim, maskContact, OrderClaimError, orderReferenceKey, rejectOrderClaim, submitOrderClaim } from "@/lib/services/order-claims";
import { joinCampaign } from "@/lib/services/partners";
import { campaignValues, makeCreator, makeCustomer, makeOwnerWithBrand, uniq } from "../helpers";

/**
 * Order handshake: customer submits an order number → brand confirms (records +
 * verifies atomically) or rejects. Fraud guards mirror the manual record path.
 */
async function setup(overrides: Record<string, unknown> = {}) {
  const owner = await makeOwnerWithBrand(`Claims ${uniq("b")}`);
  const campaign = await createCampaign(
    owner.brand.id,
    owner.brand.name,
    owner.user.id,
    campaignValues(owner.product.id, { name: `Claims ${uniq("c")}`, requiresApproval: false, creatorCommissionType: "FIXED_AMOUNT", creatorCommissionValue: 600, ...overrides }),
  );
  await transitionCampaign(owner.brand.id, owner.user.id, campaign.id, "PUBLISH", { confirmed: true });
  const creator = await makeCreator();
  const { code } = await joinCampaign({ id: creator.id, name: creator.name, role: "CREATOR" }, campaign.id);
  return { owner, campaign, creator, code: code! };
}

afterAll(() => prisma.$disconnect());

describe("helpers", () => {
  it("masks contacts and normalises order references", () => {
    expect(maskContact("arjun.k@gmail.com")).toBe("ar•••@gmail.com");
    expect(maskContact("a@x.io")).toBe("a•••@x.io");
    expect(maskContact("+91 98765 43210")).toMatch(/••••• 3210$/);
    expect(maskContact("9876543210")).toBe("••••• 3210");
    expect(orderReferenceKey(" ord 12-a b ")).toBe("ORD12-AB");
  });
});

describe("submitOrderClaim", () => {
  it("records a pending claim with last-click evidence, notifies the brand, and owes nothing yet", async () => {
    const { owner, campaign, code } = await setup();
    const at = Date.now() - 60_000;
    const claim = await submitOrderClaim({
      campaignId: campaign.id,
      code,
      orderReference: "SHOP-1001",
      contact: "Buyer.One@Example.com",
      attribution: { code, campaignId: campaign.id, at },
      ip: "203.0.113.9",
    });
    expect(claim.status).toBe("PENDING");
    expect(claim.evidence).toBe("LAST_CLICK");
    expect(claim.clickedAt?.getTime()).toBe(at);
    expect(claim.contactMasked).toBe("Bu•••@Example.com");
    expect(claim.orderReferenceKey).toBe("SHOP-1001");
    // No referral, conversion or ledger row exists until the brand confirms.
    expect(await prisma.referral.count({ where: { campaignId: campaign.id, status: { in: ["PURCHASED", "VERIFIED"] } } })).toBe(0);
    expect(await prisma.notification.count({ where: { userId: owner.user.id, type: "ORDER_CLAIMED" } })).toBe(1);
  });

  it("marks a claim without a matching click cookie as CODE_ENTERED", async () => {
    const { campaign, code } = await setup();
    const claim = await submitOrderClaim({ campaignId: campaign.id, code, orderReference: uniq("ORD"), contact: "+91 98765 43210", attribution: { code: "OTHER-CODE-0000", campaignId: campaign.id, at: Date.now() } });
    expect(claim.evidence).toBe("CODE_ENTERED");
    expect(claim.clickedAt).toBeNull();
  });

  it("refuses codes from another campaign, self-referrals, duplicates and already-recorded orders", async () => {
    const a = await setup();
    const b = await setup();
    await expect(submitOrderClaim({ campaignId: a.campaign.id, code: b.code, orderReference: uniq("ORD"), contact: "x@example.com" })).rejects.toThrow(/does not belong/);
    await expect(submitOrderClaim({ campaignId: a.campaign.id, code: a.code, orderReference: uniq("ORD"), contact: a.creator.email })).rejects.toThrow(/own referral link/);

    await submitOrderClaim({ campaignId: a.campaign.id, code: a.code, orderReference: "DUP-1", contact: "x@example.com" });
    await expect(submitOrderClaim({ campaignId: a.campaign.id, code: a.code, orderReference: " dup-1 ", contact: "y@example.com" })).rejects.toThrow(/already been submitted/);

    await recordOrder(a.owner.brand.id, a.owner.user.id, { code: a.code, orderReference: "REC-1", amountMinor: 150_000 });
    await expect(submitOrderClaim({ campaignId: a.campaign.id, code: a.code, orderReference: "REC-1", contact: "z@example.com" })).rejects.toThrow(/already been recorded/);
  });

  it("refuses claims once the campaign is paused", async () => {
    const { owner, campaign, code } = await setup();
    await transitionCampaign(owner.brand.id, owner.user.id, campaign.id, "PAUSE");
    await expect(submitOrderClaim({ campaignId: campaign.id, code, orderReference: uniq("ORD"), contact: "x@example.com" })).rejects.toBeInstanceOf(OrderClaimError);
  });
});

describe("confirmOrderClaim / rejectOrderClaim", () => {
  it("confirming records AND verifies the order atomically and releases the commission", async () => {
    const { owner, campaign, creator, code } = await setup();
    const customer = await makeCustomer();
    const claim = await submitOrderClaim({ campaignId: campaign.id, code, orderReference: "SHOP-2001", contact: customer.email, customerId: customer.id });

    const confirmed = await confirmOrderClaim(owner.brand.id, owner.user.id, claim.id, { amountMinor: 199_900 });
    expect(confirmed.status).toBe("CONFIRMED");
    expect(confirmed.referralId).toBeTruthy();

    const referral = await prisma.referral.findUniqueOrThrow({ where: { id: confirmed.referralId! }, include: { conversion: true, commissions: true } });
    expect(referral.status).toBe("VERIFIED");
    expect(referral.conversion?.source).toBe("CUSTOMER_CLAIM");
    expect(referral.conversion?.orderReference).toBe("SHOP-2001");
    expect(referral.conversion?.amount).toBe(199_900);
    expect(referral.commissions).toHaveLength(1);
    expect(referral.commissions[0]).toMatchObject({ creatorId: creator.id, amount: 60_000, status: "APPROVED" });
    // Signed-in claimant and the creator were both told.
    expect(await prisma.notification.count({ where: { userId: customer.id, title: { contains: "SHOP-2001" } } })).toBe(1);
    expect(await prisma.notification.count({ where: { userId: creator.id, type: "CONVERSION_VERIFIED" } })).toBe(1);

    await expect(confirmOrderClaim(owner.brand.id, owner.user.id, claim.id, { amountMinor: 1 })).rejects.toThrow(/already been decided/);
  });

  it("a failed record (below minimum order value) leaves the claim PENDING and writes nothing", async () => {
    const { owner, campaign, code } = await setup({ minimumPurchaseAmount: 5000 });
    const claim = await submitOrderClaim({ campaignId: campaign.id, code, orderReference: uniq("ORD"), contact: "x@example.com" });
    await expect(confirmOrderClaim(owner.brand.id, owner.user.id, claim.id, { amountMinor: 100_000 })).rejects.toBeInstanceOf(ConversionError);
    const after = await prisma.orderClaim.findUniqueOrThrow({ where: { id: claim.id } });
    expect(after.status).toBe("PENDING");
    expect(after.referralId).toBeNull();
    expect(await prisma.conversion.count({ where: { brandId: owner.brand.id } })).toBe(0);
  });

  it("another brand cannot decide the claim; rejecting stores the reason and allows a re-submission", async () => {
    const { owner, campaign, code } = await setup();
    const other = await makeOwnerWithBrand(`Other ${uniq("b")}`);
    const claim = await submitOrderClaim({ campaignId: campaign.id, code, orderReference: "SHOP-3001", contact: "x@example.com" });
    await expect(confirmOrderClaim(other.brand.id, other.user.id, claim.id, { amountMinor: 100_000 })).rejects.toThrow(/not found/);
    await expect(rejectOrderClaim(other.brand.id, other.user.id, claim.id, "nope")).rejects.toThrow(/not found/);

    const rejected = await rejectOrderClaim(owner.brand.id, owner.user.id, claim.id, "No such order in our store");
    expect(rejected.status).toBe("REJECTED");
    expect(rejected.rejectionReason).toBe("No such order in our store");
    expect(await prisma.referral.count({ where: { campaignId: campaign.id, status: { in: ["PURCHASED", "VERIFIED"] } } })).toBe(0);

    // The customer fixes the typo and submits again under the same number.
    const again = await submitOrderClaim({ campaignId: campaign.id, code, orderReference: "SHOP-3001", contact: "x@example.com" });
    expect(again.status).toBe("PENDING");
  });
});
