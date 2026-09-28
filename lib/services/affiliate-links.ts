import type { LinkSource, Prisma } from "@prisma/client";
import { prisma, transaction } from "@/lib/db/prisma";
import { generateReferralCode, normalizeReferralCode } from "@/lib/utils/codes";
import { recordAudit } from "./audit";
import { appOrigin } from "./links";
import { DUPLICATE_CLICK_WINDOW_MS, hashValue } from "./tracking";

/**
 * Creators' links into EXTERNAL affiliate programmes.
 *
 * The creator is approved by the external network, gets their own affiliate URL
 * there, and saves it here. Refnivo then issues short tracking codes — one per
 * platform — that record a click and forward to that URL. That is the entire
 * relationship: Refnivo counts clicks it observed; the network owns the sale,
 * the commission and the payment. No row in this module creates an obligation
 * for Refnivo, and nothing here reports conversions or revenue.
 */
export class AffiliateLinkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AffiliateLinkError";
  }
}

/**
 * Refuses a destination that would loop back into Refnivo (or be abused as a
 * redirect through us) or that is not an ordinary web link.
 */
export function assertSafeTarget(url: string, origin = appOrigin()): string {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    throw new AffiliateLinkError("That is not a valid link.");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new AffiliateLinkError("Only http(s) links are allowed.");
  const own = new URL(origin).hostname.replace(/^www\./, "");
  if (parsed.hostname.replace(/^www\./, "") === own || parsed.hostname.endsWith(`.${own}`)) {
    throw new AffiliateLinkError("Paste the affiliate link the external programme gave you, not a Refnivo link.");
  }
  return parsed.toString();
}

/**
 * Appends the network's sub-id parameter when — and only when — the programme
 * declares one. Parameters a network does not understand can break its tracking.
 */
export function withSubId(targetUrl: string, subIdParam: string | null, subId: string): string {
  if (!subIdParam) return targetUrl;
  const url = new URL(targetUrl);
  url.searchParams.set(subIdParam, subId);
  return url.toString();
}

/** Short, non-reversible click reference for the sub id: never an internal database id. */
export function subIdFor(code: string, clickRef: string): string {
  return `rfn_${code.toLowerCase()}_${clickRef}`.slice(0, 64);
}

export const affiliateLinkSelect = {
  id: true,
  targetUrl: true,
  status: true,
  externalAffiliateId: true,
  note: true,
  createdAt: true,
  program: { select: { id: true, name: true, slug: true, status: true, logoUrl: true, networkName: true, commissionDescription: true, brandName: true, brand: { select: { name: true, logoUrl: true } } } },
  codes: { select: { id: true, code: true, source: true, status: true, _count: { select: { clicks: true } } }, orderBy: { source: "asc" as const } },
  _count: { select: { clicks: true } },
} satisfies Prisma.CreatorAffiliateLinkSelect;

export type CreatorAffiliateLinkRow = Prisma.CreatorAffiliateLinkGetPayload<{ select: typeof affiliateLinkSelect }>;

export async function listCreatorAffiliateLinks(creatorId: string): Promise<CreatorAffiliateLinkRow[]> {
  return prisma.creatorAffiliateLink.findMany({ where: { creatorId }, orderBy: { updatedAt: "desc" }, select: affiliateLinkSelect });
}

export async function creatorLinkForProgram(creatorId: string, programId: string) {
  return prisma.creatorAffiliateLink.findUnique({ where: { creatorId_affiliateProgramId: { creatorId, affiliateProgramId: programId } }, select: affiliateLinkSelect });
}

/** A code free in BOTH namespaces: campaign referral links and affiliate codes share /r/CODE. */
async function freeCode(tx: Prisma.TransactionClient, handle: string, brandName: string, source: LinkSource): Promise<string> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = generateReferralCode(handle, brandName, source);
    const [a, b] = await Promise.all([
      tx.referralLink.findUnique({ where: { code }, select: { id: true } }),
      tx.affiliateTrackingCode.findUnique({ where: { code }, select: { id: true } }),
    ]);
    if (!a && !b) return code;
  }
  throw new AffiliateLinkError("Could not generate a unique code. Please try again.");
}

/**
 * Saves (or updates) the creator's own affiliate URL for a published programme
 * and makes sure they have a general tracking code for it.
 */
export async function saveAffiliateLink(input: { creatorId: string; programId: string; targetUrl: string; externalAffiliateId?: string | null; note?: string | null }) {
  const target = assertSafeTarget(input.targetUrl);
  return transaction(async (tx) => {
    const program = await tx.affiliateProgram.findFirst({
      where: { id: input.programId, status: "APPROVED", OR: [{ brandId: null }, { brand: { status: "ACTIVE" } }] },
      select: { id: true, name: true, brandName: true, brand: { select: { name: true } } },
    });
    if (!program) throw new AffiliateLinkError("That programme is not open on Refnivo right now.");
    const creator = await tx.user.findUnique({ where: { id: input.creatorId }, select: { name: true, creatorProfile: { select: { username: true, displayName: true } } } });
    if (!creator?.creatorProfile) throw new AffiliateLinkError("Create your creator profile first.");

    const link = await tx.creatorAffiliateLink.upsert({
      where: { creatorId_affiliateProgramId: { creatorId: input.creatorId, affiliateProgramId: program.id } },
      create: { creatorId: input.creatorId, affiliateProgramId: program.id, targetUrl: target, externalAffiliateId: input.externalAffiliateId || null, note: input.note || null },
      update: { targetUrl: target, externalAffiliateId: input.externalAffiliateId || null, note: input.note || null, status: "ACTIVE" },
    });
    const general = await tx.affiliateTrackingCode.findUnique({ where: { creatorAffiliateLinkId_source: { creatorAffiliateLinkId: link.id, source: "GENERAL" } } });
    if (!general) {
      const handle = creator.creatorProfile.username ?? creator.creatorProfile.displayName ?? creator.name;
      await tx.affiliateTrackingCode.create({ data: { creatorAffiliateLinkId: link.id, source: "GENERAL", code: await freeCode(tx, handle, program.brand?.name ?? program.brandName ?? program.name, "GENERAL") } });
    }
    await recordAudit({ userId: input.creatorId, action: "AFFILIATE_LINK_SAVED", entityType: "CreatorAffiliateLink", entityId: link.id, metadata: { programId: program.id } }, tx);
    return tx.creatorAffiliateLink.findUniqueOrThrow({ where: { id: link.id }, select: affiliateLinkSelect });
  });
}

/** Issues (idempotently) a platform-specific tracking code for the creator's own link. */
export async function addAffiliateCode(input: { creatorId: string; linkId: string; source: LinkSource }) {
  return transaction(async (tx) => {
    const link = await tx.creatorAffiliateLink.findFirst({
      where: { id: input.linkId, creatorId: input.creatorId },
      include: { program: { select: { status: true, name: true, brandName: true, brand: { select: { name: true } } } }, creator: { select: { name: true, creatorProfile: { select: { username: true, displayName: true } } } } },
    });
    if (!link) throw new AffiliateLinkError("Link not found.");
    if (link.status !== "ACTIVE" || link.program.status !== "APPROVED") throw new AffiliateLinkError("This programme is not open on Refnivo right now.");

    const existing = await tx.affiliateTrackingCode.findUnique({ where: { creatorAffiliateLinkId_source: { creatorAffiliateLinkId: link.id, source: input.source } } });
    if (existing) return existing;
    const handle = link.creator.creatorProfile?.username ?? link.creator.creatorProfile?.displayName ?? link.creator.name;
    return tx.affiliateTrackingCode.create({ data: { creatorAffiliateLinkId: link.id, source: input.source, code: await freeCode(tx, handle, link.program.brand?.name ?? link.program.brandName ?? link.program.name, input.source) } });
  });
}

export async function removeAffiliateLink(creatorId: string, linkId: string) {
  const link = await prisma.creatorAffiliateLink.findFirst({ where: { id: linkId, creatorId }, select: { id: true } });
  if (!link) throw new AffiliateLinkError("Link not found.");
  // Disabled, not deleted: the click history stays attributable.
  await prisma.creatorAffiliateLink.update({ where: { id: link.id }, data: { status: "DISABLED" } });
  await prisma.affiliateTrackingCode.updateMany({ where: { creatorAffiliateLinkId: link.id }, data: { status: "DISABLED" } });
}

// ─── redirect ─────────────────────────────────────────────────────────────────

/**
 * Resolves an affiliate tracking code for the /r/CODE redirect. Returns null
 * when the code is not an affiliate code at all (so the caller can fall back to
 * campaign links), and `{ ok: false }` when it is one but must not forward.
 */
export async function resolveAffiliateCode(rawCode: string) {
  const code = normalizeReferralCode(rawCode);
  const row = await prisma.affiliateTrackingCode.findUnique({
    where: { code },
    include: { link: { include: { program: { select: { id: true, slug: true, status: true, subIdParam: true, brand: { select: { status: true } } } } } } },
  });
  if (!row) return null;
  const usable =
    row.status === "ACTIVE" && row.link.status === "ACTIVE" && row.link.program.status === "APPROVED" && (!row.link.program.brand || row.link.program.brand.status === "ACTIVE");
  return usable ? { ok: true as const, row } : { ok: false as const, programSlug: row.link.program.slug };
}

/**
 * Records a click on an affiliate code. Repeat hits from the same visitor inside
 * the duplicate window are not counted again, mirroring campaign clicks. Returns
 * the sub id to append (or null when the programme declares none).
 */
export async function recordAffiliateClick(input: {
  code: string;
  trackingCodeId: string;
  linkId: string;
  programId: string;
  creatorId: string;
  source: LinkSource;
  visitorId: string;
  ip: string | null;
  userAgent: string | null;
  referer: string | null;
  subIdParam: string | null;
}): Promise<{ counted: boolean; subId: string | null }> {
  const since = new Date(Date.now() - DUPLICATE_CLICK_WINDOW_MS);
  const recent = await prisma.affiliateClick.findFirst({ where: { trackingCodeId: input.trackingCodeId, anonymousVisitorId: input.visitorId, createdAt: { gte: since } }, select: { subId: true } });
  if (recent) return { counted: false, subId: recent.subId };

  const ref = hashValue(`${input.visitorId}:${Date.now()}`).slice(0, 10);
  const subId = input.subIdParam ? subIdFor(input.code, ref) : null;
  await prisma.affiliateClick.create({
    data: {
      trackingCodeId: input.trackingCodeId,
      creatorAffiliateLinkId: input.linkId,
      affiliateProgramId: input.programId,
      creatorId: input.creatorId,
      source: input.source,
      anonymousVisitorId: input.visitorId,
      ipHash: input.ip ? hashValue(input.ip) : null,
      userAgent: input.userAgent?.slice(0, 300) ?? null,
      referer: input.referer?.slice(0, 300) ?? null,
      subId,
    },
  });
  return { counted: true, subId };
}

// ─── analytics: clicks only ───────────────────────────────────────────────────

export type AffiliateClickStats = { clicks: number; uniqueVisitors: number; bySource: { source: LinkSource; clicks: number }[]; byProgram: { programId: string; name: string; clicks: number }[] };

/**
 * What Refnivo actually observed. There is intentionally no conversion, revenue
 * or commission figure here: for an external programme those live with the
 * network, and until a verified integration imports them they are unknown.
 */
export async function creatorAffiliateStats(creatorId: string): Promise<AffiliateClickStats> {
  const [clicks, visitors, bySource, byProgram] = await Promise.all([
    prisma.affiliateClick.count({ where: { creatorId } }),
    prisma.affiliateClick.findMany({ where: { creatorId, anonymousVisitorId: { not: null } }, distinct: ["anonymousVisitorId"], select: { anonymousVisitorId: true } }),
    prisma.affiliateClick.groupBy({ by: ["source"], where: { creatorId }, _count: { _all: true } }),
    prisma.affiliateClick.groupBy({ by: ["affiliateProgramId"], where: { creatorId }, _count: { _all: true } }),
  ]);
  const names = await prisma.affiliateProgram.findMany({ where: { id: { in: byProgram.map((p) => p.affiliateProgramId) } }, select: { id: true, name: true } });
  const nameOf = new Map(names.map((n) => [n.id, n.name]));
  return {
    clicks,
    uniqueVisitors: visitors.length,
    bySource: bySource.map((s) => ({ source: s.source, clicks: s._count._all })).sort((a, b) => b.clicks - a.clicks),
    byProgram: byProgram.map((p) => ({ programId: p.affiliateProgramId, name: nameOf.get(p.affiliateProgramId) ?? "Programme", clicks: p._count._all })).sort((a, b) => b.clicks - a.clicks),
  };
}

/** Brand view of a programme: creators who saved a link, and traffic Refnivo forwarded. */
export async function programTrafficStats(programId: string) {
  const [creators, clicks, bySource] = await Promise.all([
    prisma.creatorAffiliateLink.count({ where: { affiliateProgramId: programId } }),
    prisma.affiliateClick.count({ where: { affiliateProgramId: programId } }),
    prisma.affiliateClick.groupBy({ by: ["source"], where: { affiliateProgramId: programId }, _count: { _all: true } }),
  ]);
  return { creators, clicks, bySource: bySource.map((s) => ({ source: s.source, clicks: s._count._all })).sort((a, b) => b.clicks - a.clicks) };
}
