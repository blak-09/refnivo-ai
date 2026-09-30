import type { AffiliateProgramStatus, AffiliateProgramType, Prisma } from "@prisma/client";
import { prisma, transaction } from "@/lib/db/prisma";
import { slugify } from "@/lib/utils/slug";
import type { AdminAffiliateProgramValues, AffiliateProgramValues } from "@/lib/validation/affiliate";
import { PROGRAM_TYPE_LABEL } from "@/lib/validation/affiliate";
import { checkProgramUrl, type LinkChecker } from "./affiliate-link-check";
import { recordAudit } from "./audit";
import { adminUserIds, notify, notifyMany } from "./notify";

/**
 * Listings for affiliate programmes brands ALREADY run elsewhere.
 *
 * Lifecycle: DRAFT → PENDING_REVIEW → APPROVED (published) | REJECTED, then
 * PAUSED / CLOSED. A listing is only visible to creators once an admin approved
 * it — there is no auto-publish, because the programme's terms and URLs are
 * claims made by the brand and have to be checked by a person.
 *
 * Refnivo takes on no commission liability here: the rows describe the external
 * programme's terms, they do not define payouts.
 *
 * Most listings belong to a brand's Refnivo account. An admin can also list a
 * programme from public information before the brand joins ("curated"): such a
 * row has no brandId, only a brandName, and says so wherever it is shown.
 */
export class AffiliateProgramError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AffiliateProgramError";
  }
}

/** Only a brand's own draft, rejected or paused listing can be edited. */
const EDITABLE: AffiliateProgramStatus[] = ["DRAFT", "REJECTED", "PAUSED", "APPROVED"];

async function uniqueSlug(base: string, tx: Prisma.TransactionClient, excludeId?: string): Promise<string> {
  const root = slugify(base) || "program";
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    const clash = await tx.affiliateProgram.findFirst({ where: { slug: candidate, ...(excludeId ? { NOT: { id: excludeId } } : {}) }, select: { id: true } });
    if (!clash) return candidate;
  }
  return `${root}-${Date.now().toString(36)}`;
}

function toData(values: AffiliateProgramValues) {
  return {
    name: values.name,
    programType: values.programType ?? "AFFILIATE",
    description: values.description || null,
    category: values.category || null,
    subcategory: values.subcategory || null,
    bestFor: values.bestFor ?? [],
    websiteUrl: values.websiteUrl || null,
    programUrl: values.programUrl || null,
    signupUrl: values.signupUrl,
    logoUrl: values.logoUrl || null,
    commissionType: values.commissionType || null,
    commissionDescription: values.commissionDescription || null,
    cookieDurationDays: values.cookieDurationDays ?? null,
    networkName: values.networkName || null,
    approvalType: values.approvalType || null,
    minFollowers: values.minFollowers ?? null,
    supportedPlatforms: values.supportedPlatforms ?? [],
    geography: values.geography || null,
    requirements: values.requirements || null,
    subIdParam: values.subIdParam || null,
  };
}

/** Host without "www." — so https://www.x.com/a and http://x.com/b count as the same site. */
function hostOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

function normalisedUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return `${u.hostname.toLowerCase().replace(/^www\./, "")}${u.pathname.replace(/\/+$/, "")}`.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Refuses a second listing for the same programme: the same official programme
 * or signup URL, or — for a listing without a brand account — the same brand
 * name or brand website. Closed listings are ignored so a programme can be
 * relisted. A brand with several genuine programmes lists each under its own
 * programme URL.
 */
async function assertNotDuplicate(
  tx: Prisma.TransactionClient,
  input: { brandId: string | null; brandName: string | null; websiteUrl: string | null; programUrl: string | null; signupUrl: string },
  excludeId?: string,
) {
  const others = await tx.affiliateProgram.findMany({
    where: { status: { not: "CLOSED" }, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
    select: { name: true, brandId: true, brandName: true, websiteUrl: true, programUrl: true, signupUrl: true },
  });
  const urls = new Set([normalisedUrl(input.programUrl), normalisedUrl(input.signupUrl)].filter(Boolean));
  const name = input.brandName?.trim().toLowerCase() || null;
  const site = hostOf(input.websiteUrl);
  for (const o of others) {
    const theirs = [normalisedUrl(o.programUrl), normalisedUrl(o.signupUrl)].filter(Boolean);
    if (theirs.some((u) => urls.has(u))) throw new AffiliateProgramError(`“${o.name}” already lists this programme URL.`);
    if (!input.brandId && !o.brandId) {
      if (name && o.brandName?.trim().toLowerCase() === name) throw new AffiliateProgramError(`${o.brandName} is already listed (“${o.name}”). Edit that listing instead.`);
      if (site && hostOf(o.websiteUrl) === site) throw new AffiliateProgramError(`A listing for ${site} already exists (“${o.name}”).`);
    }
  }
}

/** Creates a listing. `submit` sends it straight to review; otherwise it stays a draft. */
export async function createAffiliateProgram(brandId: string, actorId: string, values: AffiliateProgramValues, opts: { submit: boolean }) {
  return transaction(async (tx) => {
    await assertNotDuplicate(tx, { brandId, brandName: null, websiteUrl: values.websiteUrl || null, programUrl: values.programUrl || null, signupUrl: values.signupUrl });
    const program = await tx.affiliateProgram.create({
      data: {
        brandId,
        slug: await uniqueSlug(values.name, tx),
        ...toData(values),
        status: opts.submit ? "PENDING_REVIEW" : "DRAFT",
        submittedAt: opts.submit ? new Date() : null,
      },
    });
    await recordAudit({ userId: actorId, action: "AFFILIATE_PROGRAM_CREATED", entityType: "AffiliateProgram", entityId: program.id, metadata: { brandId, submitted: opts.submit } }, tx);
    if (opts.submit) await tellAdmins(tx, program.name);
    return program;
  });
}

/**
 * Edits a listing. Changing a published listing sends it back to review, so a
 * brand cannot swap in a different signup URL or commission claim after approval.
 */
export async function updateAffiliateProgram(brandId: string, actorId: string, programId: string, values: AffiliateProgramValues, opts: { submit: boolean }) {
  return transaction(async (tx) => {
    const existing = await tx.affiliateProgram.findFirst({ where: { id: programId, brandId } });
    if (!existing) throw new AffiliateProgramError("Listing not found.");
    if (!EDITABLE.includes(existing.status)) throw new AffiliateProgramError("This listing cannot be edited while it is under review or closed.");

    const backToReview = existing.status === "APPROVED" || opts.submit;
    const program = await tx.affiliateProgram.update({
      where: { id: existing.id },
      data: {
        ...toData(values),
        slug: values.name !== existing.name ? await uniqueSlug(values.name, tx, existing.id) : existing.slug,
        status: backToReview ? "PENDING_REVIEW" : existing.status,
        submittedAt: backToReview ? new Date() : existing.submittedAt,
        // A re-reviewed listing has to be checked again.
        verifiedAt: backToReview ? null : existing.verifiedAt,
      },
    });
    await recordAudit({ userId: actorId, action: "AFFILIATE_PROGRAM_UPDATED", entityType: "AffiliateProgram", entityId: program.id, metadata: { brandId, backToReview } }, tx);
    if (backToReview) await tellAdmins(tx, program.name);
    return program;
  });
}

/** Brand pauses, resumes (re-review) or closes its own listing. */
export async function setAffiliateProgramState(brandId: string, actorId: string, programId: string, action: "PAUSE" | "RESUME" | "CLOSE") {
  return transaction(async (tx) => {
    const existing = await tx.affiliateProgram.findFirst({ where: { id: programId, brandId } });
    if (!existing) throw new AffiliateProgramError("Listing not found.");
    const next: Record<typeof action, { from: AffiliateProgramStatus[]; to: AffiliateProgramStatus }> = {
      PAUSE: { from: ["APPROVED"], to: "PAUSED" },
      // A paused listing goes back through review before it is public again.
      RESUME: { from: ["PAUSED"], to: "PENDING_REVIEW" },
      CLOSE: { from: ["DRAFT", "PENDING_REVIEW", "APPROVED", "REJECTED", "PAUSED"], to: "CLOSED" },
    };
    if (!next[action].from.includes(existing.status)) throw new AffiliateProgramError("That change is not possible from the listing's current state.");
    const program = await tx.affiliateProgram.update({ where: { id: existing.id }, data: { status: next[action].to, ...(action === "RESUME" ? { submittedAt: new Date() } : {}) } });
    await recordAudit({ userId: actorId, action: `AFFILIATE_PROGRAM_${action}`, entityType: "AffiliateProgram", entityId: program.id, metadata: { brandId } }, tx);
    if (action === "RESUME") await tellAdmins(tx, program.name);
    return program;
  });
}

async function tellAdmins(tx: Prisma.TransactionClient, name: string) {
  const admins = await adminUserIds(tx);
  if (!admins.length) return;
  await notifyMany(
    admins,
    { type: "SYSTEM", title: `Affiliate programme to review: ${name}`, body: "Check the brand, the programme URL and the signup URL before approving.", href: "/dashboard/admin/affiliate-programs" },
    tx,
  );
}

/**
 * Admin decision. `verified` records that the reviewer actually checked the
 * brand and opened both URLs — the only thing that lets a listing show a
 * "Verified" mark. Approving without it publishes the listing unverified.
 */
export async function reviewAffiliateProgram(
  adminId: string,
  programId: string,
  input: { decision: "APPROVE" | "REJECT" | "PAUSE"; note?: string | null; verified?: boolean },
  opts: { checkLink?: LinkChecker } = {},
) {
  // Verifying means the official URL works right now: check before writing anything.
  let link: { checkedAt: Date; status: string } | null = null;
  if (input.decision === "APPROVE" && input.verified) {
    const target = await prisma.affiliateProgram.findUnique({ where: { id: programId }, select: { signupUrl: true } });
    if (!target) throw new AffiliateProgramError("Listing not found.");
    const result = await (opts.checkLink ?? checkProgramUrl)(target.signupUrl);
    if (!result.reachable) throw new AffiliateProgramError(`The official program URL is not working (${result.status}). Publish it unverified, or fix the URL first.`);
    link = { checkedAt: result.checkedAt, status: result.status };
  }
  return transaction(async (tx) => {
    const program = await tx.affiliateProgram.findUnique({ where: { id: programId }, include: { brand: { select: { ownerId: true } } } });
    if (!program) throw new AffiliateProgramError("Listing not found.");
    if (input.decision === "REJECT" && !input.note?.trim()) throw new AffiliateProgramError("Tell the brand what to fix.");
    if (input.decision !== "PAUSE" && program.status !== "PENDING_REVIEW") throw new AffiliateProgramError("Only listings waiting for review can be approved or rejected.");

    const status: AffiliateProgramStatus = input.decision === "APPROVE" ? "APPROVED" : input.decision === "REJECT" ? "REJECTED" : "PAUSED";
    const now = new Date();
    const updated = await tx.affiliateProgram.update({
      where: { id: program.id },
      data: {
        status,
        reviewedAt: now,
        reviewedById: adminId,
        reviewNote: input.note?.trim() || null,
        verifiedAt: input.decision === "APPROVE" && input.verified ? now : input.decision === "APPROVE" ? null : program.verifiedAt,
        ...(link ? { linkCheckedAt: link.checkedAt, linkStatus: link.status } : {}),
      },
    });
    // A curated listing has no brand account to tell.
    if (program.brand) {
      await notify(
        {
          userId: program.brand.ownerId,
          type: "SYSTEM",
          title:
            status === "APPROVED" ? `“${program.name}” is live on Refnivo` : status === "REJECTED" ? `“${program.name}” needs changes` : `“${program.name}” was paused`,
          body: input.note?.trim() || (status === "APPROVED" ? "Creators can now find your affiliate programme." : "Open the listing for details."),
          href: "/dashboard/brand/affiliate-programs",
          email: true,
        },
        tx,
      );
    }
    await recordAudit({ userId: adminId, action: `AFFILIATE_PROGRAM_${status}`, entityType: "AffiliateProgram", entityId: program.id, metadata: { verified: !!input.verified } }, tx);
    return updated;
  });
}

// ─── admin maintenance ────────────────────────────────────────────────────────

/** Resolves the brand side of an admin listing: a Refnivo brand account, or just a name. */
async function brandFields(tx: Prisma.TransactionClient, values: AdminAffiliateProgramValues) {
  if (values.brandId) {
    const brand = await tx.brand.findUnique({ where: { id: values.brandId }, select: { id: true } });
    if (!brand) throw new AffiliateProgramError("That brand does not exist.");
    return { brandId: brand.id, brandName: null };
  }
  if (!values.brandName?.trim()) throw new AffiliateProgramError("Enter the brand's name.");
  return { brandId: null, brandName: values.brandName.trim() };
}

/**
 * Resolves the admin's "verified" tick into stored fields. A listing can only be
 * marked verified while its official programme URL works: the URL is checked
 * here and a broken one is refused (status protection).
 */
async function verificationFields(values: AdminAffiliateProgramValues, previous: Date | null, checkLink: LinkChecker) {
  if (!values.verified) return { verifiedAt: null };
  const result = await checkLink(values.signupUrl);
  if (!result.reachable) {
    throw new AffiliateProgramError(`The official program URL is not working (${result.status}), so the listing can't be marked verified. Fix the URL or untick “Verified”.`);
  }
  const on = values.verifiedOn ? new Date(`${values.verifiedOn}T00:00:00.000Z`) : (previous ?? result.checkedAt);
  if (on.getTime() > Date.now() + 24 * 3600_000) throw new AffiliateProgramError("The verification date can't be in the future.");
  return { verifiedAt: on, linkCheckedAt: result.checkedAt, linkStatus: result.status };
}

/**
 * An admin adds a listing — typically a programme a brand runs publicly but has
 * not listed itself. It enters the review queue; the admin publishes it with
 * Approve or Activate.
 */
export async function adminCreateAffiliateProgram(adminId: string, values: AdminAffiliateProgramValues, opts: { checkLink?: LinkChecker } = {}) {
  const verification = await verificationFields(values, null, opts.checkLink ?? checkProgramUrl);
  return transaction(async (tx) => {
    const brand = await brandFields(tx, values);
    await assertNotDuplicate(tx, { ...brand, websiteUrl: values.websiteUrl || null, programUrl: values.programUrl || null, signupUrl: values.signupUrl });
    const program = await tx.affiliateProgram.create({
      data: {
        ...brand,
        slug: await uniqueSlug(values.name, tx),
        ...toData(values),
        featured: values.featured,
        sourceUrl: values.sourceUrl || null,
        ...verification,
        status: "PENDING_REVIEW",
        submittedAt: new Date(),
      },
    });
    await recordAudit(
      { userId: adminId, action: "AFFILIATE_PROGRAM_CREATED", entityType: "AffiliateProgram", entityId: program.id, metadata: { byAdmin: true, curated: !brand.brandId, verified: !!verification.verifiedAt } },
      tx,
    );
    return program;
  });
}

/**
 * An admin edits any listing without changing its status. "Verified" is set
 * from the form, and keeping it re-checks the official URL, so an edited URL is
 * never left marked verified without a working page behind it.
 */
export async function adminUpdateAffiliateProgram(adminId: string, programId: string, values: AdminAffiliateProgramValues, opts: { checkLink?: LinkChecker } = {}) {
  const current = await prisma.affiliateProgram.findUnique({ where: { id: programId }, select: { verifiedAt: true } });
  if (!current) throw new AffiliateProgramError("Listing not found.");
  const verification = await verificationFields(values, current.verifiedAt, opts.checkLink ?? checkProgramUrl);
  return transaction(async (tx) => {
    const existing = await tx.affiliateProgram.findUnique({ where: { id: programId } });
    if (!existing) throw new AffiliateProgramError("Listing not found.");
    const brand = await brandFields(tx, values);
    await assertNotDuplicate(tx, { ...brand, websiteUrl: values.websiteUrl || null, programUrl: values.programUrl || null, signupUrl: values.signupUrl }, existing.id);
    const program = await tx.affiliateProgram.update({
      where: { id: existing.id },
      data: {
        ...brand,
        ...toData(values),
        featured: values.featured,
        sourceUrl: values.sourceUrl || null,
        ...verification,
        slug: values.name !== existing.name ? await uniqueSlug(values.name, tx, existing.id) : existing.slug,
      },
    });
    await recordAudit(
      {
        userId: adminId,
        action: "AFFILIATE_PROGRAM_UPDATED",
        entityType: "AffiliateProgram",
        entityId: program.id,
        metadata: { byAdmin: true, verified: !!verification.verifiedAt, verificationCleared: !!existing.verifiedAt && !verification.verifiedAt },
      },
      tx,
    );
    return program;
  });
}

export type AdminStateAction = "ACTIVATE" | "DEACTIVATE" | "CLOSE" | "REOPEN";

/**
 * Admin lifecycle: ACTIVATE publishes (Active), DEACTIVATE pauses (Inactive),
 * CLOSE takes it off the marketplace for good (history kept), REOPEN returns it
 * to the review queue.
 */
export async function adminSetAffiliateProgramState(adminId: string, programId: string, action: AdminStateAction) {
  return transaction(async (tx) => {
    const existing = await tx.affiliateProgram.findUnique({ where: { id: programId } });
    if (!existing) throw new AffiliateProgramError("Listing not found.");
    const rules: Record<AdminStateAction, { from: AffiliateProgramStatus[]; data: Prisma.AffiliateProgramUpdateInput }> = {
      ACTIVATE: { from: ["DRAFT", "PENDING_REVIEW", "REJECTED", "PAUSED", "CLOSED"], data: { status: "APPROVED", reviewedAt: new Date(), reviewedBy: { connect: { id: adminId } } } },
      DEACTIVATE: { from: ["APPROVED"], data: { status: "PAUSED" } },
      CLOSE: { from: ["DRAFT", "PENDING_REVIEW", "APPROVED", "REJECTED", "PAUSED"], data: { status: "CLOSED" } },
      REOPEN: { from: ["DRAFT", "REJECTED", "PAUSED", "CLOSED"], data: { status: "PENDING_REVIEW", submittedAt: new Date() } },
    };
    if (!rules[action].from.includes(existing.status)) throw new AffiliateProgramError("That change is not possible from the listing's current state.");
    const program = await tx.affiliateProgram.update({ where: { id: existing.id }, data: rules[action].data });
    await recordAudit({ userId: adminId, action: `AFFILIATE_PROGRAM_ADMIN_${action}`, entityType: "AffiliateProgram", entityId: program.id }, tx);
    return program;
  });
}

/**
 * Deletes a listing outright — only while no creator has saved a link to it.
 * Once creators use it, closing keeps their click history intact instead.
 */
export async function adminDeleteAffiliateProgram(adminId: string, programId: string) {
  return transaction(async (tx) => {
    const existing = await tx.affiliateProgram.findUnique({ where: { id: programId }, include: { _count: { select: { links: true } } } });
    if (!existing) throw new AffiliateProgramError("Listing not found.");
    if (existing._count.links > 0) throw new AffiliateProgramError("Creators have saved links to this listing. Close it instead — their click history is kept.");
    await tx.affiliateProgram.delete({ where: { id: existing.id } });
    await recordAudit(
      { userId: adminId, action: "AFFILIATE_PROGRAM_DELETED", entityType: "AffiliateProgram", entityId: existing.id, metadata: { name: existing.name, slug: existing.slug } },
      tx,
    );
  });
}

/** Pins a listing to the top of the marketplace (or unpins it). */
export async function adminSetFeatured(adminId: string, programId: string, featured: boolean) {
  return transaction(async (tx) => {
    const program = await tx.affiliateProgram.update({ where: { id: programId }, data: { featured } }).catch(() => null);
    if (!program) throw new AffiliateProgramError("Listing not found.");
    await recordAudit({ userId: adminId, action: featured ? "AFFILIATE_PROGRAM_FEATURED" : "AFFILIATE_PROGRAM_UNFEATURED", entityType: "AffiliateProgram", entityId: program.id }, tx);
    return program;
  });
}

/**
 * Re-checks the official programme URL now. A broken URL removes the "Verified"
 * mark straight away (the listing stays as it is otherwise — the admin decides
 * whether to deactivate it).
 */
export async function adminCheckProgramLink(adminId: string, programId: string, opts: { checkLink?: LinkChecker } = {}) {
  const existing = await prisma.affiliateProgram.findUnique({ where: { id: programId }, select: { id: true, signupUrl: true, verifiedAt: true } });
  if (!existing) throw new AffiliateProgramError("Listing not found.");
  const result = await (opts.checkLink ?? checkProgramUrl)(existing.signupUrl);
  const unverified = !result.reachable && !!existing.verifiedAt;
  return transaction(async (tx) => {
    const program = await tx.affiliateProgram.update({
      where: { id: existing.id },
      data: { linkCheckedAt: result.checkedAt, linkStatus: result.status, ...(unverified ? { verifiedAt: null } : {}) },
    });
    await recordAudit(
      { userId: adminId, action: "AFFILIATE_PROGRAM_LINK_CHECKED", entityType: "AffiliateProgram", entityId: program.id, metadata: { status: result.status, verificationRemoved: unverified } },
      tx,
    );
    return { program, result, unverified };
  });
}

export async function getProgramForAdmin(id: string) {
  return prisma.affiliateProgram.findUnique({ where: { id } });
}

/** Brands an admin can attach a listing to. */
export async function listBrandsForListing() {
  return prisma.brand.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" }, select: { id: true, name: true }, take: 500 });
}

// ─── reads ────────────────────────────────────────────────────────────────────

/** Brand shown for a listing: its Refnivo account, or the name on a curated listing. */
export function programBrandName(p: { brand: { name: string } | null; brandName: string | null }): string {
  return p.brand?.name ?? p.brandName ?? "Brand";
}

/** A listing is public only if its brand account is active — or it has none (curated). */
const OPEN_BRAND: Prisma.AffiliateProgramWhereInput = { OR: [{ brandId: null }, { brand: { status: "ACTIVE" } }] };

export const publicProgramSelect = {
  id: true,
  name: true,
  slug: true,
  programType: true,
  description: true,
  category: true,
  subcategory: true,
  bestFor: true,
  featured: true,
  sourceUrl: true,
  websiteUrl: true,
  programUrl: true,
  signupUrl: true,
  logoUrl: true,
  commissionType: true,
  commissionDescription: true,
  cookieDurationDays: true,
  networkName: true,
  approvalType: true,
  minFollowers: true,
  supportedPlatforms: true,
  geography: true,
  requirements: true,
  verifiedAt: true,
  status: true,
  brandName: true,
  brand: { select: { name: true, slug: true, logoUrl: true, industry: true, verificationStatus: true } },
} satisfies Prisma.AffiliateProgramSelect;

export type PublicAffiliateProgram = Prisma.AffiliateProgramGetPayload<{ select: typeof publicProgramSelect }>;

export const PROGRAM_SORTS = ["featured", "recent", "az", "category"] as const;
export type ProgramSort = (typeof PROGRAM_SORTS)[number];

export type ProgramFilters = { q?: string; category?: string; type?: string; network?: string; sort?: string; page?: number };

export const PROGRAMS_PAGE_SIZE = 24;

/** Program types whose label matches a search, e.g. "creator" → CREATOR_AFFILIATE, CREATOR_COMMERCE. */
function typesMatching(q: string) {
  const needle = q.trim().toLowerCase();
  return (Object.entries(PROGRAM_TYPE_LABEL) as [AffiliateProgramType, string][]).filter(([, label]) => label.toLowerCase().includes(needle)).map(([value]) => value);
}

/** Upper bound on listings sorted in memory (sorting needs case-insensitive brand names: "boAt", "eBay"). */
const MAX_LISTED = 500;

const byName = (a: PublicAffiliateProgram, b: PublicAffiliateProgram) =>
  programBrandName(a).localeCompare(programBrandName(b), "en", { sensitivity: "base" }) || a.name.localeCompare(b.name, "en", { sensitivity: "base" });

const COMPARE: Record<ProgramSort, (a: PublicAffiliateProgram, b: PublicAffiliateProgram) => number> = {
  featured: (a, b) => Number(b.featured) - Number(a.featured) || byName(a, b),
  recent: (a, b) => (b.verifiedAt?.getTime() ?? 0) - (a.verifiedAt?.getTime() ?? 0) || byName(a, b),
  az: byName,
  category: (a, b) => (a.category ?? "~").localeCompare(b.category ?? "~", "en", { sensitivity: "base" }) || byName(a, b),
};

/**
 * The creator marketplace: approved listings only, from active (or curated)
 * brands. Search covers brand, programme, category and programme type. Returns
 * everything up to the requested page ("load more"), plus the total.
 */
export async function listPublishedPrograms(filters: ProgramFilters = {}, pageSize = PROGRAMS_PAGE_SIZE): Promise<{ programs: PublicAffiliateProgram[]; total: number }> {
  const q = filters.q?.trim();
  const type = (Object.keys(PROGRAM_TYPE_LABEL) as AffiliateProgramType[]).find((t) => t === filters.type);
  const where: Prisma.AffiliateProgramWhereInput = {
    status: "APPROVED",
    AND: [
      OPEN_BRAND,
      ...(q
        ? [
            {
              OR: [
                { name: { contains: q, mode: "insensitive" as const } },
                { brand: { name: { contains: q, mode: "insensitive" as const } } },
                { brandName: { contains: q, mode: "insensitive" as const } },
                { category: { contains: q, mode: "insensitive" as const } },
                { subcategory: { contains: q, mode: "insensitive" as const } },
                { description: { contains: q, mode: "insensitive" as const } },
                ...(typesMatching(q).length ? [{ programType: { in: typesMatching(q) } }] : []),
              ],
            },
          ]
        : []),
    ],
    ...(filters.category ? { category: filters.category } : {}),
    ...(type ? { programType: type } : {}),
    ...(filters.network ? { networkName: { equals: filters.network, mode: "insensitive" } } : {}),
  };
  const sort = (PROGRAM_SORTS as readonly string[]).includes(filters.sort ?? "") ? (filters.sort as ProgramSort) : "featured";
  const page = Math.min(Math.max(1, Math.floor(filters.page ?? 1)), 20);
  const rows = await prisma.affiliateProgram.findMany({ where, take: MAX_LISTED, select: publicProgramSelect });
  rows.sort(COMPARE[sort]);
  return { programs: rows.slice(0, page * pageSize), total: rows.length };
}

export async function getPublishedProgram(slug: string): Promise<PublicAffiliateProgram | null> {
  return prisma.affiliateProgram.findFirst({ where: { slug, status: "APPROVED", ...OPEN_BRAND }, select: publicProgramSelect });
}

/** Distinct values that actually exist among published listings, for the filters. */
export async function programFacets() {
  const rows = await prisma.affiliateProgram.findMany({ where: { status: "APPROVED", ...OPEN_BRAND }, select: { category: true, networkName: true, programType: true } });
  const uniq = <T extends string>(xs: (T | null)[]) => [...new Set(xs.filter((x): x is T => !!x))].sort();
  return { categories: uniq(rows.map((r) => r.category)), networks: uniq(rows.map((r) => r.networkName)), types: uniq(rows.map((r) => r.programType)) };
}

export async function listBrandPrograms(brandId: string) {
  const rows = await prisma.affiliateProgram.findMany({
    where: { brandId },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { links: true, clicks: true } } },
  });
  return rows;
}

export async function getBrandProgram(brandId: string, id: string) {
  return prisma.affiliateProgram.findFirst({ where: { id, brandId } });
}

export async function listProgramsForReview(status: AffiliateProgramStatus | "ALL" = "PENDING_REVIEW", take = 100) {
  return prisma.affiliateProgram.findMany({
    where: status === "ALL" ? {} : { status },
    orderBy: [{ submittedAt: { sort: "asc", nulls: "last" } }, { updatedAt: "desc" }],
    take,
    include: { brand: { select: { name: true, slug: true, verificationStatus: true, owner: { select: { email: true } } } }, _count: { select: { links: true, clicks: true } } },
  });
}

/**
 * A brand's published external programmes, for its public profile: listings the
 * brand owns plus curated listings under the same brand name.
 */
export async function listPublicProgramsForBrand(brand: { id: string; name: string }): Promise<PublicAffiliateProgram[]> {
  const rows = await prisma.affiliateProgram.findMany({
    where: {
      status: "APPROVED",
      OR: [
        { brandId: brand.id, brand: { status: "ACTIVE" } },
        { brandId: null, brandName: { equals: brand.name, mode: "insensitive" } },
      ],
    },
    select: publicProgramSelect,
  });
  return rows.sort(byName);
}
