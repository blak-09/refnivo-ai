import { prisma } from "@/lib/db/prisma";
import { FREE_CAMPAIGN_LIMIT } from "@/lib/config/plans";

/**
 * Admin business metrics (docs/AUDIT.md §13), computed from database rows
 * only. Nothing is estimated: a rate whose denominator is zero is null and the
 * page shows "No data yet". Funnel steps that need page-view events (wizard
 * drop-off, campaign views) are not here — the app records no such events.
 */

export type Rate = { numerator: number; denominator: number; value: number | null };

const rate = (numerator: number, denominator: number): Rate => ({ numerator, denominator, value: denominator > 0 ? numerator / denominator : null });
const DAY = 24 * 60 * 60 * 1000;

export type PlatformMetrics = {
  brandSignupCompletion: Rate;
  creatorSignupCompletion: Rate;
  campaignActivation: Rate;
  linkUsage30d: Rate;
  verifiedOrderRate: Rate;
  medianHoursToVerify: number | null;
  claimResponse7d: Rate;
  brandRetention: Rate;
  contestRate: Rate;
  paidThenReversed: Rate;
  planConversion: Rate;
  stalePurchased7d: number;
  staleClaims7d: number;
};

export async function getPlatformMetrics(now = new Date()): Promise<PlatformMetrics> {
  const d7 = new Date(now.getTime() - 7 * DAY);
  const d14 = new Date(now.getTime() - 14 * DAY);
  const d30 = new Date(now.getTime() - 30 * DAY);
  const d60 = new Date(now.getTime() - 60 * DAY);
  const d90 = new Date(now.getTime() - 90 * DAY);

  const [
    brandUsers,
    brands,
    creatorUsers,
    creators,
    activation,
    activeLinks,
    usedLinks,
    decidedOrders,
    verifiedOrders,
    median,
    oldClaims,
    answeredClaims,
    retention,
    contests,
    verifiedEver,
    paidCommissions,
    paidThenReversed,
    planFunnel,
    stalePurchased7d,
    staleClaims7d,
  ] = await Promise.all([
    prisma.user.count({ where: { role: "BRAND_OWNER" } }),
    prisma.brand.count(),
    prisma.user.count({ where: { role: "CREATOR" } }),
    prisma.creatorProfile.count(),
    // Launched ≥ 14 days ago; activated = ≥ 1 approved partner and ≥ 1 counted click within 14 days of launch.
    prisma.$queryRaw<{ launched: bigint; activated: bigint }[]>`
      SELECT count(*) AS launched,
             count(*) FILTER (
               WHERE EXISTS (SELECT 1 FROM "partner_applications" a WHERE a."campaignId" = c."id" AND a."status" = 'APPROVED')
                 AND EXISTS (SELECT 1 FROM "referral_clicks" k WHERE k."campaignId" = c."id" AND k."createdAt" <= c."publishedAt" + interval '14 days')
             ) AS activated
      FROM "campaigns" c
      WHERE c."publishedAt" IS NOT NULL AND c."publishedAt" <= ${d14}`,
    prisma.referralLink.count({ where: { status: "ACTIVE", createdAt: { lte: d30 } } }),
    prisma.referralLink.count({ where: { status: "ACTIVE", createdAt: { lte: d30 }, clicks: { some: { createdAt: { gte: d30 } } } } }),
    prisma.conversion.count({ where: { createdAt: { gte: d90 }, referral: { status: { in: ["VERIFIED", "REJECTED", "REFUNDED"] } } } }),
    prisma.conversion.count({ where: { createdAt: { gte: d90 }, referral: { status: { in: ["VERIFIED", "REFUNDED"] } } } }),
    prisma.$queryRaw<{ hours: number | null }[]>`
      SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM ("verifiedAt" - "createdAt")) / 3600.0) AS hours
      FROM "conversions" WHERE "verifiedAt" IS NOT NULL AND "createdAt" >= ${d90}`,
    prisma.orderClaim.count({ where: { createdAt: { gte: d90, lte: d7 } } }),
    prisma.$queryRaw<{ n: bigint }[]>`
      SELECT count(*) AS n FROM "order_claims"
      WHERE "createdAt" >= ${d90} AND "createdAt" <= ${d7} AND "decidedAt" IS NOT NULL AND "decidedAt" <= "createdAt" + interval '7 days'`,
    // Brands active (recorded an order or approved a partner) in the previous 30 days, and how many of them were active again in the last 30.
    prisma.$queryRaw<{ previous: bigint; retained: bigint }[]>`
      WITH activity AS (
        SELECT "brandId", "createdAt" AS at FROM "conversions" WHERE "createdAt" >= ${d60}
        UNION ALL
        SELECT c."brandId", a."updatedAt" AS at FROM "partner_applications" a JOIN "campaigns" c ON c."id" = a."campaignId"
        WHERE a."status" = 'APPROVED' AND a."updatedAt" >= ${d60}
      ),
      prev AS (SELECT DISTINCT "brandId" FROM activity WHERE at < ${d30}),
      curr AS (SELECT DISTINCT "brandId" FROM activity WHERE at >= ${d30})
      SELECT (SELECT count(*) FROM prev) AS previous, (SELECT count(*) FROM prev JOIN curr USING ("brandId")) AS retained`,
    prisma.conversion.count({ where: { contestedAt: { not: null } } }),
    prisma.conversion.count({ where: { verifiedAt: { not: null } } }),
    prisma.commission.count({ where: { payoutItem: { isNot: null }, status: { in: ["PAID", "REVERSED"] } } }),
    prisma.commission.count({ where: { payoutItem: { isNot: null }, status: "REVERSED" } }),
    prisma.$queryRaw<{ at_limit: bigint; subscribed: bigint }[]>`
      WITH launches AS (
        SELECT "brandId", count(*) AS n FROM "campaigns" WHERE "publishedAt" IS NOT NULL GROUP BY "brandId"
      )
      SELECT count(*) AS at_limit,
             count(*) FILTER (WHERE EXISTS (SELECT 1 FROM "brand_subscriptions" s WHERE s."brandId" = l."brandId")) AS subscribed
      FROM launches l WHERE l.n >= ${FREE_CAMPAIGN_LIMIT}`,
    prisma.referral.count({ where: { status: "PURCHASED", conversion: { createdAt: { lte: d7 } } } }),
    prisma.orderClaim.count({ where: { status: "PENDING", createdAt: { lte: d7 } } }),
  ]);

  const n = (v: bigint | number | undefined | null) => Number(v ?? 0);
  return {
    brandSignupCompletion: rate(brands, brandUsers),
    creatorSignupCompletion: rate(creators, creatorUsers),
    campaignActivation: rate(n(activation[0]?.activated), n(activation[0]?.launched)),
    linkUsage30d: rate(usedLinks, activeLinks),
    verifiedOrderRate: rate(verifiedOrders, decidedOrders),
    medianHoursToVerify: median[0]?.hours === null || median[0]?.hours === undefined ? null : Number(median[0].hours),
    claimResponse7d: rate(n(answeredClaims[0]?.n), oldClaims),
    brandRetention: rate(n(retention[0]?.retained), n(retention[0]?.previous)),
    contestRate: rate(contests, verifiedEver),
    paidThenReversed: rate(paidThenReversed, paidCommissions),
    planConversion: rate(n(planFunnel[0]?.subscribed), n(planFunnel[0]?.at_limit)),
    stalePurchased7d,
    staleClaims7d,
  };
}

/** Orders and buyer claims brands have left undecided for more than `days` (admin overview queue, W5). */
export async function countStaleAtBrands(days = 14, now = new Date()): Promise<number> {
  const before = new Date(now.getTime() - days * DAY);
  const [orders, claims] = await Promise.all([
    prisma.referral.count({ where: { status: "PURCHASED", conversion: { createdAt: { lte: before } } } }),
    prisma.orderClaim.count({ where: { status: "PENDING", createdAt: { lte: before } } }),
  ]);
  return orders + claims;
}
