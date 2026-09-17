import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { isSessionCurrent } from "@/lib/auth/session-version";
import { AdminError, listAuditLogs, listUsers, moderateCampaign, reactivateUser, setVerification, suspendUser } from "@/lib/services/admin";
import { createCampaign, transitionCampaign } from "@/lib/services/campaigns";
import { countUnread, listNotifications, markAllNotificationsRead, markNotificationRead, notify } from "@/lib/services/notify";
import { hashResetToken, newResetToken, peekResetToken, requestPasswordReset, ResetTokenError, resetPasswordWithToken } from "@/lib/services/password-reset";
import { recordClick } from "@/lib/services/tracking";
import { joinCampaign } from "@/lib/services/partners";
import { createUser } from "@/lib/services/users";
import { campaignValues, makeCreator, makeCustomer, makeOwnerWithBrand, uniq } from "../helpers";

async function makeAdmin() {
  const admin = await createUser({ name: "Admin", email: `${uniq("admin")}@test.local`, password: "Password1", role: "ADMIN" });
  await prisma.user.update({ where: { id: admin.id }, data: { status: "APPROVED" } });
  return admin;
}

async function approved(userId: string) {
  await prisma.user.update({ where: { id: userId }, data: { status: "APPROVED" } });
}

afterAll(() => prisma.$disconnect());

describe("notifications", () => {
  it("are per-user: listing, unread count, mark one / mark all — and another user's id is a no-op", async () => {
    const a = await makeCustomer();
    const b = await makeCustomer();
    await notify({ userId: a.id, type: "SYSTEM", title: "Hello A", href: "/dashboard" });
    await notify({ userId: a.id, type: "SYSTEM", title: "Hello A again" });
    await notify({ userId: b.id, type: "SYSTEM", title: "Hello B" });

    expect(await countUnread(a.id)).toBe(2);
    expect(await countUnread(b.id)).toBe(1);
    const listA = await listNotifications(a.id);
    expect(listA.map((n) => n.title).sort()).toEqual(["Hello A", "Hello A again"]);

    // B cannot mark A's notification (IDOR guard) — count stays 0 changed rows.
    expect(await markNotificationRead(b.id, listA[0].id)).toBe(0);
    expect(await countUnread(a.id)).toBe(2);

    expect(await markNotificationRead(a.id, listA[0].id)).toBe(1);
    expect(await countUnread(a.id)).toBe(1);
    expect(await markAllNotificationsRead(a.id)).toBe(1);
    expect(await countUnread(a.id)).toBe(0);
    expect(await countUnread(b.id)).toBe(1);
  });
});

describe("password reset", () => {
  it("stores only a token hash, is single-use, expires, and revokes sessions on success", async () => {
    const user = await makeCustomer();
    await approved(user.id);
    const before = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });

    await requestPasswordReset(user.email);
    const rows = await prisma.passwordResetToken.findMany({ where: { userId: user.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(rows[0].usedAt).toBeNull();

    // Requesting again invalidates the previous token.
    await requestPasswordReset(user.email);
    const all = await prisma.passwordResetToken.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } });
    expect(all).toHaveLength(2);
    expect(all[0].usedAt).not.toBeNull();

    // We do not know the raw token (it only went to e-mail) — mint one the same way the service does and store its hash.
    const raw = newResetToken();
    await prisma.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });
    await prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash: hashResetToken(raw), expiresAt: new Date(Date.now() + 60_000) } });
    expect(await peekResetToken(raw)).toBe(true);
    expect(await peekResetToken("not-a-token")).toBe(false);

    const result = await resetPasswordWithToken(raw, "Fresh-Password-99");
    expect(result.userId).toBe(user.id);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.passwordHash).not.toBe(before.passwordHash);
    expect(after.sessionVersion).toBe(before.sessionVersion + 1);
    expect(isSessionCurrent(before.sessionVersion, after.sessionVersion)).toBe(false);
    expect(after.mustChangePassword).toBe(false);

    // Single use.
    await expect(resetPasswordWithToken(raw, "Another-Password-99")).rejects.toBeInstanceOf(ResetTokenError);
    expect(await peekResetToken(raw)).toBe(false);

    // Expired token.
    const expired = newResetToken();
    await prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash: hashResetToken(expired), expiresAt: new Date(Date.now() - 1000) } });
    expect(await peekResetToken(expired)).toBe(false);
    await expect(resetPasswordWithToken(expired, "Another-Password-99")).rejects.toBeInstanceOf(ResetTokenError);

    expect(await prisma.auditLog.count({ where: { action: "PASSWORD_RESET_COMPLETED", entityId: user.id } })).toBe(1);
  });

  it("silently ignores unknown e-mails and accounts that cannot sign in (no enumeration, no token)", async () => {
    await expect(requestPasswordReset(`${uniq("nobody")}@test.local`)).resolves.toBeUndefined();
    const pending = await makeCustomer(); // status PENDING
    await requestPasswordReset(pending.email);
    expect(await prisma.passwordResetToken.count({ where: { userId: pending.id } })).toBe(0);
  });
});

describe("admin management", () => {
  it("suspend revokes sessions and blocks login state; reactivate restores; self and last-admin are protected", async () => {
    const admin = await makeAdmin();
    const victim = await makeCreator();
    await approved(victim.id);

    await expect(suspendUser(admin.id, admin.id, "self")).rejects.toBeInstanceOf(AdminError);
    await expect(suspendUser(admin.id, victim.id, "")).resolves.toBeDefined(); // reason validated at the action layer; service accepts any string
    const suspended = await prisma.user.findUniqueOrThrow({ where: { id: victim.id } });
    expect(suspended.status).toBe("SUSPENDED");
    expect(suspended.sessionVersion).toBe(2);
    expect(suspended.suspendedAt).not.toBeNull();
    await expect(suspendUser(admin.id, victim.id, "again")).rejects.toThrow(/approved/i);

    await reactivateUser(admin.id, victim.id);
    const back = await prisma.user.findUniqueOrThrow({ where: { id: victim.id } });
    expect(back.status).toBe("APPROVED");
    expect(back.suspensionReason).toBeNull();
    expect(await prisma.notification.count({ where: { userId: victim.id, type: { in: ["ACCOUNT_SUSPENDED", "ACCOUNT_REACTIVATED"] } } })).toBe(2);

    // The audit trail names the admin as actor with role ADMIN.
    const logs = await listAuditLogs({ action: "USER_SUSPENDED", userId: admin.id });
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].actorRole).toBe("ADMIN");

    // Last active admin cannot be suspended: leave `admin` as the only APPROVED admin.
    const other = await makeAdmin();
    await prisma.user.updateMany({ where: { role: "ADMIN", id: { not: admin.id } }, data: { status: "SUSPENDED" } });
    await expect(suspendUser(other.id, admin.id, "x")).rejects.toThrow(/last active admin/i);
    // With a second approved admin present it is allowed again.
    await prisma.user.update({ where: { id: other.id }, data: { status: "APPROVED" } });
    await expect(suspendUser(other.id, admin.id, "x")).resolves.toBeDefined();
  });

  it("verification decisions update the badge, notify the owner and are audited", async () => {
    const admin = await makeAdmin();
    const { brand, user } = await makeOwnerWithBrand("Verify Me");
    await setVerification(admin.id, "BRAND", brand.id, "VERIFIED", "checked website");
    expect((await prisma.brand.findUniqueOrThrow({ where: { id: brand.id } })).verificationStatus).toBe("VERIFIED");
    await setVerification(admin.id, "BRAND", brand.id, "UNVERIFIED", "revoked");
    expect((await prisma.brand.findUniqueOrThrow({ where: { id: brand.id } })).verificationStatus).toBe("UNVERIFIED");
    expect(await prisma.notification.count({ where: { userId: user.id, type: "VERIFICATION_UPDATED" } })).toBe(2);
    expect(await prisma.auditLog.count({ where: { action: "BRAND_VERIFICATION_VERIFIED", entityId: brand.id } })).toBe(1);
    await expect(setVerification(admin.id, "CREATOR", "does-not-exist", "VERIFIED")).rejects.toBeInstanceOf(AdminError);
  });

  it("campaign moderation respects the lifecycle rules and notifies the brand", async () => {
    const admin = await makeAdmin();
    const owner = await makeOwnerWithBrand("Moderated");
    const campaign = await createCampaign(owner.brand.id, owner.brand.name, owner.user.id, campaignValues(owner.product.id, { requiresApproval: false }));
    await expect(moderateCampaign(admin.id, campaign.id, "PAUSE", "draft")).rejects.toThrow(/cannot be paused/i);
    await transitionCampaign(owner.brand.id, owner.user.id, campaign.id, "PUBLISH", { confirmed: true });
    await moderateCampaign(admin.id, campaign.id, "PAUSE", "policy review");
    expect((await prisma.campaign.findUniqueOrThrow({ where: { id: campaign.id } })).status).toBe("PAUSED");
    expect(await prisma.notification.count({ where: { userId: owner.user.id, type: "CAMPAIGN_PAUSED" } })).toBe(1);
    await moderateCampaign(admin.id, campaign.id, "END", "closed");
    expect((await prisma.campaign.findUniqueOrThrow({ where: { id: campaign.id } })).status).toBe("ENDED");
  });

  it("listUsers filters by role/status/query without leaking password hashes", async () => {
    const creator = await makeCreator();
    const rows = await listUsers({ q: creator.email, role: "CREATOR", status: "ALL" });
    expect(rows.map((r) => r.id)).toContain(creator.id);
    expect(JSON.stringify(rows)).not.toContain("passwordHash");
    expect(await listUsers({ q: creator.email, role: "ADMIN" })).toHaveLength(0);
  });
});

describe("click de-duplication", () => {
  it("counts one click for a refresh burst from the same visitor, but counts a different visitor", async () => {
    const owner = await makeOwnerWithBrand("Clicks");
    const campaign = await createCampaign(owner.brand.id, owner.brand.name, owner.user.id, campaignValues(owner.product.id, { requiresApproval: false }));
    await transitionCampaign(owner.brand.id, owner.user.id, campaign.id, "PUBLISH", { confirmed: true });
    const creator = await makeCreator();
    const { code } = await joinCampaign({ id: creator.id, name: creator.name, role: "CREATOR" }, campaign.id);
    const link = await prisma.referralLink.findUniqueOrThrow({ where: { code: code! } });
    const base = { linkId: link.id, campaignId: campaign.id, referrerId: creator.id, source: "LINK" as const, ip: "203.0.113.5" };

    const now = new Date();
    expect((await recordClick({ ...base, visitorId: "v-1" }, now)).counted).toBe(true);
    expect((await recordClick({ ...base, visitorId: "v-1" }, new Date(now.getTime() + 5_000))).counted).toBe(false);
    expect((await recordClick({ ...base, visitorId: "v-2" }, now)).counted).toBe(true);
    expect((await recordClick({ ...base, visitorId: "v-1" }, new Date(now.getTime() + 60_000))).counted).toBe(true);
    expect(await prisma.referralClick.count({ where: { referralLinkId: link.id } })).toBe(3);
    // One referral session per visitor regardless of repeat clicks.
    expect(await prisma.referral.count({ where: { referralLinkId: link.id, anonymousVisitorId: "v-1" } })).toBe(1);
    // IP is stored hashed only.
    const click = await prisma.referralClick.findFirstOrThrow({ where: { referralLinkId: link.id } });
    expect(click.ipHash).not.toContain("203.0.113.5");
  });
});
