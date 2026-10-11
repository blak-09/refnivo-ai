/**
 * Brand subscription plans — the single server-side source of truth for price.
 *
 * Prices live here, never in the browser: checkout takes a plan *key*, looks the
 * amount up in this table and freezes it on the transaction. A caller who edits
 * the request in devtools can only ever change which plan is bought, not what it
 * costs, and an unknown key is rejected.
 *
 * Amounts are integer paise (lib/money), consistent with the rest of the ledger.
 */
export type PlanKey = "starter" | "growth";

export type Plan = {
  key: PlanKey;
  name: string;
  /** Integer minor units (paise). */
  amount: number;
  currency: "INR";
  /** Billing period in days; the subscription's paid period is set from this. */
  periodDays: number;
  tagline: string;
  features: string[];
  /** Shown as the suggested option on the billing page. */
  highlight?: boolean;
};

export const PLANS: Record<PlanKey, Plan> = {
  starter: {
    key: "starter",
    name: "Starter",
    amount: 99_900, // ₹999
    currency: "INR",
    periodDays: 30,
    tagline: "For a brand running its first campaigns.",
    features: ["One brand workspace", "Unlimited products and campaigns", "Referral links and QR codes", "Order verification and ledger", "E-mail support"],
  },
  growth: {
    key: "growth",
    name: "Growth",
    amount: 249_900, // ₹2,499
    currency: "INR",
    periodDays: 30,
    tagline: "For brands working with creators every month.",
    features: ["Everything in Starter", "Creator discovery and applications", "Campaign and creator analytics", "CSV exports", "Priority support"],
    highlight: true,
  },
};

export const PLAN_LIST: Plan[] = [PLANS.starter, PLANS.growth];

export function isPlanKey(value: unknown): value is PlanKey {
  return typeof value === "string" && Object.hasOwn(PLANS, value);
}

/** Server-side price lookup. Returns null for anything that is not a known plan. */
export function getPlan(key: unknown): Plan | null {
  return isPlanKey(key) ? PLANS[key] : null;
}

/** End of the period a payment made at `from` pays for. */
export function periodEnd(plan: Plan, from: Date): Date {
  return new Date(from.getTime() + plan.periodDays * 24 * 60 * 60 * 1000);
}
