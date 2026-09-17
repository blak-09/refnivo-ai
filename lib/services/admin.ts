import type { Prisma, UserRole, UserStatus, VerificationStatus } from "@prisma/client";
import { prisma, transaction } from "@/lib/db/prisma";
import { canTransition, TRANSITIONS } from "@/lib/domain/campaign-rules";
import { recordAudit } from "./audit";
import { notify } from "./notify";

/**
 * Admin-only management operations. Every mutation is transactional, audited
 * with the admin as actor, and notifies the affected user. Callers must have
 * already passed `assertRole("ADMIN")`.
 */
export class AdminError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminError";
  }
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export type UserFilters = { q?: string; role?: UserRole | "ALL"; status?: UserStatus | "ALL" };

export async function listUsers(filters: UserFilters = {}, take = 100) {
  const q = filters.q?.trim();
  const where: Prisma.UserWhereInput = {
    ...(filters.role && filters.role !== "ALL" ? { role: filters.role } : {}),
    ...(filters.status && filters.status !== "ALL" ? { status: filters.status } : {}),
    ...(q ? { OR: [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }, { registrationId: { contains: q, mode: "insensitive" } }] } : {}),
  };
  return prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      registrationId: true,
      createdAt: true,
      lastLoginAt: true,
      suspendedAt: true,
      suspensionReason: true,
      brands: { select: { id: true, name: true, verificationStatus: true, status: true } },
      creatorProfile: { select: { id: true, username: true, verificationStatus: true } },
    },
  });
}

export async function countUsersByStatus() {
  const rows = await prisma.user.groupBy({ by: ["status"], _count: { _all: true } });
  const out: Record<UserStatus, number> = { PENDING: 0, APPROVED: 0, REJECTED: 0, SUSPENDED: 0 };
  for (const r of rows) out[r.status] = r._count._all;
  return out;
}

/** Suspends an APPROVED user: they are refused at login and on every request, and existing sessions are revoked. */
export async function suspendUser(adminId: string, userId: string, reason: string, now = new Date()) {
  if (adminId === userId) throw new AdminError("You cannot suspend your own account.");
  return transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { id: true, status: true, role: true, email: true } });
    if (!user) throw new AdminError("User not found.");
    if (user.status !== "APPROVED") throw new AdminError("Only approved accounts can be suspended.");
    if (user.role === "ADMIN") {
      const otherAdmins = await tx.user.count({ where: { role: "ADMIN", status: "APPROVED", id: { not: userId } } });
      if (otherAdmins === 0) throw new AdminError("Cannot suspend the last active admin.");
    }
    const updated = await tx.user.update({
      where: { id: userId },
      data: { status: "SUSPENDED", suspendedAt: now, suspensionReason: reason, sessionVersion: { increment: 1 } },
      select: { id: true, status: true, sessionVersion: true },
    });
    await notify(
      {
        userId,
        type: "ACCOUNT_SUSPENDED",
        idempotencyKey: `user:${userId}:SUSPENDED:${updated.sessionVersion}`,
        title: "Your account has been suspended",
        body: `Reason: ${reason}. Contact support if you believe this is a mistake.`,
        email: true,
      },
      tx,
    );
    await recordAudit({ userId: adminId, actorRole: "ADMIN", action: "USER_SUSPENDED", entityType: "User", entityId: userId, metadata: { reason, sessionsRevoked: true } }, tx);
    return updated;
  });
}

export async function reactivateUser(adminId: string, userId: string, now = new Date()) {
  return transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { id: true, status: true } });
    if (!user) throw new AdminError("User not found.");
    if (user.status !== "SUSPENDED") throw new AdminError("Only suspended accounts can be reactivated.");
    const updated = await tx.user.update({
      where: { id: userId },
      data: { status: "APPROVED", suspendedAt: null, suspensionReason: null, approvedAt: now, approvedById: adminId },
      select: { id: true, status: true },
    });
    await notify({ userId, type: "ACCOUNT_REACTIVATED", title: "Your account has been reactivated", body: "You can sign in again.", href: "/dashboard", email: true }, tx);
    await recordAudit({ userId: adminId, actorRole: "ADMIN", action: "USER_REACTIVATED", entityType: "User", entityId: userId }, tx);
    return updated;
  });
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

export type VerificationTarget = "BRAND" | "CREATOR";
export type VerificationDecision = Extract<VerificationStatus, "VERIFIED" | "REJECTED" | "UNVERIFIED">;

export async function listVerificationQueue() {
  const [brands, creators] = await Promise.all([
    prisma.brand.findMany({
      orderBy: [{ verificationStatus: "asc" }, { createdAt: "desc" }],
      take: 200,
      select: { id: true, name: true, slug: true, website: true, industry: true, verificationStatus: true, status: true, createdAt: true, owner: { select: { name: true, email: true } } },
    }),
    prisma.creatorProfile.findMany({
      orderBy: [{ verificationStatus: "asc" }, { createdAt: "desc" }],
      take: 200,
      select: {
        id: true,
        displayName: true,
        username: true,
        category: true,
        instagramHandle: true,
        instagramFollowers: true,
        youtubeChannel: true,
        youtubeSubscribers: true,
        verificationStatus: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
      },
    }),
  ]);
  return { brands, creators };
}

export async function setVerification(adminId: string, target: VerificationTarget, id: string, decision: VerificationDecision, note?: string | null) {
  return transaction(async (tx) => {
    let ownerId: string;
    let label: string;
    if (target === "BRAND") {
      const brand = await tx.brand.findUnique({ where: { id }, select: { id: true, name: true, ownerId: true } });
      if (!brand) throw new AdminError("Brand not found.");
      await tx.brand.update({ where: { id }, data: { verificationStatus: decision } });
      ownerId = brand.ownerId;
      label = `brand ${brand.name}`;
    } else {
      const profile = await tx.creatorProfile.findUnique({ where: { id }, select: { id: true, displayName: true, userId: true } });
      if (!profile) throw new AdminError("Creator profile not found.");
      await tx.creatorProfile.update({ where: { id }, data: { verificationStatus: decision } });
      ownerId = profile.userId;
      label = `creator profile ${profile.displayName}`;
    }
    const titles: Record<VerificationDecision, string> = {
      VERIFIED: `Your ${label} is now verified`,
      REJECTED: `Verification for your ${label} was declined`,
      UNVERIFIED: `Verification for your ${label} was reset`,
    };
    await notify(
      { userId: ownerId, type: "VERIFICATION_UPDATED", title: titles[decision], body: note?.trim() || null, href: target === "BRAND" ? "/dashboard/brand/profile" : "/dashboard/creator/profile", email: true },
      tx,
    );
    await recordAudit(
      { userId: adminId, actorRole: "ADMIN", action: `${target}_VERIFICATION_${decision}`, entityType: target === "BRAND" ? "Brand" : "CreatorProfile", entityId: id, metadata: { note: note?.trim() || null } },
      tx,
    );
  });
}

// ---------------------------------------------------------------------------
// Campaign moderation
// ---------------------------------------------------------------------------

export async function listAllCampaigns(take = 200) {
  return prisma.campaign.findMany({
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      campaignType: true,
      startDate: true,
      endDate: true,
      budget: true,
      createdAt: true,
      brand: { select: { id: true, name: true, verificationStatus: true } },
      product: { select: { name: true } },
      _count: { select: { referralLinks: true, referrals: true } },
    },
  });
}

export type ModerationAction = "PAUSE" | "END" | "ARCHIVE";

/** Admin pauses/ends/archives any campaign using the same transition rules as brands; the brand owner is notified. */
export async function moderateCampaign(adminId: string, campaignId: string, action: ModerationAction, reason: string) {
  return transaction(async (tx) => {
    const campaign = await tx.campaign.findUnique({ where: { id: campaignId }, select: { id: true, name: true, status: true, brand: { select: { ownerId: true } } } });
    if (!campaign) throw new AdminError("Campaign not found.");
    const verb: Record<ModerationAction, string> = { PAUSE: "paused", END: "ended", ARCHIVE: "archived" };
    if (!canTransition(campaign.status, action)) throw new AdminError(`This campaign cannot be ${verb[action]} from status ${campaign.status}.`);
    const to = TRANSITIONS[action].to;
    await tx.campaign.update({ where: { id: campaignId }, data: { status: to } });
    await notify(
      {
        userId: campaign.brand.ownerId,
        type: "CAMPAIGN_PAUSED",
        title: `Campaign ${action === "PAUSE" ? "paused" : action === "END" ? "ended" : "archived"} by Refnivo AI: ${campaign.name}`,
        body: `Reason: ${reason}`,
        href: `/dashboard/brand/campaigns/${campaignId}`,
        email: true,
      },
      tx,
    );
    await recordAudit(
      { userId: adminId, actorRole: "ADMIN", action: `ADMIN_CAMPAIGN_${action}`, entityType: "Campaign", entityId: campaignId, metadata: { from: campaign.status, to, reason } },
      tx,
    );
  });
}

// ---------------------------------------------------------------------------
// Oversight reads
// ---------------------------------------------------------------------------

export async function listAllConversions(take = 200) {
  return prisma.conversion.findMany({
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      orderReference: true,
      amount: true,
      currency: true,
      source: true,
      createdAt: true,
      verifiedAt: true,
      reversedAt: true,
      brand: { select: { id: true, name: true } },
      referral: {
        select: {
          id: true,
          status: true,
          campaign: { select: { name: true } },
          referralLink: { select: { code: true, partnerType: true } },
          referrer: { select: { name: true } },
          commissions: { select: { amount: true, status: true } },
          rewards: { select: { amount: true, status: true } },
        },
      },
    },
  });
}

export type AuditFilters = { action?: string; entityType?: string; userId?: string };

export async function listAuditLogs(filters: AuditFilters = {}, take = 200) {
  const where: Prisma.AuditLogWhereInput = {
    ...(filters.action ? { action: { contains: filters.action.trim().toUpperCase() } } : {}),
    ...(filters.entityType ? { entityType: filters.entityType.trim() } : {}),
    ...(filters.userId ? { userId: filters.userId.trim() } : {}),
  };
  return prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      action: true,
      entityType: true,
      entityId: true,
      metadata: true,
      actorRole: true,
      requestId: true,
      createdAt: true,
      user: { select: { id: true, name: true, email: true, role: true } },
    },
  });
}

export async function platformStats() {
  const [users, byStatus, brands, creators, customers, campaigns, activeCampaigns, links, clicks, verified, revenue, commissions, rewards, openPayouts, pendingApplications] =
    await Promise.all([
      prisma.user.count(),
      countUsersByStatus(),
      prisma.brand.count(),
      prisma.creatorProfile.count(),
      prisma.user.count({ where: { role: "CUSTOMER" } }),
      prisma.campaign.count(),
      prisma.campaign.count({ where: { status: "ACTIVE" } }),
      prisma.referralLink.count(),
      prisma.referralClick.count(),
      prisma.referral.count({ where: { status: "VERIFIED" } }),
      prisma.conversion.aggregate({ where: { referral: { status: "VERIFIED" } }, _sum: { amount: true } }),
      prisma.commission.aggregate({ where: { status: { in: ["APPROVED", "PAID"] } }, _sum: { amount: true } }),
      prisma.reward.aggregate({ where: { status: { in: ["AVAILABLE", "REDEEMED"] } }, _sum: { amount: true } }),
      prisma.payoutRequest.count({ where: { status: { in: ["REQUESTED", "UNDER_REVIEW", "APPROVED", "PROCESSING"] } } }),
      prisma.partnerApplication.count({ where: { status: "PENDING" } }),
    ]);
  return {
    users,
    byStatus,
    brands,
    creators,
    customers,
    campaigns,
    activeCampaigns,
    links,
    clicks,
    verified,
    revenue: revenue._sum.amount ?? 0,
    commissions: commissions._sum.amount ?? 0,
    rewards: rewards._sum.amount ?? 0,
    openPayouts,
    pendingApplications,
  };
}
