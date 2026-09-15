import { createHash, randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { isCampaignLive } from "@/lib/domain/campaign-rules";
import { normalizeReferralCode } from "@/lib/utils/codes";

export const VISITOR_COOKIE = "lg_vid";
export const ATTRIBUTION_COOKIE = "lg_ref";

export type Attribution = { code: string; campaignId: string; at: number };

export function hashValue(value: string): string {
  const salt = process.env.AUTH_SECRET ?? "localgrowth";
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

/**
 * Records a click (link or QR) and a referral session for the visitor.
 * Clicks are never treated as sales; they only establish attribution.
 */
export async function recordClick(input: {
  linkId: string;
  campaignId: string;
  referrerId: string;
  visitorId: string;
  source: "LINK" | "QR";
  ip?: string | null;
  userAgent?: string | null;
  referer?: string | null;
}) {
  await prisma.$transaction(async (tx) => {
    await tx.referralClick.create({
      data: {
        referralLinkId: input.linkId,
        campaignId: input.campaignId,
        anonymousVisitorId: input.visitorId,
        source: input.source,
        ipHash: input.ip ? hashValue(input.ip) : null,
        userAgent: input.userAgent?.slice(0, 200) ?? null,
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
