import type { Prisma } from "@prisma/client";
import { prisma, transaction } from "@/lib/db/prisma";
import { UGC_ACTIVE_STATUSES } from "@/lib/ugc/options";
import { recordAudit } from "./audit";

/*
 * Creator partnerships: every creator a brand works with, in one place, with
 * what each relationship produced. A creator is a partner of a brand when any
 * of these is true:
 *   - an APPROVED creator application on one of the brand's campaigns,
 *   - an ACCEPTED connection,
 *   - an accepted UGC collaboration (in progress, submitted or approved).
 *
 * Results come from the existing ledger: clicks on the creator's links, VERIFIED
 * referrals, their order value and commissions (non-rejected). Nothing is
 * estimated, and self-reported social numbers stay labelled as such in the UI.
 */

export class PartnershipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PartnershipError";
  }
}

const UGC_ACTIVE = [...UGC_ACTIVE_STATUSES];

export type PartnerStats = { campaigns: number; clicks: number; verified: number; revenue: number; commission: number; commissionPaid: number; ugc: number; ugcFees: number };

const emptyStats = (): PartnerStats => ({ campaigns: 0, clicks: 0, verified: 0, revenue: 0, commission: 0, commissionPaid: 0, ugc: 0, ugcFees: 0 });

const linkResultsSelect = {
  campaignId: true,
  ownerId: true,
  code: true,
  source: true,
  _count: { select: { clicks: true } },
  referrals: {
    where: { status: "VERIFIED" },
    select: { conversion: { select: { amount: true } }, commissions: { select: { amount: true, status: true } } },
  },
} satisfies Prisma.ReferralLinkSelect;

type LinkResult = Prisma.ReferralLinkGetPayload<{ select: typeof linkResultsSelect }>;

function addLink(stats: PartnerStats, link: LinkResult) {
  stats.clicks += link._count.clicks;
  stats.verified += link.referrals.length;
  for (const r of link.referrals) {
    stats.revenue += r.conversion?.amount ?? 0;
    for (const c of r.commissions) {
      if (c.status === "REJECTED" || c.status === "REVERSED") continue;
      stats.commission += c.amount;
      if (c.status === "PAID") stats.commissionPaid += c.amount;
    }
  }
}

const creatorSelect = {
  id: true,
  name: true,
  creatorProfile: { select: { displayName: true, username: true, profileImageUrl: true, category: true, location: true, verificationStatus: true } },
} satisfies Prisma.UserSelect;

export type CreatorSummary = Prisma.UserGetPayload<{ select: typeof creatorSelect }>;

// ---------------------------------------------------------------------------
// Brand side
// ---------------------------------------------------------------------------

/** Creator ids that are partners of the brand, with how each relationship started. */
async function partnerIds(brandId: string, creatorId?: string) {
  const [apps, connections, ugc] = await Promise.all([
    prisma.partnerApplication.findMany({
      where: { campaign: { brandId }, partnerType: "CREATOR", status: "APPROVED", ...(creatorId ? { userId: creatorId } : {}) },
      select: { userId: true, createdAt: true, campaignId: true },
    }),
    prisma.connection.findMany({ where: { brandId, status: "ACCEPTED", ...(creatorId ? { creatorId } : {}) }, select: { creatorId: true, createdAt: true } }),
    prisma.ugcCollaboration.findMany({
      where: { brief: { brandId }, status: { in: UGC_ACTIVE }, ...(creatorId ? { creatorId } : {}) },
      select: { creatorId: true, acceptedAt: true, createdAt: true, agreedFee: true, status: true },
    }),
  ]);
  const map = new Map<string, { since: Date; campaignIds: Set<string>; connected: boolean; ugc: number; ugcFees: number }>();
  const entry = (id: string, at: Date) => {
    const e = map.get(id) ?? { since: at, campaignIds: new Set<string>(), connected: false, ugc: 0, ugcFees: 0 };
    if (at < e.since) e.since = at;
    map.set(id, e);
    return e;
  };
  for (const a of apps) entry(a.userId, a.createdAt).campaignIds.add(a.campaignId);
  for (const c of connections) entry(c.creatorId, c.createdAt).connected = true;
  for (const u of ugc) {
    const e = entry(u.creatorId, u.acceptedAt ?? u.createdAt);
    e.ugc += 1;
    if (u.status === "APPROVED") e.ugcFees += u.agreedFee ?? 0;
  }
  return map;
}

export type BrandPartnerRow = { creator: CreatorSummary; since: Date; connected: boolean; stats: PartnerStats };

export async function listBrandPartners(brandId: string, q?: string): Promise<BrandPartnerRow[]> {
  const ids = await partnerIds(brandId);
  if (!ids.size) return [];
  const creatorIds = [...ids.keys()];
  const [creators, links] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: creatorIds } }, select: creatorSelect }),
    prisma.referralLink.findMany({ where: { campaign: { brandId }, partnerType: "CREATOR", ownerId: { in: creatorIds } }, select: linkResultsSelect }),
  ]);
  const stats = new Map(creatorIds.map((id) => [id, emptyStats()]));
  for (const l of links) addLink(stats.get(l.ownerId)!, l);

  const needle = q?.trim().toLowerCase();
  return creators
    .map((creator) => {
      const meta = ids.get(creator.id)!;
      const s = stats.get(creator.id)!;
      s.campaigns = meta.campaignIds.size;
      s.ugc = meta.ugc;
      s.ugcFees = meta.ugcFees;
      return { creator, since: meta.since, connected: meta.connected, stats: s };
    })
    .filter((r) => !needle || [r.creator.name, r.creator.creatorProfile?.displayName, r.creator.creatorProfile?.username].some((v) => v?.toLowerCase().includes(needle)))
    .sort((a, b) => b.stats.revenue - a.stats.revenue || b.stats.verified - a.stats.verified || b.since.getTime() - a.since.getTime());
}

/** Everything a brand has done with one creator. Null when they are not partners. */
export async function getBrandPartner(brandId: string, creatorId: string) {
  const ids = await partnerIds(brandId, creatorId);
  const meta = ids.get(creatorId);
  if (!meta) return null;

  const [creator, campaigns, links, ugc, notes, connection] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: creatorId },
      select: { ...creatorSelect, creatorProfile: { select: { ...creatorSelect.creatorProfile.select, bio: true, instagramFollowers: true, youtubeSubscribers: true } } },
    }),
    prisma.partnerApplication.findMany({
      where: { userId: creatorId, campaign: { brandId }, partnerType: "CREATOR" },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true, createdAt: true, campaign: { select: { id: true, name: true, status: true, product: { select: { name: true, imageUrl: true } } } } },
    }),
    prisma.referralLink.findMany({ where: { campaign: { brandId }, ownerId: creatorId, partnerType: "CREATOR" }, select: linkResultsSelect }),
    prisma.ugcCollaboration.findMany({
      where: { creatorId, brief: { brandId }, status: { notIn: ["WITHDRAWN"] } },
      orderBy: { updatedAt: "desc" },
      select: { id: true, status: true, agreedFee: true, paidMarkedAt: true, paidConfirmedAt: true, updatedAt: true, brief: { select: { id: true, title: true, feeAmount: true } } },
    }),
    prisma.partnerNote.findMany({ where: { brandId, creatorId }, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, body: true, createdAt: true, author: { select: { name: true } } } }),
    prisma.connection.findUnique({ where: { brandId_creatorId: { brandId, creatorId } }, select: { status: true, createdAt: true } }),
  ]);

  const total = emptyStats();
  const byCampaign = new Map<string, PartnerStats & { codes: string[] }>();
  for (const l of links) {
    addLink(total, l);
    const row = byCampaign.get(l.campaignId) ?? { ...emptyStats(), codes: [] };
    addLink(row, l);
    row.codes.push(l.code);
    byCampaign.set(l.campaignId, row);
  }
  total.campaigns = meta.campaignIds.size;
  total.ugc = meta.ugc;
  total.ugcFees = meta.ugcFees;

  return {
    creator,
    since: meta.since,
    connection,
    stats: total,
    campaigns: campaigns.map((a) => ({ ...a, results: byCampaign.get(a.campaign.id) ?? { ...emptyStats(), codes: [] } })),
    ugc,
    notes,
  };
}

export async function addPartnerNote(brandId: string, authorId: string, creatorId: string, body: string) {
  if (!(await partnerIds(brandId, creatorId)).has(creatorId)) throw new PartnershipError("You can only keep notes about creators you work with.");
  return transaction(async (tx) => {
    const note = await tx.partnerNote.create({ data: { brandId, creatorId, authorId, body } });
    await recordAudit({ userId: authorId, action: "PARTNER_NOTE_ADDED", entityType: "PartnerNote", entityId: note.id, metadata: { brandId, creatorId } }, tx);
    return note;
  });
}

export async function deletePartnerNote(brandId: string, actorId: string, noteId: string) {
  return transaction(async (tx) => {
    const note = await tx.partnerNote.findFirst({ where: { id: noteId, brandId } });
    if (!note) throw new PartnershipError("Note not found.");
    await tx.partnerNote.delete({ where: { id: noteId } });
    await recordAudit({ userId: actorId, action: "PARTNER_NOTE_DELETED", entityType: "PartnerNote", entityId: noteId, metadata: { brandId, creatorId: note.creatorId } }, tx);
  });
}

// ---------------------------------------------------------------------------
// Creator side
// ---------------------------------------------------------------------------

export type CreatorPartnershipRow = {
  brand: { id: string; name: string; slug: string; logoUrl: string | null; industry: string | null };
  since: Date;
  connected: boolean;
  stats: PartnerStats;
};

/** Every brand the creator works with and what each relationship produced for them. */
export async function listCreatorPartnerships(creatorId: string): Promise<CreatorPartnershipRow[]> {
  const [apps, connections, ugc, links] = await Promise.all([
    prisma.partnerApplication.findMany({ where: { userId: creatorId, partnerType: "CREATOR", status: "APPROVED" }, select: { createdAt: true, campaignId: true, campaign: { select: { brandId: true } } } }),
    prisma.connection.findMany({ where: { creatorId, status: "ACCEPTED" }, select: { brandId: true, createdAt: true } }),
    prisma.ugcCollaboration.findMany({ where: { creatorId, status: { in: UGC_ACTIVE } }, select: { acceptedAt: true, createdAt: true, agreedFee: true, status: true, brief: { select: { brandId: true } } } }),
    prisma.referralLink.findMany({ where: { ownerId: creatorId, partnerType: "CREATOR" }, select: { ...linkResultsSelect, campaign: { select: { brandId: true } } } }),
  ]);

  const map = new Map<string, { since: Date; connected: boolean; campaigns: Set<string>; stats: PartnerStats }>();
  const entry = (brandId: string, at: Date) => {
    const e = map.get(brandId) ?? { since: at, connected: false, campaigns: new Set<string>(), stats: emptyStats() };
    if (at < e.since) e.since = at;
    map.set(brandId, e);
    return e;
  };
  for (const a of apps) entry(a.campaign.brandId, a.createdAt).campaigns.add(a.campaignId);
  for (const c of connections) entry(c.brandId, c.createdAt).connected = true;
  for (const u of ugc) {
    const e = entry(u.brief.brandId, u.acceptedAt ?? u.createdAt);
    e.stats.ugc += 1;
    if (u.status === "APPROVED") e.stats.ugcFees += u.agreedFee ?? 0;
  }
  for (const l of links) {
    const e = map.get(l.campaign.brandId);
    if (e) addLink(e.stats, l);
  }
  if (!map.size) return [];

  const brands = await prisma.brand.findMany({ where: { id: { in: [...map.keys()] } }, select: { id: true, name: true, slug: true, logoUrl: true, industry: true } });
  return brands
    .map((brand) => {
      const e = map.get(brand.id)!;
      e.stats.campaigns = e.campaigns.size;
      return { brand, since: e.since, connected: e.connected, stats: e.stats };
    })
    .sort((a, b) => b.stats.commission + b.stats.ugcFees - (a.stats.commission + a.stats.ugcFees) || b.since.getTime() - a.since.getTime());
}
