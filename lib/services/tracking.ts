import { createHash, randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { requireAuthSecret } from "@/lib/config/env";
import { isCampaignLive } from "@/lib/domain/campaign-rules";
import { normalizeReferralCode } from "@/lib/utils/codes";

export const VISITOR_COOKIE = "lg_vid";
export const ATTRIBUTION_COOKIE = "lg_ref";

export type Attribution = { code: string; campaignId: string; at: number };

/**
 * Salted SHA-256 for IPs and customer contacts. The salt is CONTACT_HASH_SECRET
 * when set (recommended: it must stay stable forever, because self-referral and
 * new-customer checks compare historical hashes) and otherwise AUTH_SECRET — so
 * an existing deployment keeps its hashes until the operator introduces the
 * dedicated secret. There is deliberately no fixed fallback: a misconfigured
 * deployment fails instead of producing dictionary-reversible hashes.
 */
export function hashValue(value: string): string {
  const salt = process.env.CONTACT_HASH_SECRET?.trim() || requireAuthSecret();
  return createHash("sha256").update(`${salt}:${value.trim().toLowerCase()}`).digest("hex");
}

export function newVisitorId(): string {
  return randomUUID();
}

/** Resolves a referral code to its live campaign, or explains why it is not valid. */
export async function resolveReferralCode(rawCode: string) {
  const code = normalizeReferralCode(rawCode);
  const link = await prisma.referralLink.findUnique({
    where: { code },
    include: {
      campaign: {
        include: {
          product: { select: { name: true, slug: true, imageUrl: true, price: true, currency: true, purchaseUrl: true, status: true } },
          brand: { select: { id: true, name: true, slug: true, logoUrl: true, status: true } },
        },
      },
      owner: { select: { id: true, name: true, creatorProfile: { select: { displayName: true, username: true } } } },
    },
  });
  if (!link) return { ok: false as const, reason: "NOT_FOUND" as const };
  if (link.status !== "ACTIVE") return { ok: false as const, reason: "DISABLED" as const, link };
  if (link.campaign.brand.status !== "ACTIVE" || link.campaign.product.status !== "ACTIVE") {
    return { ok: false as const, reason: "UNAVAILABLE" as const, link };
  }
  if (!isCampaignLive(link.campaign)) return { ok: false as const, reason: "INACTIVE" as const, link };
  return { ok: true as const, link };
}

/** Repeat hits from the same visitor on the same link inside this window are not counted again. */
export const DUPLICATE_CLICK_WINDOW_MS = 30_000;
/** The same IP + user agent on the same link is counted at most once per hour (cookie-clearing cannot inflate clicks). */
export const DUPLICATE_DEVICE_WINDOW_MS = 60 * 60 * 1000;

/**
 * Records a click (link or QR) and a referral session for the visitor.
 * Clicks are never treated as sales; they only establish attribution.
 * Returns `counted: false` when the hit was a duplicate (refresh / double tap)
 * — the visitor is still redirected, only the count is suppressed.
 */
export async function recordClick(
  input: {
    linkId: string;
    campaignId: string;
    referrerId: string;
    visitorId: string;
    source: "LINK" | "QR";
    ip?: string | null;
    userAgent?: string | null;
    referer?: string | null;
  },
  now = new Date(),
): Promise<{ counted: boolean }> {
  return prisma.$transaction(async (tx) => {
    const recent = await tx.referralClick.findFirst({
      where: { referralLinkId: input.linkId, anonymousVisitorId: input.visitorId, createdAt: { gt: new Date(now.getTime() - DUPLICATE_CLICK_WINDOW_MS) } },
      select: { id: true },
    });
    if (recent) return { counted: false };
    const ipHash = input.ip ? hashValue(input.ip) : null;
    const userAgent = input.userAgent?.slice(0, 200) ?? null;
    // Only when a user agent is present: two people behind one NAT with no UA must not collapse into one.
    if (ipHash && userAgent) {
      const sameDevice = await tx.referralClick.findFirst({
        where: { referralLinkId: input.linkId, ipHash, userAgent, createdAt: { gt: new Date(now.getTime() - DUPLICATE_DEVICE_WINDOW_MS) } },
        select: { id: true },
      });
      if (sameDevice) return { counted: false };
    }

    await tx.referralClick.create({
      data: {
        referralLinkId: input.linkId,
        campaignId: input.campaignId,
        anonymousVisitorId: input.visitorId,
        source: input.source,
        ipHash,
        userAgent,
        referer: input.referer?.slice(0, 300) ?? null,
      },
    });
    // One referral session per visitor per link.
    const existing = await tx.referral.findFirst({
      where: { referralLinkId: input.linkId, anonymousVisitorId: input.visitorId, status: { in: ["CLICKED", "VISITED"] } },
      select: { id: true },
    });
    if (!existing) {
      await tx.referral.create({
        data: {
          campaignId: input.campaignId,
          referralLinkId: input.linkId,
          referrerId: input.referrerId,
          anonymousVisitorId: input.visitorId,
          status: "CLICKED",
        },
      });
    }
    return { counted: true };
  });
}

/** Marks the visitor's referral session as having reached the product page. */
export async function markVisited(linkCode: string, visitorId: string) {
  const link = await prisma.referralLink.findUnique({ where: { code: normalizeReferralCode(linkCode) }, select: { id: true } });
  if (!link) return;
  await prisma.referral.updateMany({
    where: { referralLinkId: link.id, anonymousVisitorId: visitorId, status: "CLICKED" },
    data: { status: "VISITED" },
  });
}
