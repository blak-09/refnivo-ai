import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { createCampaign, transitionCampaign } from "@/lib/services/campaigns";
import { joinCampaign } from "@/lib/services/partners";
import { ConversionError, recordOrder, verifyConversion } from "@/lib/services/conversions";
import { campaignValues, makeCreator, makeOwnerWithBrand } from "../helpers";

/**
 * Campaign budget must hold under concurrent verification. Each verification
 * locks the campaign row (SELECT … FOR UPDATE) so simultaneous requests are
 * serialised and the sum of approved ledger entries never exceeds the budget.
 */

async function campaignWithBudget(budgetRupees: number, commissionRupees: number) {
  const owner = await makeOwnerWithBrand(`Budget ${budgetRupees}`);
  const campaign = await createCampaign(
    owner.brand.id,
    owner.brand.name,
    owner.user.id,
    campaignValues(owner.product.id, {
      name: `Budget ${budgetRupees}`,
      requiresApproval: false,
      budget: budgetRupees,
      creatorCommissionType: "FIXED_AMOUNT",
      creatorCommissionValue: commissionRupees,
    }),
  );
  await transitionCampaign(owner.brand.id, owner.user.id, campaign.id, "PUBLISH", { confirmed: true });
  const creator = await makeCreator();
  const { code } = await joinCampaign({ id: creator.id, name: creator.name, role: "CREATOR" }, campaign.id);
  return { owner, campaign, code: code! };
}

async function approvedCommissionTotal(campaignId: string) {
  const agg = await prisma.commission.aggregate({ where: { referral: { campaignId }, status: "APPROVED" }, _sum: { amount: true } });
  return agg._sum.amount ?? 0;
}

afterAll(() => prisma.$disconnect());

describe("campaign budget under concurrency", () => {
  it("two simultaneous verifications against a budget that fits one: exactly one succeeds, budget never exceeded", async () => {
    // Budget ₹200 (20 000 paise), each commission ₹150 (15 000 paise) → only one fits.
    const { owner, campaign, code } = await campaignWithBudget(200, 150);
    const o1 = await recordOrder(owner.brand.id, owner.user.id, { code, orderReference: "C-1", amountMinor: 100_000 });
    const o2 = await recordOrder(owner.brand.id, owner.user.id, { code, orderReference: "C-2", amountMinor: 100_000 });

    const results = await Promise.allSettled([
      verifyConversion(owner.brand.id, owner.user.id, o1.referral.id),
      verifyConversion(owner.brand.id, owner.user.id, o2.referral.id),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(ConversionError);
    expect(String(rejected[0].reason.message)).toMatch(/budget/i);

    // Ledger integrity: approved total is exactly one commission and within budget.
    const approved = await approvedCommissionTotal(campaign.id);
    expect(approved).toBe(15_000);
    expect(approved).toBeLessThanOrEqual(20_000);

    // The losing verification rolled back completely: still PURCHASED / PENDING.
    const referrals = await prisma.referral.findMany({
      where: { id: { in: [o1.referral.id, o2.referral.id] } },
      select: { status: true, commissions: { select: { status: true } } },
    });
    const statuses = referrals.map((r) => r.status).sort();
    expect(statuses).toEqual(["PURCHASED", "VERIFIED"]);
    const pending = referrals.find((r) => r.status === "PURCHASED")!;
    expect(pending.commissions.every((c) => c.status === "PENDING")).toBe(true);
  });

  it("a burst of five verifications against a budget that fits two approves exactly two", async () => {
    // Budget ₹300 → two ₹150 commissions fit, three must be refused.
    const { owner, campaign, code } = await campaignWithBudget(300, 150);
    const orders = await Promise.all(
      [1, 2, 3, 4, 5].map((n) => recordOrder(owner.brand.id, owner.user.id, { code, orderReference: `B-${n}`, amountMinor: 50_000 })),
    );

    const results = await Promise.allSettled(orders.map((o) => verifyConversion(owner.brand.id, owner.user.id, o.referral.id)));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(2);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(3);

    expect(await approvedCommissionTotal(campaign.id)).toBe(30_000);
    const verified = await prisma.referral.count({ where: { campaignId: campaign.id, status: "VERIFIED" } });
    expect(verified).toBe(2);
  });

  it("verifying the same order twice concurrently approves it once", async () => {
    const { owner, campaign, code } = await campaignWithBudget(1_000, 150);
    const o = await recordOrder(owner.brand.id, owner.user.id, { code, orderReference: "D-1", amountMinor: 50_000 });

    const results = await Promise.allSettled([
      verifyConversion(owner.brand.id, owner.user.id, o.referral.id),
      verifyConversion(owner.brand.id, owner.user.id, o.referral.id),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
    expect(await approvedCommissionTotal(campaign.id)).toBe(15_000);
    expect(await prisma.auditLog.count({ where: { action: "CONVERSION_VERIFIED", entityId: o.referral.id } })).toBe(1);
  });

  it("another brand cannot verify, reject, or even see the order (unauthorized mutation)", async () => {
    const { owner, code } = await campaignWithBudget(1_000, 150);
    const other = await makeOwnerWithBrand("Intruder");
    const o = await recordOrder(owner.brand.id, owner.user.id, { code, orderReference: "X-1", amountMinor: 50_000 });

    await expect(verifyConversion(other.brand.id, other.user.id, o.referral.id)).rejects.toThrow(/not found/i);

    const untouched = await prisma.referral.findUnique({ where: { id: o.referral.id }, select: { status: true, commissions: { select: { status: true } } } });
    expect(untouched?.status).toBe("PURCHASED");
    expect(untouched?.commissions.every((c) => c.status === "PENDING")).toBe(true);
  });
});
