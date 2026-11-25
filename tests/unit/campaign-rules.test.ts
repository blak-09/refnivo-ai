import { describe, expect, it } from "vitest";
import { acceptsOrderClaims, availableActions, campaignNeedsReview, campaignReviewMode, canEdit, canTransition, checkOrderDate, isCampaignLive, payableAtFor, publishProblems, stoppedAtFor, type CampaignLike } from "@/lib/domain/campaign-rules";

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

describe("order dates after a campaign stops (W2)", () => {
  const live = { status: "ACTIVE" as const, startDate: new Date("2026-09-01T00:00:00Z"), endDate: new Date("2026-10-01T00:00:00Z"), stoppedAt: null };
  const now = new Date("2026-10-05T12:00:00Z");
  it("accepts an order from the last week of an ended campaign, refuses one after the end", () => {
    expect(checkOrderDate(live, new Date("2026-09-30T10:00:00Z"), now).problem).toBeNull();
    expect(checkOrderDate(live, new Date("2026-10-02T10:00:00Z"), now).problem).toMatch(/after the campaign stopped/);
    expect(checkOrderDate(live, new Date("2026-08-30T10:00:00Z"), now).problem).toMatch(/before the campaign started/);
    expect(checkOrderDate(live, new Date("2026-10-06T10:00:00Z"), now).problem).toMatch(/future/);
    expect(checkOrderDate(live, new Date("2026-09-30T10:00:00Z"), new Date("2026-11-15T00:00:00Z")).problem).toMatch(/window has closed/);
  });
  it("uses the earlier of end date and pause time", () => {
    const paused = { ...live, status: "PAUSED" as const, stoppedAt: new Date("2026-09-20T08:00:00Z") };
    expect(checkOrderDate(paused, new Date("2026-09-19T08:00:00Z"), now).problem).toBeNull();
    expect(checkOrderDate(paused, new Date("2026-09-25T08:00:00Z"), now).problem).toMatch(/after the campaign stopped/);
  });
  it("a calendar-day date counts if any moment of that (IST) day fits, and stores an instant inside the range", () => {
    const startsMidday = { ...live, startDate: new Date("2026-09-01T09:00:00Z") };
    const day = new Date("2026-09-01T00:00:00Z"); // 1 Sep, entered in a date input
    expect(checkOrderDate(startsMidday, day, now).problem).toMatch(/before the campaign started/); // exact instant (00:00Z) is before 09:00Z
    const r = checkOrderDate(startsMidday, day, now, { wholeDay: true });
    expect(r.problem).toBeNull();
    expect(r.orderedAt.getTime()).toBeGreaterThanOrEqual(startsMidday.startDate.getTime());
    // "Today" is never refused as future.
    const today = new Date("2026-10-05T00:00:00Z");
    const activeNow = { ...live, endDate: null };
    const t = checkOrderDate(activeNow, today, now, { wholeDay: true });
    expect(t.problem).toBeNull();
    expect(t.orderedAt.getTime()).toBeLessThanOrEqual(now.getTime());
  });
  it("draft / archived campaigns never take orders; claims follow the same late window", () => {
    expect(checkOrderDate({ ...live, status: "DRAFT" }, new Date("2026-09-10T00:00:00Z"), now).problem).toMatch(/not accepting/);
    expect(acceptsOrderClaims(live, now)).toBe(true);
    expect(acceptsOrderClaims(live, new Date("2026-11-15T00:00:00Z"))).toBe(false);
    expect(acceptsOrderClaims({ ...live, status: "ARCHIVED" }, now)).toBe(false);
  });
});

describe("hold, stop time and review policy (W3, W6)", () => {
  it("payableAt is verifiedAt + holdDays; 0 days means payable at once", () => {
    const v = new Date("2026-10-01T00:00:00Z");
    expect(payableAtFor(14, v)?.toISOString()).toBe("2026-10-15T00:00:00.000Z");
    expect(payableAtFor(0, v)).toBeNull();
  });
  it("pause records, end keeps an earlier pause, resume clears", () => {
    const t = new Date("2026-10-01T00:00:00Z");
    const earlier = new Date("2026-09-01T00:00:00Z");
    expect(stoppedAtFor("PAUSE", null, t)).toEqual({ stoppedAt: t });
    expect(stoppedAtFor("END", earlier, t)).toEqual({ stoppedAt: earlier });
    expect(stoppedAtFor("END", null, t)).toEqual({ stoppedAt: t });
    expect(stoppedAtFor("RESUME", earlier, t)).toEqual({ stoppedAt: null });
    expect(stoppedAtFor("ARCHIVE", earlier, t)).toEqual({});
  });
  it("brands cannot publish from PENDING_REVIEW; review policy defaults to the first campaign of unverified brands", () => {
    expect(canTransition("PENDING_REVIEW", "PUBLISH")).toBe(false);
    expect(campaignReviewMode({})).toBe("first");
    expect(campaignReviewMode({ CAMPAIGN_REVIEW: "ALL" })).toBe("all");
    expect(campaignNeedsReview("first", false, false)).toBe(true);
    expect(campaignNeedsReview("first", true, false)).toBe(false);
    expect(campaignNeedsReview("first", false, true)).toBe(false);
    expect(campaignNeedsReview("all", true, true)).toBe(true);
    expect(campaignNeedsReview("off", false, false)).toBe(false);
  });
});
