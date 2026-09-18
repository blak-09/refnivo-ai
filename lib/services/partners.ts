import type { ApplicationStatus, PartnerType, Prisma } from "@prisma/client";
import { prisma, transaction } from "@/lib/db/prisma";
import { isCampaignLive } from "@/lib/domain/campaign-rules";
import { generateCustomerReferralCode, generateReferralCode } from "@/lib/utils/codes";
import { recordAudit } from "./audit";
import { notify } from "./notify";

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
  const out: Record<ApplicationStatus, number> = { PENDING: 0, APPROVED: 0, REJECTED: 0, WITHDRAWN: 0, REMOVED: 0 };
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
  return transaction(async (tx) => {
    const application = await tx.partnerApplication.findFirst({
      where: { id: applicationId, campaign: { brandId } },
      include: {
        campaign: { select: { id: true, name: true, status: true, brand: { select: { name: true } } } },
        user: { select: { name: true, creatorProfile: { select: { username: true } } } },
      },
    });
    if (!application) throw new PartnerError("Application not found.");
    if (application.status !== "PENDING") throw new PartnerError("This application has already been reviewed.");

    const updated = await tx.partnerApplication.update({ where: { id: applicationId }, data: { status: decision } });
    const partnerHome = application.partnerType === "CREATOR" ? "/dashboard/creator" : "/dashboard/customer";
    await notify(
      {
        userId: application.userId,
        type: decision === "APPROVED" ? "APPLICATION_APPROVED" : "APPLICATION_REJECTED",
        idempotencyKey: `application:${applicationId}:${decision}`,
        title: decision === "APPROVED" ? `You're in: ${application.campaign.name}` : `Application not approved: ${application.campaign.name}`,
        body:
          decision === "APPROVED"
            ? `${application.campaign.brand.name} approved your application. Your referral link and QR code are ready.`
            : `${application.campaign.brand.name} did not approve your application this time.`,
        href: decision === "APPROVED" ? `${partnerHome}/links` : `${partnerHome}/campaigns`,
        email: true,
      },
      tx,
    );

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
  return transaction(async (tx) => {
    const campaign = await tx.campaign.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        name: true,
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
    if (existing?.status === "REMOVED") throw new PartnerError("The brand removed you from this campaign.");

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

    if (!autoApprove) {
      await notify(
        {
          userId: campaign.brand.ownerId,
          type: "APPLICATION_RECEIVED",
          title: `New creator application: ${campaign.name}`,
          body: `${handle} applied to join your campaign. Review it in Applications.`,
          href: "/dashboard/brand/creators",
          email: true,
        },
        tx,
      );
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

/** A partner withdraws their own PENDING application. Approved partners cannot withdraw (their link may already be in use). */
export async function withdrawApplication(userId: string, applicationId: string) {
  return transaction(async (tx) => {
    const application = await tx.partnerApplication.findFirst({
      where: { id: applicationId, userId },
      select: { id: true, status: true, campaignId: true, campaign: { select: { brandId: true } } },
    });
    if (!application) throw new PartnerError("Application not found.");
    if (application.status !== "PENDING") throw new PartnerError("Only pending applications can be withdrawn.");
    const updated = await tx.partnerApplication.update({ where: { id: application.id }, data: { status: "WITHDRAWN" } });
    await recordAudit(
      { userId, action: "APPLICATION_WITHDRAWN", entityType: "PartnerApplication", entityId: application.id, metadata: { campaignId: application.campaignId, brandId: application.campaign.brandId } },
      tx,
    );
    return updated;
  });
}

/**
 * A brand removes an approved partner from a campaign: the application becomes
 * REMOVED and the referral link is DISABLED so it stops resolving. Existing
 * verified conversions and ledger entries are untouched.
 */
export async function removePartner(brandId: string, actorId: string, applicationId: string, reason?: string | null) {
  return transaction(async (tx) => {
    const application = await tx.partnerApplication.findFirst({
      where: { id: applicationId, campaign: { brandId } },
      select: { id: true, status: true, userId: true, partnerType: true, campaignId: true, campaign: { select: { name: true, brand: { select: { name: true } } } } },
    });
    if (!application) throw new PartnerError("Application not found.");
    if (application.status !== "APPROVED") throw new PartnerError("Only approved partners can be removed.");

    await tx.partnerApplication.update({ where: { id: application.id }, data: { status: "REMOVED" } });
    await tx.referralLink.updateMany({ where: { campaignId: application.campaignId, ownerId: application.userId }, data: { status: "DISABLED" } });
    const partnerHome = application.partnerType === "CREATOR" ? "/dashboard/creator" : "/dashboard/customer";
    await notify(
      {
        userId: application.userId,
        type: "PARTNER_REMOVED",
        idempotencyKey: `application:${application.id}:REMOVED`,
        title: `Removed from ${application.campaign.name}`,
        body: `${application.campaign.brand.name} removed you from this campaign. Your referral link for it no longer works.${reason ? ` Reason: ${reason}` : ""}`,
        href: `${partnerHome}/campaigns`,
        email: true,
      },
      tx,
    );
    await recordAudit(
      { userId: actorId, action: "PARTNER_REMOVED", entityType: "PartnerApplication", entityId: application.id, metadata: { brandId, campaignId: application.campaignId, partnerUserId: application.userId, reason: reason ?? null } },
      tx,
    );
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
    const code = input.partnerType === "CUSTOMER" ? generateCustomerReferralCode() : generateReferralCode(input.handle, input.brandName);
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
