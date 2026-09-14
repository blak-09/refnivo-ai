import { describe, expect, it } from "vitest";
import {
  computeCreatorCommission,
  computeCustomerReward,
  estimateCampaignCost,
  meetsMinimumPurchase,
  type RewardRules,
} from "@/lib/domain/rewards";

const fixed: RewardRules = {
  rewardType: "FIXED_AMOUNT",
  customerRewardValue: 5_000, // ₹50
  creatorCommissionType: "FIXED_AMOUNT",
  creatorCommissionValue: 10_000, // ₹100
  maxRewardPerCustomer: null,
  minimumPurchaseAmount: 50_000, // ₹500
};

const percent: RewardRules = {
  rewardType: "PERCENTAGE",
  customerRewardValue: 1_500, // 15%
  creatorCommissionType: "PERCENTAGE",
  creatorCommissionValue: 1_000, // 10%
  maxRewardPerCustomer: 20_000, // ₹200 cap
  minimumPurchaseAmount: null,
};

describe("reward & commission calculation", () => {
  it("fixed reward and commission are independent of the order", () => {
    expect(computeCustomerReward(fixed, 78_000)).toBe(5_000);
    expect(computeCreatorCommission(fixed, 78_000)).toBe(10_000);
    expect(computeCreatorCommission(fixed, 1)).toBe(10_000);
  });

  it("spec example: 5 creator referrals × ₹100 = ₹500, 2 customer referrals × ₹50 = ₹100", () => {
    expect(5 * computeCreatorCommission(fixed, 60_000)).toBe(50_000);
    expect(2 * computeCustomerReward(fixed, 60_000)).toBe(10_000);
  });

  it("percentage reward respects the per-customer cap", () => {
    expect(computeCustomerReward(percent, 100_000)).toBe(15_000); // 15% of ₹1000 = ₹150
    expect(computeCustomerReward(percent, 300_000)).toBe(20_000); // 15% of ₹3000 = ₹450 → capped ₹200
    expect(computeCreatorCommission(percent, 300_000)).toBe(30_000); // 10% of ₹3000 = ₹300 (no cap on commission)
  });

  it("minimum purchase gate", () => {
    expect(meetsMinimumPurchase(fixed, 49_999)).toBe(false);
    expect(meetsMinimumPurchase(fixed, 50_000)).toBe(true);
    expect(meetsMinimumPurchase(percent, 1)).toBe(true);
  });

  it("estimate is deterministic and additive", () => {
    const est = estimateCampaignCost(fixed, { referrals: 50, averageBillMinor: 50_000, creatorShare: 0.5 });
    expect(est.rewardCost).toBe(25 * 5_000);
    expect(est.commissionCost).toBe(25 * 10_000);
    expect(est.totalCost).toBe(est.rewardCost + est.commissionCost);
    expect(est.revenue).toBe(50 * 50_000);
  });
});
