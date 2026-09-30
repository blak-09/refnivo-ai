import { subDays, startOfDay, format } from "date-fns";
import { prisma } from "@/lib/db/prisma";

/**
 * Brand analytics computed from real database rows. Nothing here is
 * estimated or extrapolated — if a metric has no data, it is reported as 0
 * or null and the UI says so.
 */

export type BrandOverview = {
  totalCampaigns: number;
  activeCampaigns: number;
  /** ACTIVE *and* inside its date window — what the public actually sees. */
  liveCampaigns: number;
  totalProducts: number;
  totalCreators: number;
  totalCustomers: number;
  totalClicks: number;
  qrScans: number;
  totalReferrals: number;
  totalOrders: number;
  verifiedConversions: number;
  pendingVerification: number;
  revenue: number;
  pendingRewards: number;
  pendingCommissions: number;
  approvedRewardCost: number;
  approvedCommissionCost: number;
  /** revenue ÷ (approved reward + commission cost). Null when cost is zero. */
  roi: number | null;
  /** verified conversions ÷ clicks. Null when there are no clicks. */
  conversionRate: number | null;
};

export async function getBrandOverview(brandId: string, now = new Date()): Promise<BrandOverview> {
  const inBrand = { campaign: { brandId } } as const;
  const [
    totalCampaigns,
    activeCampaigns,
    liveCampaigns,
    totalProducts,
    totalCreators,
    totalCustomers,
    totalClicks,
    qrScans,
    totalReferrals,
    totalOrders,
    verifiedConversions,
    pendingVerification,
    revenue,
    pendingRewards,
    pendingCommissions,
    approvedRewards,
    approvedCommissions,
  ] = await Promise.all([
    prisma.campaign.count({ where: { brandId, status: { not: "ARCHIVED" } } }),
    prisma.campaign.count({ where: { brandId, status: "ACTIVE" } }),
    prisma.campaign.count({ where: { brandId, status: "ACTIVE", startDate: { lte: now }, OR: [{ endDate: null }, { endDate: { gte: now } }] } }),
    prisma.product.count({ where: { brandId, status: { not: "ARCHIVED" } } }),
    prisma.partnerApplication.count({ where: { ...inBrand, status: "APPROVED", partnerType: "CREATOR" } }),
    prisma.partnerApplication.count({ where: { ...inBrand, status: "APPROVED", partnerType: "CUSTOMER" } }),
    prisma.referralClick.count({ where: inBrand }),
    prisma.referralClick.count({ where: { ...inBrand, source: "QR" } }),
    prisma.referral.count({ where: inBrand }),
    prisma.conversion.count({ where: { brandId } }),
    prisma.referral.count({ where: { ...inBrand, status: "VERIFIED" } }),
    prisma.referral.count({ where: { ...inBrand, status: "PURCHASED" } }),
    prisma.conversion.aggregate({ where: { brandId, referral: { status: "VERIFIED" } }, _sum: { amount: true } }),
    prisma.reward.aggregate({ where: { referral: inBrand, status: "PENDING" }, _sum: { amount: true } }),
    prisma.commission.aggregate({ where: { referral: inBrand, status: "PENDING" }, _sum: { amount: true } }),
    prisma.reward.aggregate({ where: { referral: inBrand, status: { in: ["APPROVED", "AVAILABLE", "REDEEMED"] } }, _sum: { amount: true } }),
    prisma.commission.aggregate({ where: { referral: inBrand, status: { in: ["APPROVED", "PAID"] } }, _sum: { amount: true } }),
  ]);

  const rev = revenue._sum.amount ?? 0;
  const approvedRewardCost = approvedRewards._sum.amount ?? 0;
  const approvedCommissionCost = approvedCommissions._sum.amount ?? 0;
  const cost = approvedRewardCost + approvedCommissionCost;

  return {
    totalCampaigns,
    activeCampaigns,
    liveCampaigns,
    totalProducts,
    totalCreators,
    totalCustomers,
    totalClicks,
    qrScans,
    totalReferrals,
    totalOrders,
    verifiedConversions,
    pendingVerification,
    revenue: rev,
    pendingRewards: pendingRewards._sum.amount ?? 0,
    pendingCommissions: pendingCommissions._sum.amount ?? 0,
    approvedRewardCost,
    approvedCommissionCost,
    roi: cost > 0 ? rev / cost : null,
    conversionRate: totalClicks > 0 ? verifiedConversions / totalClicks : null,
  };
}

export type CampaignBreakdownRow = {
  campaignId: string;
  name: string;
  status: string;
  productName: string;
  clicks: number;
  referrals: number;
  verified: number;
  revenue: number;
  rewardCost: number;
  commissionCost: number;
};

export async function getCampaignBreakdown(brandId: string): Promise<CampaignBreakdownRow[]> {
  const campaigns = await prisma.campaign.findMany({
    where: { brandId, status: { not: "ARCHIVED" } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      status: true,
      product: { select: { name: true } },
      _count: { select: { referralClicks: true, referrals: true } },
    },
  });
  if (!campaigns.length) return [];

  const ids = campaigns.map((c) => c.id);
  const [verified, revenue, rewards, commissions] = await Promise.all([
    prisma.referral.groupBy({ by: ["campaignId"], where: { campaignId: { in: ids }, status: "VERIFIED" }, _count: { _all: true } }),
    prisma.referral.findMany({
      where: { campaignId: { in: ids }, status: "VERIFIED", conversion: { isNot: null } },
      select: { campaignId: true, conversion: { select: { amount: true } } },
    }),
    prisma.reward.findMany({
      where: { referral: { campaignId: { in: ids } }, status: { in: ["APPROVED", "AVAILABLE", "REDEEMED"] } },
      select: { amount: true, referral: { select: { campaignId: true } } },
    }),
    prisma.commission.findMany({
      where: { referral: { campaignId: { in: ids } }, status: { in: ["APPROVED", "PAID"] } },
      select: { amount: true, referral: { select: { campaignId: true } } },
    }),
  ]);

  const sum = (rows: { campaignId: string; amount: number }[]) => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.campaignId, (m.get(r.campaignId) ?? 0) + r.amount);
    return m;
  };
  const verifiedMap = new Map(verified.map((v) => [v.campaignId, v._count._all]));
  const revenueMap = sum(revenue.map((r) => ({ campaignId: r.campaignId, amount: r.conversion?.amount ?? 0 })));
  const rewardMap = sum(rewards.map((r) => ({ campaignId: r.referral.campaignId, amount: r.amount })));
  const commissionMap = sum(commissions.map((r) => ({ campaignId: r.referral.campaignId, amount: r.amount })));

  return campaigns.map((c) => ({
    campaignId: c.id,
    name: c.name,
    status: c.status,
    productName: c.product.name,
    clicks: c._count.referralClicks,
    referrals: c._count.referrals,
    verified: verifiedMap.get(c.id) ?? 0,
    revenue: revenueMap.get(c.id) ?? 0,
    rewardCost: rewardMap.get(c.id) ?? 0,
    commissionCost: commissionMap.get(c.id) ?? 0,
  }));
}

export type TopCreatorRow = { userId: string; name: string; username: string | null; clicks: number; verified: number; revenue: number; commission: number };

export async function getTopCreators(brandId: string, limit = 5): Promise<TopCreatorRow[]> {
  const links = await prisma.referralLink.findMany({
    where: { campaign: { brandId }, partnerType: "CREATOR" },
    select: {
      ownerId: true,
      owner: { select: { name: true, creatorProfile: { select: { username: true, displayName: true } } } },
      _count: { select: { clicks: true } },
      referrals: {
        where: { status: "VERIFIED" },
        select: { conversion: { select: { amount: true } }, commissions: { select: { amount: true, status: true } } },
      },
    },
  });
  const byUser = new Map<string, TopCreatorRow>();
  for (const l of links) {
    const row = byUser.get(l.ownerId) ?? {
      userId: l.ownerId,
      name: l.owner.creatorProfile?.displayName ?? l.owner.name,
      username: l.owner.creatorProfile?.username ?? null,
      clicks: 0,
      verified: 0,
      revenue: 0,
      commission: 0,
    };
    row.clicks += l._count.clicks;
    row.verified += l.referrals.length;
    for (const r of l.referrals) {
      row.revenue += r.conversion?.amount ?? 0;
      row.commission += r.commissions.filter((c) => c.status !== "REJECTED").reduce((s, c) => s + c.amount, 0);
    }
    byUser.set(l.ownerId, row);
  }
  return [...byUser.values()].sort((a, b) => b.revenue - a.revenue || b.verified - a.verified || b.clicks - a.clicks).slice(0, limit);
}

export type TopProductRow = { productId: string; name: string; imageUrl: string | null; campaigns: number; clicks: number; verified: number; revenue: number };

export async function getTopProducts(brandId: string, limit = 5): Promise<TopProductRow[]> {
  const products = await prisma.product.findMany({
    where: { brandId, status: { not: "ARCHIVED" } },
    select: {
      id: true,
      name: true,
      imageUrl: true,
      campaigns: {
        select: {
          _count: { select: { referralClicks: true } },
          referrals: { where: { status: "VERIFIED" }, select: { conversion: { select: { amount: true } } } },
        },
      },
    },
  });
  return products
    .map((p) => ({
      productId: p.id,
      name: p.name,
      imageUrl: p.imageUrl,
      campaigns: p.campaigns.length,
      clicks: p.campaigns.reduce((s, c) => s + c._count.referralClicks, 0),
      verified: p.campaigns.reduce((s, c) => s + c.referrals.length, 0),
      revenue: p.campaigns.reduce((s, c) => s + c.referrals.reduce((t, r) => t + (r.conversion?.amount ?? 0), 0), 0),
    }))
    .sort((a, b) => b.revenue - a.revenue || b.verified - a.verified || b.clicks - a.clicks)
    .slice(0, limit);
}

export type DailyPoint = { date: string; label: string; creator: number; customer: number; total: number };

/** Referrals created per day for the last `days` days, split by partner type. */
export async function getReferralsOverTime(brandId: string, days = 30): Promise<DailyPoint[]> {
  const since = startOfDay(subDays(new Date(), days - 1));
  const rows = await prisma.referral.findMany({
    where: { campaign: { brandId }, createdAt: { gte: since } },
    select: { createdAt: true, referralLink: { select: { partnerType: true } } },
  });

  const buckets = new Map<string, DailyPoint>();
  for (let i = 0; i < days; i++) {
    const d = subDays(new Date(), days - 1 - i);
    const key = format(d, "yyyy-MM-dd");
    buckets.set(key, { date: key, label: format(d, "d MMM"), creator: 0, customer: 0, total: 0 });
  }
  for (const r of rows) {
    const b = buckets.get(format(r.createdAt, "yyyy-MM-dd"));
    if (!b) continue;
    if (r.referralLink.partnerType === "CREATOR") b.creator += 1;
    else b.customer += 1;
    b.total += 1;
  }
  return [...buckets.values()];
}

export async function getPartnerTypeSplit(brandId: string) {
  const byType = await prisma.referralLink.findMany({
    where: { campaign: { brandId } },
    select: { partnerType: true, _count: { select: { referrals: true } } },
  });
  const creator = byType.filter((l) => l.partnerType === "CREATOR").reduce((s, l) => s + l._count.referrals, 0);
  const customer = byType.filter((l) => l.partnerType === "CUSTOMER").reduce((s, l) => s + l._count.referrals, 0);
  return { creator, customer };
}

// ---------------------------------------------------------------------------
// Partner-side analytics (creator / customer)
// ---------------------------------------------------------------------------

export async function getPartnerStats(userId: string) {
  const [clicks, qrScans, referrals, verified, purchased, sales, pending, approved, paid, rewardsPending, rewardsAvailable, rewardsRedeemed] =
    await Promise.all([
      prisma.referralClick.count({ where: { referralLink: { ownerId: userId } } }),
      prisma.referralClick.count({ where: { referralLink: { ownerId: userId }, source: "QR" } }),
      prisma.referral.count({ where: { referrerId: userId } }),
      prisma.referral.count({ where: { referrerId: userId, status: "VERIFIED" } }),
      prisma.referral.count({ where: { referrerId: userId, status: "PURCHASED" } }),
      prisma.conversion.aggregate({ where: { referral: { referrerId: userId, status: "VERIFIED" } }, _sum: { amount: true } }),
      prisma.commission.aggregate({ where: { creatorId: userId, status: "PENDING" }, _sum: { amount: true } }),
      prisma.commission.aggregate({ where: { creatorId: userId, status: "APPROVED" }, _sum: { amount: true } }),
      prisma.commission.aggregate({ where: { creatorId: userId, status: "PAID" }, _sum: { amount: true } }),
      prisma.reward.aggregate({ where: { recipientId: userId, status: "PENDING" }, _sum: { amount: true } }),
      prisma.reward.aggregate({ where: { recipientId: userId, status: { in: ["APPROVED", "AVAILABLE"] } }, _sum: { amount: true } }),
      prisma.reward.aggregate({ where: { recipientId: userId, status: "REDEEMED" }, _sum: { amount: true } }),
    ]);
  return {
    clicks,
    qrScans,
    referrals,
    verified,
    purchased,
    sales: sales._sum.amount ?? 0,
    conversionRate: clicks > 0 ? verified / clicks : null,
    commissionPending: pending._sum.amount ?? 0,
    commissionApproved: approved._sum.amount ?? 0,
    commissionPaid: paid._sum.amount ?? 0,
    rewardsPending: rewardsPending._sum.amount ?? 0,
    rewardsAvailable: rewardsAvailable._sum.amount ?? 0,
    rewardsRedeemed: rewardsRedeemed._sum.amount ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Tracking & time series (brand Tracking page, analytics range filters)
// ---------------------------------------------------------------------------

export type TrackingLinkRow = {
  id: string;
  code: string;
  source: string;
  status: string;
  partnerType: "CREATOR" | "CUSTOMER";
  partnerName: string;
  partnerUsername: string | null;
  campaignId: string;
  campaignName: string;
  clicks: number;
  conversions: number;
  revenue: number;
  commission: number;
};

/**
 * Every referral link on the brand's campaigns with what it actually produced:
 * recorded clicks, verified conversions, verified revenue and non-rejected
 * commission. Busiest links first.
 */
export async function getBrandTrackingLinks(brandId: string, filters: { campaignId?: string; partnerType?: "CREATOR" | "CUSTOMER" } = {}, limit = 200): Promise<TrackingLinkRow[]> {
  const links = await prisma.referralLink.findMany({
    where: { campaign: { brandId }, ...(filters.campaignId ? { campaignId: filters.campaignId } : {}), ...(filters.partnerType ? { partnerType: filters.partnerType } : {}) },
    select: {
      id: true,
      code: true,
      source: true,
      status: true,
      partnerType: true,
      campaignId: true,
      campaign: { select: { name: true } },
      owner: { select: { name: true, creatorProfile: { select: { username: true, displayName: true } } } },
      _count: { select: { clicks: true } },
      referrals: {
        where: { status: "VERIFIED" },
        select: { conversion: { select: { amount: true } }, commissions: { select: { amount: true, status: true } } },
      },
    },
    take: 1000,
  });
  return links
    .map((l) => ({
      id: l.id,
      code: l.code,
      source: l.source,
      status: l.status,
      partnerType: l.partnerType,
      partnerName: l.owner.creatorProfile?.displayName ?? l.owner.name,
      partnerUsername: l.owner.creatorProfile?.username ?? null,
      campaignId: l.campaignId,
      campaignName: l.campaign.name,
      clicks: l._count.clicks,
      conversions: l.referrals.length,
      revenue: l.referrals.reduce((s, r) => s + (r.conversion?.amount ?? 0), 0),
      commission: l.referrals.reduce((s, r) => s + r.commissions.filter((c) => c.status !== "REJECTED").reduce((t, c) => t + c.amount, 0), 0),
    }))
    .sort((a, b) => b.revenue - a.revenue || b.conversions - a.conversions || b.clicks - a.clicks)
    .slice(0, limit);
}

export type SeriesPoint = { date: string; label: string; clicks: number; conversions: number; revenue: number };

function emptySeries(days: number): Map<string, SeriesPoint> {
  const buckets = new Map<string, SeriesPoint>();
  for (let i = 0; i < days; i++) {
    const d = subDays(new Date(), days - 1 - i);
    const key = format(d, "yyyy-MM-dd");
    buckets.set(key, { date: key, label: format(d, "d MMM"), clicks: 0, conversions: 0, revenue: 0 });
  }
  return buckets;
}

/** Daily clicks, verified conversions and verified revenue for a brand over the last `days` days. */
export async function getBrandSeries(brandId: string, days = 30): Promise<SeriesPoint[]> {
  const since = startOfDay(subDays(new Date(), days - 1));
  const [clicks, conversions] = await Promise.all([
    prisma.referralClick.findMany({ where: { campaign: { brandId }, createdAt: { gte: since } }, select: { createdAt: true } }),
    prisma.conversion.findMany({ where: { brandId, referral: { status: "VERIFIED" }, reversedAt: null, verifiedAt: { gte: since } }, select: { verifiedAt: true, amount: true } }),
  ]);
  const buckets = emptySeries(days);
  for (const c of clicks) {
    const b = buckets.get(format(c.createdAt, "yyyy-MM-dd"));
    if (b) b.clicks += 1;
  }
  for (const c of conversions) {
    const b = c.verifiedAt ? buckets.get(format(c.verifiedAt, "yyyy-MM-dd")) : undefined;
    if (b) {
      b.conversions += 1;
      b.revenue += c.amount;
    }
  }
  return [...buckets.values()];
}

/** Daily clicks, verified conversions and verified revenue for one partner (creator/customer). */
export async function getPartnerSeries(userId: string, days = 30): Promise<SeriesPoint[]> {
  const since = startOfDay(subDays(new Date(), days - 1));
  const [clicks, conversions] = await Promise.all([
    prisma.referralClick.findMany({ where: { referralLink: { ownerId: userId }, createdAt: { gte: since } }, select: { createdAt: true } }),
    prisma.conversion.findMany({ where: { referral: { referrerId: userId, status: "VERIFIED" }, reversedAt: null, verifiedAt: { gte: since } }, select: { verifiedAt: true, amount: true } }),
  ]);
  const buckets = emptySeries(days);
  for (const c of clicks) {
    const b = buckets.get(format(c.createdAt, "yyyy-MM-dd"));
    if (b) b.clicks += 1;
  }
  for (const c of conversions) {
    const b = c.verifiedAt ? buckets.get(format(c.verifiedAt, "yyyy-MM-dd")) : undefined;
    if (b) {
      b.conversions += 1;
      b.revenue += c.amount;
    }
  }
  return [...buckets.values()];
}

/** Per-campaign performance for one partner: clicks, verified conversions, revenue and commission. */
export async function getPartnerCampaignPerformance(userId: string) {
  const links = await prisma.referralLink.findMany({
    where: { ownerId: userId },
    select: {
      campaignId: true,
      campaign: { select: { name: true, slug: true, brand: { select: { name: true } }, product: { select: { name: true } } } },
      _count: { select: { clicks: true } },
      referrals: { where: { status: "VERIFIED" }, select: { conversion: { select: { amount: true } }, commissions: { select: { amount: true, status: true } } } },
    },
  });
  const byCampaign = new Map<string, { campaignId: string; name: string; slug: string; brand: string; product: string; clicks: number; conversions: number; revenue: number; commission: number }>();
  for (const l of links) {
    const row = byCampaign.get(l.campaignId) ?? {
      campaignId: l.campaignId,
      name: l.campaign.name,
      slug: l.campaign.slug,
      brand: l.campaign.brand.name,
      product: l.campaign.product.name,
      clicks: 0,
      conversions: 0,
      revenue: 0,
      commission: 0,
    };
    row.clicks += l._count.clicks;
    row.conversions += l.referrals.length;
    for (const r of l.referrals) {
      row.revenue += r.conversion?.amount ?? 0;
      row.commission += r.commissions.filter((c) => c.status !== "REJECTED").reduce((s, c) => s + c.amount, 0);
    }
    byCampaign.set(l.campaignId, row);
  }
  return [...byCampaign.values()].sort((a, b) => b.revenue - a.revenue || b.conversions - a.conversions || b.clicks - a.clicks);
}

/** Allowed analytics windows (days). "Today" is a 1-day window. */
export const RANGE_OPTIONS = [
  { value: "1", label: "Today" },
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
] as const;

export function parseRange(value: string | undefined, fallback = 30): number {
  const n = Number(value);
  return RANGE_OPTIONS.some((o) => Number(o.value) === n) ? n : fallback;
}
