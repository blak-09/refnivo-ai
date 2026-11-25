import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { FREE_CAMPAIGN_LIMIT, getPlan, type PlanFeature } from "@/lib/config/plans";

/*
 * Free tier for brands: FREE_CAMPAIGN_LIMIT campaign launches, then a paid plan
 * (lib/config/plans.ts) is needed to launch more. Campaigns that are already
 * live keep running if a plan lapses — only *new* launches are gated.
 *
 * Always enforced. `PLAN_LIMITS=off` switches it off (the unit/integration test
 * runner does this so older tests can publish freely; plan tests opt back in).
 */

export type CampaignAllowance = {
  limit: number;
  /** Campaigns this brand has ever published. */
  used: number;
  /** Free launches left (0 once used up; ignored while subscribed). */
  remaining: number;
  /** A paid plan is in its paid period. */
  subscribed: boolean;
  planName: string | null;
  /** Whether the free limit applies at all (false only with PLAN_LIMITS=off). */
  enforced: boolean;
  /** A new campaign can be launched right now. */
  canLaunch: boolean;
};

type SubscriptionLike = { planKey: string; status: string; currentPeriodEnd: Date } | null;

/**
 * A plan entitles the brand while its paid period runs. A cancelled plan keeps
 * working until the end of the period it was paid for.
 */
export function planEntitles(sub: SubscriptionLike, now = new Date()): boolean {
  return !!sub && (sub.status === "ACTIVE" || sub.status === "CANCELLED") && sub.currentPeriodEnd > now;
}

/** Pure: the allowance from what was launched, the plan, and whether billing is on. */
export function computeAllowance(input: { used: number; subscription: SubscriptionLike; enforced: boolean; now?: Date }): CampaignAllowance {
  const subscribed = planEntitles(input.subscription, input.now);
  const remaining = Math.max(0, FREE_CAMPAIGN_LIMIT - input.used);
  return {
    limit: FREE_CAMPAIGN_LIMIT,
    used: input.used,
    remaining,
    subscribed,
    planName: subscribed ? (getPlan(input.subscription?.planKey)?.name ?? null) : null,
    enforced: input.enforced,
    canLaunch: !input.enforced || subscribed || remaining > 0,
  };
}

export const planLimitEnforced = (env: NodeJS.ProcessEnv = process.env) => (env.PLAN_LIMITS ?? "").trim().toLowerCase() !== "off";

async function readAllowance(db: Prisma.TransactionClient | typeof prisma, brandId: string, enforced: boolean, now?: Date) {
  const [used, subscription] = await Promise.all([
    db.campaign.count({ where: { brandId, OR: [{ publishedAt: { not: null } }, { status: "PENDING_REVIEW" }] } }),
    db.brandSubscription.findUnique({ where: { brandId }, select: { planKey: true, status: true, currentPeriodEnd: true } }),
  ]);
  return computeAllowance({ used, subscription, enforced, now });
}

/** For pages: how many free launches the brand has left and whether it can launch now. */
export function getCampaignAllowance(brandId: string, opts: { enforced?: boolean; now?: Date } = {}) {
  return readAllowance(prisma, brandId, opts.enforced ?? planLimitEnforced(), opts.now);
}

export const PLAN_REQUIRED_MESSAGE = `You've launched your ${FREE_CAMPAIGN_LIMIT} free campaigns. Choose a plan in Billing to launch more — your drafts are saved.`;

/**
 * Inside the publishing transaction: locks the brand row so two launches at
 * once cannot both take the last free slot, then re-reads the allowance.
 */
export async function allowanceForLaunch(tx: Prisma.TransactionClient, brandId: string, enforced: boolean, now?: Date) {
  await tx.$queryRaw`SELECT id FROM "brands" WHERE id = ${brandId} FOR UPDATE`;
  return readAllowance(tx, brandId, enforced, now);
}

// ---------------------------------------------------------------------------
// Paid-only features (Growth): analytics dashboard, CSV exports, priority support
// ---------------------------------------------------------------------------

export type BrandEntitlements = {
  enforced: boolean;
  subscribed: boolean;
  planKey: string | null;
  planName: string | null;
  features: Record<PlanFeature, boolean>;
};

/**
 * Pure. Analytics and exports follow the same switch as launches (PLAN_LIMITS=off
 * unlocks them). Priority support is a real service promise, so it always needs
 * a plan that includes it.
 */
export function computeEntitlements(input: { subscription: SubscriptionLike; enforced: boolean; now?: Date }): BrandEntitlements {
  const subscribed = planEntitles(input.subscription, input.now);
  const plan = subscribed ? getPlan(input.subscription?.planKey) : null;
  const has = (f: PlanFeature) => !!plan?.includes.includes(f);
  return {
    enforced: input.enforced,
    subscribed,
    planKey: plan?.key ?? null,
    planName: plan?.name ?? null,
    features: {
      ugc: !input.enforced || has("ugc"),
      analytics: !input.enforced || has("analytics"),
      exports: !input.enforced || has("exports"),
      prioritySupport: has("prioritySupport"),
    },
  };
}

export async function getBrandEntitlements(brandId: string, opts: { enforced?: boolean; now?: Date } = {}) {
  const subscription = await prisma.brandSubscription.findUnique({ where: { brandId }, select: { planKey: true, status: true, currentPeriodEnd: true } });
  return computeEntitlements({ subscription, enforced: opts.enforced ?? planLimitEnforced(), now: opts.now });
}
