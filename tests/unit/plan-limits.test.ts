import { describe, expect, it } from "vitest";
import { FREE_CAMPAIGN_LIMIT, planFor, PLANS } from "@/lib/config/plans";
import { computeAllowance, computeEntitlements, planEntitles, planLimitEnforced } from "@/lib/services/plan-limits";
import { newPeriodEnd } from "@/lib/services/payments";

const now = new Date("2026-11-24T00:00:00Z");
const future = new Date("2026-12-24T00:00:00Z");
const past = new Date("2026-11-01T00:00:00Z");

describe("free campaign limit", () => {
  it("is three launches", () => {
    expect(FREE_CAMPAIGN_LIMIT).toBe(3);
  });

  it("counts down the free launches, then blocks without a plan", () => {
    expect(computeAllowance({ used: 0, subscription: null, enforced: true, now })).toMatchObject({ remaining: 3, canLaunch: true, subscribed: false });
    expect(computeAllowance({ used: 2, subscription: null, enforced: true, now })).toMatchObject({ remaining: 1, canLaunch: true });
    expect(computeAllowance({ used: 3, subscription: null, enforced: true, now })).toMatchObject({ remaining: 0, canLaunch: false });
    expect(computeAllowance({ used: 7, subscription: null, enforced: true, now })).toMatchObject({ remaining: 0, canLaunch: false });
  });

  it("a plan in its paid period unlocks unlimited launches and names the plan", () => {
    const a = computeAllowance({ used: 9, subscription: { planKey: "growth", status: "ACTIVE", currentPeriodEnd: future }, enforced: true, now });
    expect(a).toMatchObject({ canLaunch: true, subscribed: true, planName: "Growth" });
  });

  it("an expired plan does not, and a cancelled plan works until its period ends", () => {
    expect(planEntitles({ planKey: "starter", status: "ACTIVE", currentPeriodEnd: past }, now)).toBe(false);
    expect(planEntitles({ planKey: "starter", status: "EXPIRED", currentPeriodEnd: future }, now)).toBe(false);
    expect(planEntitles({ planKey: "starter", status: "CANCELLED", currentPeriodEnd: future }, now)).toBe(true);
    expect(computeAllowance({ used: 3, subscription: { planKey: "starter", status: "ACTIVE", currentPeriodEnd: past }, enforced: true, now }).canLaunch).toBe(false);
  });

  it("does not block anyone when PLAN_LIMITS=off", () => {
    expect(computeAllowance({ used: 10, subscription: null, enforced: false, now })).toMatchObject({ canLaunch: true, enforced: false });
  });
});

describe("plan features", () => {
  const growth = { planKey: "growth", status: "ACTIVE", currentPeriodEnd: future };
  const starter = { planKey: "starter", status: "ACTIVE", currentPeriodEnd: future };

  it("Growth unlocks analytics, CSV exports and priority support", () => {
    expect(computeEntitlements({ subscription: growth, enforced: true, now }).features).toEqual({ ugc: true, analytics: true, exports: true, prioritySupport: true });
    expect(planFor("analytics").key).toBe("growth");
  });

  it("Starter and Free do not, and an expired Growth plan stops unlocking them", () => {
    const locked = { ugc: false, analytics: false, exports: false, prioritySupport: false };
    expect(computeEntitlements({ subscription: starter, enforced: true, now }).features).toEqual({ ...locked, ugc: true });
    expect(computeEntitlements({ subscription: null, enforced: true, now }).features).toEqual(locked);
    expect(computeEntitlements({ subscription: { ...growth, currentPeriodEnd: past }, enforced: true, now }).features).toEqual(locked);
  });

  it("with PLAN_LIMITS=off nothing is locked, but priority support still needs a real Growth plan", () => {
    expect(computeEntitlements({ subscription: null, enforced: false, now }).features).toEqual({ ugc: true, analytics: true, exports: true, prioritySupport: false });
  });

  it("every advertised paid-only feature is backed by an entitlement", () => {
    expect(PLANS.growth.includes).toEqual(expect.arrayContaining(["analytics", "exports", "prioritySupport"]));
    expect(PLANS.starter.includes).toEqual(["ugc"]);
    expect(planFor("ugc").key).toBe("starter");
  });
});

describe("buying a plan at any time", () => {
  const DAY = 86_400_000;
  const at = (days: number) => new Date(now.getTime() + days * DAY);

  it("with no plan (or an expired one) it runs 30 days from today", () => {
    expect(newPeriodEnd(PLANS.starter, null, now)).toEqual(at(30));
    expect(newPeriodEnd(PLANS.growth, { planKey: "starter", status: "ACTIVE", currentPeriodEnd: past }, now)).toEqual(at(30));
  });

  it("renewing the same plan early adds 30 days after the current period", () => {
    expect(newPeriodEnd(PLANS.starter, { planKey: "starter", status: "ACTIVE", currentPeriodEnd: at(10) }, now)).toEqual(at(40));
  });

  it("switching plans credits the unused value of the old plan as extra days", () => {
    // 30 Starter days left (₹999 worth) → about 12 Growth days on top of the new 30.
    const up = newPeriodEnd(PLANS.growth, { planKey: "starter", status: "ACTIVE", currentPeriodEnd: at(30) }, now);
    expect((up.getTime() - now.getTime()) / DAY).toBeCloseTo(30 + 30 * (999 / 2499), 3);
    // Downgrading never loses paid time: 30 Growth days left → about 75 Starter days on top of the new 30.
    const down = newPeriodEnd(PLANS.starter, { planKey: "growth", status: "ACTIVE", currentPeriodEnd: at(30) }, now);
    expect((down.getTime() - now.getTime()) / DAY).toBeCloseTo(30 + 30 * (2499 / 999), 3);
  });

  it("the free limit is on unless PLAN_LIMITS=off", () => {
    expect(planLimitEnforced({} as unknown as NodeJS.ProcessEnv)).toBe(true);
    expect(planLimitEnforced({ PAYMENTS_ENABLED: "false" } as unknown as NodeJS.ProcessEnv)).toBe(true);
    expect(planLimitEnforced({ PLAN_LIMITS: "off" } as unknown as NodeJS.ProcessEnv)).toBe(false);
  });
});
