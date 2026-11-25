import { prisma } from "@/lib/db/prisma";
import { listMarketplaceCampaigns, type MarketplaceCampaign } from "@/lib/services/campaigns";
import { countPendingClaims } from "@/lib/services/order-claims";
import { getWalletSummary, pendingWalletExposure, walletEnabled } from "@/lib/services/wallet";

/**
 * Read-only queries behind the dashboard overviews: what needs the brand's
 * attention, and which live campaigns a partner could join next. Nothing here
 * writes; every count comes from the same tables the detail pages read.
 */

export type BrandAttention = {
  ordersToVerify: number;
  applications: number;
  buyerClaims: number;
  incomingConnections: number;
  ugcToReview: number;
  ugcToPay: number;
  campaignsInReview: number;
  /** Set only when the wallet is enabled and its balance is below what pending orders would cost. */
  walletShortfall: { balance: number; owed: number } | null;
};

export async function getBrandAttention(brandId: string): Promise<BrandAttention> {
  const [ordersToVerify, applications, buyerClaims, incomingConnections, ugcToReview, ugcToPay, campaignsInReview, wallet] = await Promise.all([
    prisma.referral.count({ where: { campaign: { brandId }, status: "PURCHASED" } }),
    prisma.partnerApplication.count({ where: { status: "PENDING", campaign: { brandId } } }),
    countPendingClaims(brandId),
    prisma.connection.count({ where: { brandId, status: "PENDING", initiator: "CREATOR" } }),
    prisma.ugcCollaboration.count({ where: { brief: { brandId }, status: { in: ["APPLIED", "SUBMITTED"] } } }),
    prisma.ugcCollaboration.count({ where: { brief: { brandId }, status: "APPROVED", paidMarkedAt: null } }),
    prisma.campaign.count({ where: { brandId, status: "PENDING_REVIEW" } }),
    walletEnabled() ? Promise.all([getWalletSummary(brandId, 0), pendingWalletExposure(brandId)]) : Promise.resolve(null),
  ]);
  const walletShortfall = wallet && wallet[0].balance < wallet[1].amount ? { balance: wallet[0].balance, owed: wallet[1].amount } : null;
  return { ordersToVerify, applications, buyerClaims, incomingConnections, ugcToReview, ugcToPay, campaignsInReview, walletShortfall };
}

/**
 * Live campaigns a partner has not joined yet, best match first: campaigns
 * whose product category is in `categories` come before the rest; within each
 * group the marketplace's newest-first order is kept.
 */
export async function recommendCampaigns({
  userId,
  audience,
  categories,
  limit = 3,
}: {
  userId: string;
  audience: "CREATOR" | "CUSTOMER";
  categories: readonly string[];
  limit?: number;
}): Promise<{ campaigns: MarketplaceCampaign[]; matched: boolean }> {
  const [live, joined] = await Promise.all([
    listMarketplaceCampaigns({ sort: "newest" }),
    prisma.partnerApplication.findMany({ where: { userId }, select: { campaignId: true } }),
  ]);
  const joinedIds = new Set(joined.map((j) => j.campaignId));
  const excluded = audience === "CREATOR" ? "CUSTOMER_REFERRAL" : "CREATOR_AFFILIATE";
  const open = live.filter((c) => c.campaignType !== excluded && !joinedIds.has(c.id));
  const wanted = new Set(categories);
  const matches = open.filter((c) => c.product.category && wanted.has(c.product.category));
  const rest = open.filter((c) => !matches.includes(c));
  return { campaigns: [...matches, ...rest].slice(0, limit), matched: matches.length > 0 };
}
