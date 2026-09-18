import bcrypt from "bcryptjs";
import { prisma, transaction } from "@/lib/db/prisma";
import { recordAudit } from "./audit";
import { notifyMany, adminUserIds } from "./notify";

/**
 * Self-service account deletion.
 *
 * Data policy (documented here because it is a product decision, not a
 * technical one):
 *
 *  - PERSONAL DATA IS REMOVED: name, e-mail, phone, avatar, password hash,
 *    Google link, notifications, password-reset tokens, queued e-mails,
 *    creator public profile (incl. self-reported audience numbers). The
 *    original e-mail is freed, so the person can register again later.
 *  - FINANCIAL HISTORY IS KEPT: referrals, conversions, commissions, rewards,
 *    payout requests and audit rows stay attached to the (anonymised) user
 *    row, because brands' ledgers, partner earnings and the audit trail must
 *    not change when one party leaves. Nothing is cascade-deleted.
 *  - BRAND OWNERS: the brand is suspended, its campaigns are ended and every
 *    referral link disabled, so partners stop promoting a brand that is gone;
 *    partners' verified earnings from that brand remain visible to them.
 *  - PARTNERS (creators / customers): links are disabled and pending
 *    applications withdrawn. An OPEN payout request blocks deletion (settle
 *    or cancel it first); an unrequested balance is forfeited — the UI says so.
 *  - ADMINS cannot delete themselves here (an explicit, protected admin
 *    operation is required; the last admin can never be removed).
 *
 * Re-authentication: accounts with a password must supply it; Google-only
 * accounts confirm with the typed phrase alone (the session already proves
 * possession of the Google account).
 */
export class AccountDeletionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccountDeletionError";
  }
}

export const DELETE_CONFIRMATION = "DELETE";
/** Marker written into users.suspensionReason: lets every code path recognise a deleted account even before `deletedAt` exists. */
export const DELETED_SUSPENSION_REASON = "Account deleted by the user";
const OPEN_PAYOUT = ["REQUESTED", "UNDER_REVIEW", "APPROVED", "PROCESSING"] as const;

export type DeletionPreview = {
  role: "BRAND_OWNER" | "CREATOR" | "CUSTOMER" | "ADMIN";
  hasPassword: boolean;
  /** Approved-but-unrequested balance that will be forfeited (paise). */
  forfeitedBalance: number;
  openPayoutRequest: boolean;
  /** Brand owners: what leaves the marketplace. */
  brand: { name: string; activeCampaigns: number; partners: number } | null;
};

/** What the confirmation dialog shows before the user commits. */
export async function previewAccountDeletion(userId: string): Promise<DeletionPreview> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { role: true, passwordHash: true } });
  const [openPayout, commissions, rewards, brand] = await Promise.all([
    prisma.payoutRequest.findFirst({ where: { userId, status: { in: [...OPEN_PAYOUT] } }, select: { id: true } }),
    prisma.commission.aggregate({ where: { creatorId: userId, status: "APPROVED", payoutItem: null }, _sum: { amount: true } }),
    prisma.reward.aggregate({ where: { recipientId: userId, status: "AVAILABLE", payoutItem: null }, _sum: { amount: true } }),
    user.role === "BRAND_OWNER"
      ? prisma.brand.findFirst({
          where: { ownerId: userId },
          select: { name: true, _count: { select: { campaigns: { where: { status: "ACTIVE" } } } }, campaigns: { select: { _count: { select: { referralLinks: { where: { status: "ACTIVE" } } } } } } },
        })
      : null,
  ]);
  return {
    role: user.role,
    hasPassword: user.passwordHash !== null,
    forfeitedBalance: (commissions._sum.amount ?? 0) + (rewards._sum.amount ?? 0),
    openPayoutRequest: !!openPayout,
    brand: brand ? { name: brand.name, activeCampaigns: brand._count.campaigns, partners: brand.campaigns.reduce((s, c) => s + c._count.referralLinks, 0) } : null,
  };
}

export type DeleteAccountInput = { confirmation: string; currentPassword?: string | null };

export async function deleteOwnAccount(userId: string, input: DeleteAccountInput, now = new Date()) {
  if (input.confirmation.trim() !== DELETE_CONFIRMATION) throw new AccountDeletionError(`Type ${DELETE_CONFIRMATION} to confirm.`);

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true, email: true, passwordHash: true, suspensionReason: true } });
  if (!user || user.suspensionReason === DELETED_SUSPENSION_REASON) throw new AccountDeletionError("Account not found.");
  if (user.role === "ADMIN") throw new AccountDeletionError("Admin accounts cannot be deleted from Settings. Ask another admin to remove your admin access first.");

  if (user.passwordHash) {
    const ok = input.currentPassword ? await bcrypt.compare(input.currentPassword, user.passwordHash) : false;
    if (!ok) throw new AccountDeletionError("Your current password is incorrect.");
  }

  const openPayout = await prisma.payoutRequest.findFirst({ where: { userId, status: { in: [...OPEN_PAYOUT] } }, select: { id: true } });
  if (openPayout) throw new AccountDeletionError("You have a payout request in progress. Wait for it to be settled (or ask an admin to cancel it) before deleting your account.");

  const anonymisedEmail = `deleted+${user.id}@deleted.invalid`;

  return transaction(async (tx) => {
    // ---- Brand owner: take the brand off the marketplace, keep its ledger.
    const brands = await tx.brand.findMany({ where: { ownerId: userId }, select: { id: true, name: true } });
    for (const brand of brands) {
      await tx.brand.update({ where: { id: brand.id }, data: { status: "SUSPENDED" } });
      await tx.campaign.updateMany({ where: { brandId: brand.id, status: { in: ["ACTIVE", "PAUSED", "PENDING_REVIEW"] } }, data: { status: "ENDED" } });
      await tx.campaign.updateMany({ where: { brandId: brand.id, status: "DRAFT" }, data: { status: "ARCHIVED" } });
      await tx.referralLink.updateMany({ where: { campaign: { brandId: brand.id } }, data: { status: "DISABLED" } });
      // Partners promoting this brand deserve to know why their links stopped.
      const partners = await tx.referralLink.findMany({ where: { campaign: { brandId: brand.id } }, select: { ownerId: true }, distinct: ["ownerId"] });
      await notifyMany(
        partners.map((p) => p.ownerId),
        {
          type: "CAMPAIGN_PAUSED",
          idempotencyKey: `brand-closed:${brand.id}`,
          title: `${brand.name} has left Refnivo`,
          body: "The brand closed its account. Its campaigns have ended and your referral links for it no longer resolve. Verified earnings are unaffected.",
          href: "/dashboard",
        },
        tx,
      );
    }

    // ---- Partner side: stop promoting, withdraw pending applications.
    await tx.referralLink.updateMany({ where: { ownerId: userId }, data: { status: "DISABLED" } });
    await tx.partnerApplication.updateMany({ where: { userId, status: "PENDING" }, data: { status: "WITHDRAWN" } });

    // ---- Personal data.
    await tx.creatorProfile.deleteMany({ where: { userId } });
    await tx.oAuthAccount.deleteMany({ where: { userId } });
    await tx.passwordResetToken.deleteMany({ where: { userId } });
    await tx.notification.deleteMany({ where: { userId } });
    await tx.emailOutbox.deleteMany({ where: { userId, status: { in: ["PENDING", "FAILED"] } } });
    await tx.emailOutbox.updateMany({ where: { userId }, data: { to: anonymisedEmail } });

    await tx.user.update({
      where: { id: userId },
      data: {
        name: "Deleted user",
        email: anonymisedEmail,
        phone: null,
        avatarUrl: null,
        passwordHash: null,
        registrationDetails: { deleted: true },
        status: "SUSPENDED",
        suspendedAt: now,
        suspensionReason: DELETED_SUSPENSION_REASON,
        deletedAt: now,
        emailNotifications: false,
        mustChangePassword: false,
        sessionVersion: { increment: 1 }, // every existing session is invalid from now on
      },
    });

    await recordAudit(
      { userId, actorRole: user.role, action: "ACCOUNT_DELETED", entityType: "User", entityId: userId, metadata: { role: user.role, brandsClosed: brands.length } },
      tx,
    );
    if (brands.length) {
      await notifyMany(
        await adminUserIds(tx),
        { type: "SYSTEM", idempotencyKey: `account-deleted:${userId}`, title: "A brand owner deleted their account", body: `${brands.map((b) => b.name).join(", ")} was suspended and its campaigns ended.`, href: "/dashboard/admin/campaigns" },
        tx,
      );
    }
    return { deletedAt: now };
  });
}
