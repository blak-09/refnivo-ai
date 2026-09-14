import { Prisma, type Campaign, type CampaignStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { canEdit, canTransition, isCampaignLive, publishProblems, TRANSITIONS } from "@/lib/domain/campaign-rules";
import { toCampaignData, type CampaignAction, type CampaignFormValues } from "@/lib/validation/campaign";
import { recordAudit } from "./audit";
import { uniqueSlug } from "./brands";

export class CampaignError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CampaignError";
  }
}

const slugExists = (tx: Prisma.TransactionClient, excludeId?: string) => async (s: string) =>
  !!(await tx.campaign.findFirst({ where: { slug: s, ...(excludeId ? { NOT: { id: excludeId } } : {}) }, select: { id: true } }));

// ---------------------------------------------------------------------------
// Brand-scoped reads — every query is scoped by brandId so Brand A can never
// read Brand B's campaigns.
// ---------------------------------------------------------------------------

export const campaignListInclude = {
  product: { select: { id: true, name: true, slug: true, imageUrl: true, price: true, currency: true, category: true } },
  _count: { select: { partnerApplications: true, referralLinks: true, referrals: true, referralClicks: true } },
} satisfies Prisma.CampaignInclude;

export type CampaignListItem = Prisma.CampaignGetPayload<{ include: typeof campaignListInclude }>;

export async function listCampaigns(brandId: string, status?: CampaignStatus | "ALL"): Promise<CampaignListItem[]> {
  return prisma.campaign.findMany({
    where: { brandId, ...(status && status !== "ALL" ? { status } : {}) },
    orderBy: [{ updatedAt: "desc" }],
    include: campaignListInclude,
  });
}

export async function getCampaign(brandId: string, campaignId: string) {
  return prisma.campaign.findFirst({ where: { id: campaignId, brandId }, include: { product: true } });
}

export async function getCampaignWithStats(brandId: string, campaignId: string) {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, brandId },
    include: {
      product: true,
      _count: { select: { partnerApplications: true, referralLinks: true, referralClicks: true, referrals: true } },
    },
  });
  if (!campaign) return null;

  const [approvedCreators, approvedCustomers, verifiedReferrals, revenue, rewardCost, commissionCost, qrClicks] = await Promise.all([
    prisma.partnerApplication.count({ where: { campaignId, status: "APPROVED", partnerType: "CREATOR" } }),
    prisma.partnerApplication.count({ where: { campaignId, status: "APPROVED", partnerType: "CUSTOMER" } }),
    prisma.referral.count({ where: { campaignId, status: "VERIFIED" } }),
    prisma.conversion.aggregate({ where: { referral: { campaignId, status: "VERIFIED" } }, _sum: { amount: true } }),
    prisma.reward.aggregate({ where: { referral: { campaignId }, status: { in: ["APPROVED", "AVAILABLE", "REDEEMED"] } }, _sum: { amount: true } }),
    prisma.commission.aggregate({ where: { referral: { campaignId }, status: { in: ["APPROVED", "PAID"] } }, _sum: { amount: true } }),
    prisma.referralClick.count({ where: { campaignId, source: "QR" } }),
  ]);

  return {
    campaign,
    stats: {
      approvedCreators,
      approvedCustomers,
      verifiedReferrals,
      revenue: revenue._sum.amount ?? 0,
      rewardCost: rewardCost._sum.amount ?? 0,
      commissionCost: commissionCost._sum.amount ?? 0,
      qrClicks,
    },
  };
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

async function assertProductBelongsToBrand(tx: Prisma.TransactionClient, brandId: string, productId: string) {
  const product = await tx.product.findFirst({ where: { id: productId, brandId }, select: { id: true, status: true } });
  if (!product) throw new CampaignError("Select one of your own products.");
  if (product.status === "ARCHIVED") throw new CampaignError("This product is archived. Choose an active product.");
  return product;
}

export async function createCampaign(brandId: string, brandName: string, userId: string, values: CampaignFormValues) {
  const data = toCampaignData(values);
  return prisma.$transaction(async (tx) => {
    await assertProductBelongsToBrand(tx, brandId, values.productId);
    const slug = await uniqueSlug(`${brandName} ${values.name}`, slugExists(tx));
    const campaign = await tx.campaign.create({ data: { brandId, slug, status: "DRAFT", ...data } });
    await recordAudit(
      { userId, action: "CAMPAIGN_CREATED", entityType: "Campaign", entityId: campaign.id, metadata: { brandId, name: campaign.name, productId: campaign.productId } },
      tx,
    );
    return campaign;
  });
}

export async function updateCampaign(brandId: string, brandName: string, userId: string, campaignId: string, values: CampaignFormValues) {
  const data = toCampaignData(values);
  return prisma.$transaction(async (tx) => {
    const existing = await tx.campaign.findFirst({ where: { id: campaignId, brandId } });
    if (!existing) throw new CampaignError("Campaign not found.");
    if (!canEdit(existing.status)) throw new CampaignError("Ended or archived campaigns cannot be edited.");
    if (existing.productId !== values.productId) {
      if (existing.status !== "DRAFT") throw new CampaignError("The product cannot be changed after a campaign is published.");
      await assertProductBelongsToBrand(tx, brandId, values.productId);
    }

    const slug = existing.name === values.name ? existing.slug : await uniqueSlug(`${brandName} ${values.name}`, slugExists(tx, campaignId));
    const campaign = await tx.campaign.update({ where: { id: campaignId }, data: { slug, ...data } });
    await recordAudit(
      {
        userId,
        action: "CAMPAIGN_UPDATED",
        entityType: "Campaign",
        entityId: campaignId,
        metadata: {
          brandId,
          rewardChanged: existing.customerRewardValue !== campaign.customerRewardValue || existing.rewardType !== campaign.rewardType,
          commissionChanged:
            existing.creatorCommissionValue !== campaign.creatorCommissionValue ||
            existing.creatorCommissionType !== campaign.creatorCommissionType,
        },
      },
      tx,
    );
    return campaign;
  });
}

/**
 * Applies a lifecycle action. Publishing requires explicit owner confirmation
 * and a passing pre-flight validation (dates, reward rules, budget, product).
 */
export async function transitionCampaign(
  brandId: string,
  userId: string,
  campaignId: string,
  action: CampaignAction,
  opts: { confirmed?: boolean; now?: Date } = {},
) {
  const now = opts.now ?? new Date();
  return prisma.$transaction(async (tx) => {
    const existing = await tx.campaign.findFirst({ where: { id: campaignId, brandId }, include: { product: { select: { status: true } } } });
    if (!existing) throw new CampaignError("Campaign not found.");
    if (!canTransition(existing.status, action)) {
      throw new CampaignError(`This campaign cannot be ${action.toLowerCase()}ed from its current status.`);
    }

    if (action === "PUBLISH" || action === "RESUME") {
      const problems = publishProblems(existing, now);
      if (existing.product.status !== "ACTIVE") problems.push("The promoted product must be active.");
      if (problems.length) throw new CampaignError(problems.join(" "));
      if (action === "PUBLISH" && !opts.confirmed) throw new CampaignError("Please confirm the campaign rules before publishing.");
    }

    const to = TRANSITIONS[action].to;
    const campaign = await tx.campaign.update({
      where: { id: campaignId },
      data: { status: to, ...(action === "PUBLISH" ? { publishedAt: now } : {}) },
    });
    await recordAudit(
      { userId, action: `CAMPAIGN_${action}`, entityType: "Campaign", entityId: campaignId, metadata: { brandId, from: existing.status, to } },
      tx,
    );
    return campaign;
  });
}

export async function deleteDraftCampaign(brandId: string, userId: string, campaignId: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.campaign.findFirst({ where: { id: campaignId, brandId } });
    if (!existing) throw new CampaignError("Campaign not found.");
    if (existing.status !== "DRAFT") throw new CampaignError("Only draft campaigns can be deleted. Archive it instead.");
    await tx.campaign.delete({ where: { id: campaignId } });
    await recordAudit(
      { userId, action: "CAMPAIGN_DELETED", entityType: "Campaign", entityId: campaignId, metadata: { brandId, name: existing.name } },
      tx,
    );
  });
}

// ---------------------------------------------------------------------------
// Public marketplace reads
// ---------------------------------------------------------------------------

export const marketplaceCampaignSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  campaignType: true,
  rewardType: true,
  customerRewardValue: true,
  creatorCommissionType: true,
  creatorCommissionValue: true,
  currency: true,
  requiresApproval: true,
  startDate: true,
  endDate: true,
  publishedAt: true,
  product: { select: { id: true, name: true, slug: true, imageUrl: true, price: true, currency: true, category: true } },
  brand: { select: { id: true, name: true, slug: true, logoUrl: true, verificationStatus: true, industry: true } },
  _count: {
    select: {
      partnerApplications: { where: { status: "APPROVED", partnerType: "CREATOR" } },
      referralClicks: true,
    },
  },
} satisfies Prisma.CampaignSelect;

export type MarketplaceCampaign = Prisma.CampaignGetPayload<{ select: typeof marketplaceCampaignSelect }>;

export type MarketplaceSort = "newest" | "commission" | "trending" | "ending";

export type MarketplaceFilters = {
  category?: string;
  industry?: string;
  type?: "CREATOR_AFFILIATE" | "CUSTOMER_REFERRAL" | "HYBRID";
  sort?: MarketplaceSort;
  q?: string;
};

/**
 * Live campaigns for the public marketplace. "Live" = ACTIVE and inside the
 * date window; the date check is applied in memory so the definition stays in
 * one place (`isCampaignLive`).
 */
export async function listMarketplaceCampaigns(filters: MarketplaceFilters = {}): Promise<MarketplaceCampaign[]> {
  const now = new Date();
  const rows = await prisma.campaign.findMany({
    where: {
      status: "ACTIVE",
      brand: { status: "ACTIVE" },
      product: { status: "ACTIVE", ...(filters.category ? { category: filters.category } : {}) },
      ...(filters.industry ? { brand: { status: "ACTIVE", industry: filters.industry } } : {}),
      ...(filters.type ? { campaignType: filters.type } : {}),
      ...(filters.q
        ? {
            OR: [
              { name: { contains: filters.q, mode: "insensitive" } },
              { product: { name: { contains: filters.q, mode: "insensitive" } } },
              { brand: { name: { contains: filters.q, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    select: marketplaceCampaignSelect,
  });

  const live = rows.filter((c) => isCampaignLive({ status: "ACTIVE", startDate: c.startDate, endDate: c.endDate }, now));

  // Comparable commission value: percentage → estimated rupees on the product price.
  const commissionValue = (c: MarketplaceCampaign) =>
    c.creatorCommissionType === "PERCENTAGE" ? Math.round((c.product.price * c.creatorCommissionValue) / 10_000) : c.creatorCommissionValue;

  switch (filters.sort) {
    case "commission":
      return live.sort((a, b) => commissionValue(b) - commissionValue(a));
    case "trending":
      return live.sort((a, b) => b._count.referralClicks - a._count.referralClicks || b._count.partnerApplications - a._count.partnerApplications);
    case "ending":
      return live
        .filter((c) => c.endDate)
        .sort((a, b) => a.endDate!.getTime() - b.endDate!.getTime());
    case "newest":
    default:
      return live.sort((a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0));
  }
}

export async function getPublicCampaign(slug: string) {
  const campaign = await prisma.campaign.findFirst({
    where: { slug, status: { in: ["ACTIVE", "PAUSED", "ENDED"] }, brand: { status: "ACTIVE" } },
    include: {
      product: true,
      brand: { select: { id: true, name: true, slug: true, logoUrl: true, tagline: true, verificationStatus: true, website: true, industry: true } },
      _count: { select: { partnerApplications: { where: { status: "APPROVED", partnerType: "CREATOR" } }, referralClicks: true } },
    },
  });
  return campaign;
}

export function estimatedCommissionMinor(c: {
  creatorCommissionType: "FIXED_AMOUNT" | "PERCENTAGE";
  creatorCommissionValue: number;
  product: { price: number };
}): number {
  return c.creatorCommissionType === "PERCENTAGE" ? Math.round((c.product.price * c.creatorCommissionValue) / 10_000) : c.creatorCommissionValue;
}

export type { Campaign };
