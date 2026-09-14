import { describe, expect, it } from "vitest";
import { availableActions, canEdit, canTransition, isCampaignLive, publishProblems, type CampaignLike } from "@/lib/domain/campaign-rules";

const base: CampaignLike = {
  status: "DRAFT",
  startDate: new Date("2026-09-01"),
  endDate: null,
  customerRewardValue: 5_000,
  creatorCommissionValue: 10_000,
  budget: null,
  campaignType: "HYBRID",
};

describe("campaign lifecycle rules", () => {
  it("state machine transitions", () => {
    expect(canTransition("DRAFT", "PUBLISH")).toBe(true);
    expect(canTransition("ACTIVE", "PUBLISH")).toBe(false);
    expect(canTransition("ACTIVE", "PAUSE")).toBe(true);
    expect(canTransition("PAUSED", "RESUME")).toBe(true);
    expect(canTransition("PAUSED", "END")).toBe(true);
    expect(canTransition("ENDED", "RESUME")).toBe(false);
    expect(canTransition("ENDED", "ARCHIVE")).toBe(true);
    expect(canTransition("ARCHIVED", "PUBLISH")).toBe(false);
    expect(availableActions("ACTIVE")).toEqual(["PAUSE", "END"]);
    expect(availableActions("ARCHIVED")).toEqual([]);
  });

  it("editability", () => {
    expect(canEdit("DRAFT")).toBe(true);
    expect(canEdit("ACTIVE")).toBe(true);
    expect(canEdit("PAUSED")).toBe(true);
    expect(canEdit("ENDED")).toBe(false);
    expect(canEdit("ARCHIVED")).toBe(false);
  });

  it("live check honours status and date window", () => {
    const now = new Date("2026-09-15");
    expect(isCampaignLive({ ...base, status: "ACTIVE" }, now)).toBe(true);
    expect(isCampaignLive({ ...base, status: "PAUSED" }, now)).toBe(false);
    expect(isCampaignLive({ ...base, status: "ACTIVE", startDate: new Date("2026-10-01") }, now)).toBe(false);
    expect(isCampaignLive({ ...base, status: "ACTIVE", endDate: new Date("2026-09-10") }, now)).toBe(false);
    expect(isCampaignLive({ ...base, status: "ACTIVE", endDate: new Date("2026-09-20") }, now)).toBe(true);
  });

  it("publish pre-flight rejects invalid reward values and past end dates", () => {
    const now = new Date("2026-09-15");
    expect(publishProblems(base, now)).toEqual([]);
    expect(publishProblems({ ...base, customerRewardValue: 0 }, now).length).toBe(1);
    expect(publishProblems({ ...base, customerRewardValue: 0, campaignType: "CREATOR_AFFILIATE" }, now)).toEqual([]);
    expect(publishProblems({ ...base, creatorCommissionValue: 0 }, now).length).toBe(1);
    expect(publishProblems({ ...base, creatorCommissionValue: 0, campaignType: "CUSTOMER_REFERRAL" }, now)).toEqual([]);
    expect(publishProblems({ ...base, endDate: new Date("2026-09-01") }, now).length).toBeGreaterThan(0);
    expect(publishProblems({ ...base, budget: 0 }, now).length).toBe(1);
  });
});
