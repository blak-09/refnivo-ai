import type { CommissionType, RewardType } from "@prisma/client";
import { applyBasisPoints } from "@/lib/money";

/**
 * Deterministic reward and commission maths. All inputs/outputs are integer
 * minor units (paise). Percentages are basis points.
 */

export type RewardRules = {
  rewardType: RewardType;
  customerRewardValue: number;
  creatorCommissionType: CommissionType;
  creatorCommissionValue: number;
  maxRewardPerCustomer: number | null;
  minimumPurchaseAmount: number | null;
};

export function meetsMinimumPurchase(rules: Pick<RewardRules, "minimumPurchaseAmount">, billMinor: number): boolean {
  if (rules.minimumPurchaseAmount === null) return true;
  return billMinor >= rules.minimumPurchaseAmount;
}

/**
 * Reward owed to the referring customer for one verified conversion.
 * `maxRewardPerCustomer` caps this single order's reward — it is NOT a lifetime
 * cap per customer (the column name is historical; the UI says "per order").
 */
export function computeCustomerReward(rules: RewardRules, billMinor: number): number {
  let amount: number;
  if (rules.rewardType === "PERCENTAGE") {
    amount = applyBasisPoints(billMinor, rules.customerRewardValue);
  } else {
    // FIXED_AMOUNT, VOUCHER and DISCOUNT are all a fixed face value in v1.
    amount = rules.customerRewardValue;
  }
  if (rules.maxRewardPerCustomer !== null) amount = Math.min(amount, rules.maxRewardPerCustomer);
  return Math.max(0, amount);
}

/** Commission owed to the referring creator for one verified conversion. */
export function computeCreatorCommission(rules: RewardRules, billMinor: number): number {
  if (rules.creatorCommissionType === "PERCENTAGE") {
    return Math.max(0, applyBasisPoints(billMinor, rules.creatorCommissionValue));
  }
  return Math.max(0, rules.creatorCommissionValue);
}

/**
 * Illustrative cost estimate for the campaign preview step. Clearly labelled
 * as an estimate in the UI; it never feeds any ledger.
 */
export function estimateCampaignCost(
  rules: RewardRules,
  assumptions: { referrals: number; averageBillMinor: number; creatorShare: number },
): { rewardCost: number; commissionCost: number; totalCost: number; revenue: number } {
  const creatorReferrals = Math.round(assumptions.referrals * assumptions.creatorShare);
  const customerReferrals = assumptions.referrals - creatorReferrals;
  const rewardCost = customerReferrals * computeCustomerReward(rules, assumptions.averageBillMinor);
  const commissionCost = creatorReferrals * computeCreatorCommission(rules, assumptions.averageBillMinor);
  return {
    rewardCost,
    commissionCost,
    totalCost: rewardCost + commissionCost,
    revenue: assumptions.referrals * assumptions.averageBillMinor,
  };
}
