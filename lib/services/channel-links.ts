import type { LinkSource, Prisma } from "@prisma/client";
import { prisma, transaction } from "@/lib/db/prisma";
import { isCampaignLive } from "@/lib/domain/campaign-rules";
import { generateReferralCode, generateCustomerReferralCode } from "@/lib/utils/codes";
import { recordAudit } from "./audit";

/**
 * Channel links: one referral link per social platform, for the same campaign.
 *
 * This is the whole of Refnivo's "which platform sold it" story. A click is
 * never attributed to a platform by reading the referer — browsers and apps
 * strip or fake it, and in-app browsers lie. Instead the creator chooses which
 * channel a link is for, shares THAT link there, and every click, order and
 * commission on it inherits the channel. A sale can therefore only be credited
 * to Instagram if it came through the Instagram link.
 *
 * Everything downstream (clicks, referrals, conversions, ledger) is unchanged:
 * a channel link is an ordinary ReferralLink with a `source`.
 */
export class ChannelLinkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChannelLinkError";
  }
}

export const LINK_SOURCES: LinkSource[] = ["GENERAL", "INSTAGRAM", "YOUTUBE", "FACEBOOK", "LINKEDIN", "X"];

export const SOURCE_LABEL: Record<LinkSource, string> = {
  GENERAL: "General",
  INSTAGRAM: "Instagram",
  YOUTUBE: "YouTube",
  FACEBOOK: "Facebook",
  LINKEDIN: "LinkedIn",
  X: "X",
};

/** Where each link is meant to be pasted — shown next to the link in the dashboard. */
export const SOURCE_HINT: Record<LinkSource, string> = {
  GENERAL: "Anywhere — WhatsApp, e-mail, a blog post.",
  INSTAGRAM: "Bio, story link sticker, or a DM.",
  YOUTUBE: "Video or livestream description, or a pinned comment.",
  FACEBOOK: "A post, your page, or a live description.",
  LINKEDIN: "A post, or your featured section.",
  X: "A post, or your profile link.",
};

export const channelLinkSelect = {
  id: true,
  code: true,
  source: true,
  status: true,
  createdAt: true,
  campaign: { select: { id: true, name: true, slug: true, status: true, startDate: true, endDate: true, brand: { select: { name: true, slug: true, logoUrl: true } } } },
  _count: { select: { clicks: true, referrals: true } },
} satisfies Prisma.ReferralLinkSelect;

export type ChannelLink = Prisma.ReferralLinkGetPayload<{ select: typeof channelLinkSelect }>;

/** Every link a partner holds, newest campaign first, grouped by campaign in the UI. */
export async function listPartnerChannelLinks(ownerId: string): Promise<ChannelLink[]> {
  return prisma.referralLink.findMany({
    where: { ownerId },
    orderBy: [{ campaignId: "asc" }, { source: "asc" }],
    select: channelLinkSelect,
  });
}

/**
 * Issues (or returns) the partner's link for one channel of a campaign.
 *
 * Requires an existing partnership: a channel link is an extra address for a
 * partner who already has a general link, never a way to join a campaign.
 */
export async function createChannelLink(input: { ownerId: string; campaignId: string; source: LinkSource }, now = new Date()): Promise<ChannelLink> {
  if (!LINK_SOURCES.includes(input.source)) throw new ChannelLinkError("Unknown channel.");

  return transaction(async (tx) => {
    const general = await tx.referralLink.findUnique({
      where: { campaignId_ownerId_source: { campaignId: input.campaignId, ownerId: input.ownerId, source: "GENERAL" } },
      include: {
        campaign: { select: { id: true, name: true, status: true, startDate: true, endDate: true, brand: { select: { name: true } } } },
        owner: { select: { name: true, creatorProfile: { select: { username: true, displayName: true } } } },
      },
    });
    if (!general) throw new ChannelLinkError("Join the campaign first — channel links are added to an existing referral link.");
    if (general.status !== "ACTIVE") throw new ChannelLinkError("Your referral link for this campaign is disabled.");
    if (!isCampaignLive(general.campaign, now)) throw new ChannelLinkError("This campaign is not running, so new links cannot be issued.");

    const existing = await tx.referralLink.findUnique({
      where: { campaignId_ownerId_source: { campaignId: input.campaignId, ownerId: input.ownerId, source: input.source } },
      select: channelLinkSelect,
    });
    if (existing) return existing; // idempotent: asking twice returns the same link

    const handle = general.owner.creatorProfile?.username ?? general.owner.creatorProfile?.displayName ?? general.owner.name;
    for (let attempt = 0; attempt < 5; attempt++) {
      const code =
        general.partnerType === "CUSTOMER" ? generateCustomerReferralCode() : generateReferralCode(handle, general.campaign.brand.name, input.source);
      if (await tx.referralLink.findUnique({ where: { code }, select: { id: true } })) continue;
      const created = await tx.referralLink.create({
        data: { campaignId: input.campaignId, ownerId: input.ownerId, partnerType: general.partnerType, source: input.source, code },
        select: channelLinkSelect,
      });
      await recordAudit(
        { userId: input.ownerId, action: "CHANNEL_LINK_CREATED", entityType: "ReferralLink", entityId: created.id, metadata: { campaignId: input.campaignId, source: input.source } },
        tx,
      );
      return created;
    }
    throw new ChannelLinkError("Could not generate a unique code. Please try again.");
  });
}

export type SourcePerformance = {
  source: LinkSource;
  links: number;
  clicks: number;
  qrScans: number;
  orders: number;
  revenue: number;
  commission: number;
  /** Verified orders ÷ clicks, or null when there are no clicks yet. */
  conversionRate: number | null;
};

/**
 * Per-channel performance for one partner. Only channels with a link appear —
 * there is no row for a platform the creator never shared on, and no figure is
 * inferred from anything but a tracked link.
 */
export async function partnerSourcePerformance(ownerId: string): Promise<SourcePerformance[]> {
  const links = await prisma.referralLink.findMany({
    where: { ownerId },
    select: {
      source: true,
      _count: { select: { clicks: true } },
      clicks: { where: { source: "QR" }, select: { id: true } },
      referrals: {
        where: { status: "VERIFIED" },
        select: { conversion: { select: { amount: true } }, commissions: { select: { amount: true, status: true } }, rewards: { select: { amount: true, status: true } } },
      },
    },
  });

  const bySource = new Map<LinkSource, SourcePerformance>();
  for (const link of links) {
    const row = bySource.get(link.source) ?? { source: link.source, links: 0, clicks: 0, qrScans: 0, orders: 0, revenue: 0, commission: 0, conversionRate: null };
    row.links += 1;
    row.clicks += link._count.clicks;
    row.qrScans += link.clicks.length;
    row.orders += link.referrals.length;
    for (const referral of link.referrals) {
      row.revenue += referral.conversion?.amount ?? 0;
      // Earned money only: reversed or rejected ledger rows never count.
      for (const c of referral.commissions) if (c.status === "APPROVED" || c.status === "PAID") row.commission += c.amount;
      for (const r of referral.rewards) if (r.status === "AVAILABLE" || r.status === "APPROVED" || r.status === "REDEEMED") row.commission += r.amount;
    }
    bySource.set(link.source, row);
  }

  return [...bySource.values()]
    .map((row) => ({ ...row, conversionRate: row.clicks ? row.orders / row.clicks : null }))
    .sort((a, b) => b.revenue - a.revenue || b.clicks - a.clicks);
}

/** The same breakdown for a brand: which channels its partners actually sell through. */
export async function brandSourcePerformance(brandId: string): Promise<SourcePerformance[]> {
  const links = await prisma.referralLink.findMany({
    where: { campaign: { brandId } },
    select: {
      source: true,
      _count: { select: { clicks: true } },
      clicks: { where: { source: "QR" }, select: { id: true } },
      referrals: { where: { status: "VERIFIED" }, select: { conversion: { select: { amount: true } }, commissions: { select: { amount: true, status: true } }, rewards: { select: { amount: true, status: true } } } },
    },
  });

  const bySource = new Map<LinkSource, SourcePerformance>();
  for (const link of links) {
    const row = bySource.get(link.source) ?? { source: link.source, links: 0, clicks: 0, qrScans: 0, orders: 0, revenue: 0, commission: 0, conversionRate: null };
    row.links += 1;
    row.clicks += link._count.clicks;
    row.qrScans += link.clicks.length;
    row.orders += link.referrals.length;
    for (const referral of link.referrals) {
      row.revenue += referral.conversion?.amount ?? 0;
      for (const c of referral.commissions) if (c.status === "APPROVED" || c.status === "PAID") row.commission += c.amount;
      for (const r of referral.rewards) if (r.status === "AVAILABLE" || r.status === "APPROVED" || r.status === "REDEEMED") row.commission += r.amount;
    }
    bySource.set(link.source, row);
  }
  return [...bySource.values()]
    .map((row) => ({ ...row, conversionRate: row.clicks ? row.orders / row.clicks : null }))
    .sort((a, b) => b.revenue - a.revenue || b.clicks - a.clicks);
}

/** Campaigns the partner is in, for the "add a channel link" picker. */
export async function partnerCampaignsForLinks(ownerId: string) {
  const links = await prisma.referralLink.findMany({
    where: { ownerId, source: "GENERAL", status: "ACTIVE" },
    select: { campaignId: true, campaign: { select: { name: true, status: true, startDate: true, endDate: true, brand: { select: { name: true } } } } },
  });
  return links
    .filter((l) => isCampaignLive(l.campaign))
    .map((l) => ({ campaignId: l.campaignId, name: l.campaign.name, brandName: l.campaign.brand.name }));
}
