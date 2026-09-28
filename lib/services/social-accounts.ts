import type { SocialAccount, SocialPlatform } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { decryptSecret, deriveKey, encryptSecret } from "@/lib/security/secret-box";
import { getSocialProvider, PLATFORM_LABEL, platformConfig, SOCIAL_PLATFORMS, type SocialProfile, type TokenSet } from "@/lib/social";
import { securityEvent } from "@/lib/utils/security-log";
import { recordAudit } from "./audit";

/**
 * Creators' linked social accounts.
 *
 * Tokens are encrypted before they touch the database and are never returned to
 * a caller — the public shapes below carry a handle, a link, a picture and a
 * follower count, and nothing else. A follower count is stored only when the
 * platform actually reported one; otherwise it stays null and the UI says the
 * platform does not share it.
 */
export class SocialAccountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SocialAccountError";
  }
}

/** What the dashboard and public profile may see. */
export type PublicSocialAccount = {
  platform: SocialPlatform;
  label: string;
  handle: string | null;
  profileUrl: string | null;
  avatarUrl: string | null;
  followers: number | null;
  followersSyncedAt: Date | null;
  /** Why a follower count is missing, when the platform simply does not share it. */
  followersUnavailableReason: string | null;
  status: SocialAccount["status"];
  scopes: string[];
  connectedAt: Date;
  lastSyncedAt: Date | null;
};

function toPublic(row: SocialAccount): PublicSocialAccount {
  const provider = getSocialProvider(row.platform);
  const metric = provider?.followerMetric;
  return {
    platform: row.platform,
    label: PLATFORM_LABEL[row.platform],
    handle: row.handle,
    profileUrl: row.profileUrl,
    avatarUrl: row.avatarUrl,
    followers: row.followers,
    followersSyncedAt: row.followersSyncedAt,
    followersUnavailableReason: row.followers === null ? (metric && !metric.available ? metric.reason : "Not available through the platform API.") : null,
    status: row.status,
    scopes: row.scopes,
    connectedAt: row.connectedAt,
    lastSyncedAt: row.lastSyncedAt,
  };
}

/** A creator's connected accounts (never includes tokens). */
export async function listSocialAccounts(userId: string): Promise<PublicSocialAccount[]> {
  const rows = await prisma.socialAccount.findMany({ where: { userId, status: { not: "DISCONNECTED" } }, orderBy: { platform: "asc" } });
  return rows.map(toPublic);
}

/** Connected accounts for a public creator profile — same shape, same redactions. */
export async function publicSocialAccounts(userId: string): Promise<PublicSocialAccount[]> {
  return listSocialAccounts(userId);
}

/** Every platform with its configuration and, if linked, the account. */
export async function socialAccountMatrix(userId: string) {
  const accounts = await listSocialAccounts(userId);
  const byPlatform = new Map(accounts.map((a) => [a.platform, a]));
  return SOCIAL_PLATFORMS.map((platform) => {
    const provider = getSocialProvider(platform);
    return {
      ...platformConfig(platform),
      account: byPlatform.get(platform) ?? null,
      purpose: provider?.purpose ?? null,
      scopes: provider?.scopes ?? [],
      followerMetric: provider?.followerMetric ?? null,
    };
  });
}

/**
 * Stores (or refreshes) a connection after a successful OAuth callback.
 *
 * Refuses to attach an account that another Refnivo user already linked — the
 * unique key on (platform, providerAccountId) makes that a race-free check.
 */
export async function upsertSocialAccount(input: { userId: string; platform: SocialPlatform; profile: SocialProfile; tokens: TokenSet }, now = new Date()) {
  const key = deriveKey(process.env.SOCIAL_TOKEN_ENCRYPTION_KEY);

  const claimedByAnother = await prisma.socialAccount.findFirst({
    where: { platform: input.platform, providerAccountId: input.profile.providerAccountId, userId: { not: input.userId }, status: { not: "DISCONNECTED" } },
    select: { id: true },
  });
  if (claimedByAnother) {
    securityEvent("SOCIAL_ACCOUNT_CLAIMED", { platform: input.platform });
    throw new SocialAccountError("That account is already linked to another Refnivo profile.");
  }

  const data = {
    providerAccountId: input.profile.providerAccountId,
    handle: input.profile.handle,
    profileUrl: input.profile.profileUrl,
    avatarUrl: input.profile.avatarUrl,
    followers: input.profile.followers,
    followersSyncedAt: input.profile.followers === null ? null : now,
    accessToken: encryptSecret(input.tokens.accessToken, key),
    refreshToken: input.tokens.refreshToken ? encryptSecret(input.tokens.refreshToken, key) : null,
    tokenExpiresAt: input.tokens.expiresAt,
    scopes: input.tokens.scopes,
    status: "CONNECTED" as const,
    lastErrorAt: null,
    lastSyncedAt: now,
  };

  const row = await prisma.socialAccount.upsert({
    where: { userId_platform: { userId: input.userId, platform: input.platform } },
    create: { userId: input.userId, platform: input.platform, connectedAt: now, ...data },
    update: data,
  });
  await recordAudit({
    userId: input.userId,
    action: "SOCIAL_ACCOUNT_CONNECTED",
    entityType: "SocialAccount",
    entityId: row.id,
    // Handle and id only — never a token.
    metadata: { platform: input.platform, handle: input.profile.handle ?? null, scopes: input.tokens.scopes },
  });
  return toPublic(row);
}

/**
 * Disconnects an account: tokens are destroyed and the row is marked
 * DISCONNECTED. Nothing else is touched — campaigns, referral links, orders,
 * commissions and payouts the creator earned all stay exactly as they were.
 */
export async function disconnectSocialAccount(userId: string, platform: SocialPlatform) {
  const row = await prisma.socialAccount.findUnique({ where: { userId_platform: { userId, platform } } });
  if (!row || row.status === "DISCONNECTED") throw new SocialAccountError("That account is not connected.");

  await prisma.socialAccount.update({
    where: { id: row.id },
    data: { status: "DISCONNECTED", accessToken: null, refreshToken: null, tokenExpiresAt: null, scopes: [], followers: null, followersSyncedAt: null },
  });
  await recordAudit({ userId, action: "SOCIAL_ACCOUNT_DISCONNECTED", entityType: "SocialAccount", entityId: row.id, metadata: { platform } });
}

/** Decrypts the stored token for a server-side call. Never leaves the server. */
export async function accessTokenFor(userId: string, platform: SocialPlatform): Promise<string | null> {
  const row = await prisma.socialAccount.findUnique({ where: { userId_platform: { userId, platform } } });
  if (!row?.accessToken || row.status !== "CONNECTED") return null;
  try {
    return decryptSecret(row.accessToken, deriveKey(process.env.SOCIAL_TOKEN_ENCRYPTION_KEY));
  } catch {
    // A key rotation or a tampered row: make the creator reconnect rather than guess.
    await prisma.socialAccount.update({ where: { id: row.id }, data: { status: "NEEDS_RECONNECT", lastErrorAt: new Date() } });
    return null;
  }
}

/** Re-reads the profile from the platform and updates the stored details. */
export async function refreshSocialProfile(userId: string, platform: SocialPlatform, now = new Date()) {
  const provider = getSocialProvider(platform);
  const token = await accessTokenFor(userId, platform);
  if (!provider || !token) throw new SocialAccountError("Reconnect this account to refresh it.");
  try {
    const profile = await provider.fetchProfile(token);
    const row = await prisma.socialAccount.update({
      where: { userId_platform: { userId, platform } },
      data: {
        handle: profile.handle,
        profileUrl: profile.profileUrl,
        avatarUrl: profile.avatarUrl,
        followers: profile.followers,
        followersSyncedAt: profile.followers === null ? null : now,
        lastSyncedAt: now,
        status: "CONNECTED",
        lastErrorAt: null,
      },
    });
    return toPublic(row);
  } catch (err) {
    await prisma.socialAccount.update({ where: { userId_platform: { userId, platform } }, data: { status: "NEEDS_RECONNECT", lastErrorAt: now } });
    console.error("[social] profile refresh failed", err instanceof Error ? err.message : err);
    throw new SocialAccountError("That platform refused the connection. Please reconnect the account.");
  }
}
