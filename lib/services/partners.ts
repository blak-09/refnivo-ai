import type { ApplicationStatus, PartnerType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { isCampaignLive } from "@/lib/domain/campaign-rules";
import { generateReferralCode } from "@/lib/utils/codes";
import { recordAudit } from "./audit";

export class PartnerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PartnerError";
  }
}

type Tx = Prisma.TransactionClient;

/** Creator fields a brand needs to evaluate an application. Never includes email/phone. */
export const creatorReviewSelect = {
  displayName: true,
  username: true,
  profileImageUrl: true,
  bio: true,
  category: true,
  location: true,
  instagramHandle: true,
  instagramUrl: true,
  instagramFollowers: true,
  youtubeChannel: true,
  youtubeUrl: true,
  youtubeSubscribers: true,
  twitterHandle: true,
  twitterUrl: true,
  averageViews: true,
  engagementRate: true,
  audienceCategory: true,
  audienceLocation: true,
  previousCampaigns: true,
  contentSamples: true,
  verificationStatus: true,
} satisfies Prisma.CreatorProfileSelect;

// ---------------------------------------------------------------------------
// Brand side
// ---------------------------------------------------------------------------

export async function listPartnerApplications(brandId: string, status?: ApplicationStatus | "ALL", partnerType?: PartnerType) {
  return prisma.partnerApplication.findMany({
    where: {
      campaign: { brandId },
      ...(status && status !== "ALL" ? { status } : {}),
      ...(partnerType ? { partnerType } : {}),
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      status: true,
      partnerType: true,
      message: true,
      createdAt: true,
      campaign: { select: { id: true, name: true, status: true, product: { select: { name: true } } } },
      user: { select: { id: true, name: true, creatorProfile: { select: creatorReviewSelect } } },
    },
  });
}

export async function countPartnersByStatus(brandId: string) {
  const rows = await prisma.partnerApplication.groupBy({
    by: ["status"],
    where: { campaign: { brandId } },
    _count: { _all: true },
  });
  const out: Record<ApplicationStatus, number> = { PENDING: 0, APPROVED: 0, REJECTED: 0 };
  for (const r of rows) out[r.status] = r._count._all;
  return out;
}

/**
 * Approve or reject an application. On approval a referral link is created
 * for the partner (idempotent — one link per partner per campaign).
 */
export async function decideApplication(
  brandId: string,
  actorId: string,
  applicationId: string,
  decision: Extract<ApplicationStatus, "APPROVED" | "REJECTED">,
) {
  return prisma.$transaction(async (tx) => {
    const application = await tx.partnerApplication.findFirst({
      where: { id: applicationId, campaign: { brandId } },
      include: {
        campaign: { select: { id: true, status: true, brand: { select: { name: true } } } },
        user: { select: { name: true, creatorProfile: { select: { username: true } } } },
      },
    });
    if (!application) throw new PartnerError("Application not found.");
    if (application.status !== "PENDING") throw new PartnerError("This application has already been reviewed.");

    const updated = await tx.partnerApplication.update({ where: { id: applicationId }, data: { status: decision } });

    if (decision === "APPROVED") {
      await ensureReferralLink(tx, {
        campaignId: application.campaign.id,
        ownerId: application.userId,
        partnerType: application.partnerType,
        handle: application.user.creatorProfile?.username ?? application.user.name,
        brandName: application.campaign.brand.name,
      });
    }

    await recordAudit(
      {
        userId: actorId,
        action: decision === "APPROVED" ? "PARTNER_APPROVED" : "PARTNER_REJECTED",
        entityType: "PartnerApplication",
        entityId: applicationId,
        metadata: { brandId, campaignId: application.campaign.id, partnerType: application.partnerType },
      },
      tx,
    );
    return updated;
  });
}

// ---------------------------------------------------------------------------
// Partner side (creators & customers)
// ---------------------------------------------------------------------------

export type JoinResult = { status: "APPROVED" | "PENDING"; code: string | null };

/**
 * A creator or customer joins a campaign.
 *  - Customers, and creators on campaigns without approval, get a link instantly.
 *  - Creators on approval-required campaigns create a PENDING application.
 * Idempotent: re-joining returns the current state.
 */
export async function joinCampaign(
  user: { id: string; name: string; role: "CREATOR" | "CUSTOMER" },
  campaignId: string,
  message?: string | null,
): Promise<JoinResult> {
  return prisma.$transaction(async (tx) => {
    const campaign = await tx.campaign.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        status: true,
        startDate: true,
        endDate: true,
        campaignType: true,
        requiresApproval: true,
        brandId: true,
        brand: { select: { name: true, ownerId: true, status: true } },
      },
    });
    if (!campaign || campaign.brand.status !== "ACTIVE") throw new PartnerError("Campaign not found.");
    if (!isCampaignLive(campaign)) throw new PartnerError("This campaign is not accepting new partners right now.");
    if (campaign.brand.ownerId === user.id) throw new PartnerError("You cannot join your own campaign.");

    const partnerType: PartnerType = user.role === "CREATOR" ? "CREATOR" : "CUSTOMER";
    if (partnerType === "CREATOR" && campaign.campaignType === "CUSTOMER_REFERRAL") {
      throw new PartnerError("This campaign is for customers only.");
    }
    if (partnerType === "CUSTOMER" && campaign.campaignType === "CREATOR_AFFILIATE") {
      throw new PartnerError("This campaign is for creators only.");
    }

    const existing = await tx.partnerApplication.findUnique({ where: { campaignId_userId: { campaignId, userId: user.id } } });
    if (existing?.status === "REJECTED") throw new PartnerError("Your application to this campaign was not approved.");

    const profile = partnerType === "CREATOR" ? await tx.creatorProfile.findUnique({ where: { userId: user.id }, select: { username: true } }) : null;
    const handle = profile?.username ?? user.name;
    const autoApprove = partnerType === "CUSTOMER" || !campaign.requiresApproval;

    if (existing?.status === "APPROVED" || (existing?.status === "PENDING" && !autoApprove)) {
      const link = existing.status === "APPROVED" ? await tx.referralLink.findUnique({ where: { campaignId_ownerId: { campaignId, ownerId: user.id } } }) : null;
      return { status: existing.status, code: link?.code ?? null };
    }

    const status: ApplicationStatus = autoApprove ? "APPROVED" : "PENDING";
    if (existing) {
      await tx.partnerApplication.update({ where: { id: existing.id }, data: { status, message: message || existing.message } });
    } else {
      await tx.partnerApplication.create({ data: { campaignId, userId: user.id, partnerType, status, message: message || null } });
    }

    let code: string | null = null;
    if (autoApprove) {
      const link = await ensureReferralLink(tx, { campaignId, ownerId: user.id, partnerType, handle, brandName: campaign.brand.name });
      code = link.code;
    }

    await recordAudit(
      {
        userId: user.id,
        action: autoApprove ? "CAMPAIGN_JOINED" : "CAMPAIGN_APPLIED",
        entityType: "Campaign",
        entityId: campaignId,
        metadata: { brandId: campaign.brandId, partnerType },
      },
      tx,
    );
    return { status, code };
  });
}

export async function ensureReferralLink(
  tx: Tx,
  input: { campaignId: string; ownerId: string; partnerType: PartnerType; handle: string; brandName: string },
) {
  const existing = await tx.referralLink.findUnique({ where: { campaignId_ownerId: { campaignId: input.campaignId, ownerId: input.ownerId } } });
  if (existing) return existing;

  // Retry on the (unlikely) code collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateReferralCode(input.handle, input.brandName);
    const taken = await tx.referralLink.findUnique({ where: { code }, select: { id: true } });
    if (taken) continue;
    return tx.referralLink.create({ data: { campaignId: input.campaignId, ownerId: input.ownerId, partnerType: input.partnerType, code } });
  }
  throw new PartnerError("Could not generate a unique referral code. Please try again.");
}

/** The partner's own status for a campaign (used on the public campaign page). */
export async function getPartnerStatus(userId: string, campaignId: string) {
  const [application, link] = await Promise.all([
    prisma.partnerApplication.findUnique({ where: { campaignId_userId: { campaignId, userId } }, select: { status: true } }),
    prisma.referralLink.findUnique({ where: { campaignId_ownerId: { campaignId, ownerId: userId } }, select: { code: true, status: true } }),
  ]);
  return { applicationStatus: application?.status ?? null, code: link?.status === "ACTIVE" ? link.code : null };
}
