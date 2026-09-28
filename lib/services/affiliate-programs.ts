import type { AffiliateProgramStatus, Prisma } from "@prisma/client";
import { prisma, transaction } from "@/lib/db/prisma";
import { slugify } from "@/lib/utils/slug";
import type { AffiliateProgramValues } from "@/lib/validation/affiliate";
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
    description: values.description || null,
    category: values.category || null,
    websiteUrl: values.websiteUrl || null,
    programUrl: values.programUrl || null,
    signupUrl: values.signupUrl,
    logoUrl: values.logoUrl || null,
    commissionType: values.commissionType,
    commissionDescription: values.commissionDescription || null,
    cookieDurationDays: values.cookieDurationDays ?? null,
    networkName: values.networkName || null,
    approvalType: values.approvalType,
    minFollowers: values.minFollowers ?? null,
    supportedPlatforms: values.supportedPlatforms ?? [],
    geography: values.geography || null,
    requirements: values.requirements || null,
    subIdParam: values.subIdParam || null,
  };
}

/** Creates a listing. `submit` sends it straight to review; otherwise it stays a draft. */
export async function createAffiliateProgram(brandId: string, actorId: string, values: AffiliateProgramValues, opts: { submit: boolean }) {
  return transaction(async (tx) => {
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
) {
  return transaction(async (tx) => {
    const program = await tx.affiliateProgram.findUnique({ where: { id: programId }, include: { brand: { select: { ownerId: true, name: true } } } });
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
      },
    });
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
    await recordAudit({ userId: adminId, action: `AFFILIATE_PROGRAM_${status}`, entityType: "AffiliateProgram", entityId: program.id, metadata: { verified: !!input.verified } }, tx);
    return updated;
  });
}

// ─── reads ────────────────────────────────────────────────────────────────────

export const publicProgramSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  category: true,
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
  brand: { select: { name: true, slug: true, logoUrl: true, industry: true, verificationStatus: true } },
} satisfies Prisma.AffiliateProgramSelect;

export type PublicAffiliateProgram = Prisma.AffiliateProgramGetPayload<{ select: typeof publicProgramSelect }>;

export type ProgramFilters = { q?: string; category?: string; network?: string; approval?: string; platform?: string };

/** The creator marketplace: approved listings only, from active brands. */
export async function listPublishedPrograms(filters: ProgramFilters = {}, take = 60): Promise<PublicAffiliateProgram[]> {
  const where: Prisma.AffiliateProgramWhereInput = {
    status: "APPROVED",
    brand: { status: "ACTIVE" },
    ...(filters.category ? { category: filters.category } : {}),
    ...(filters.network ? { networkName: { equals: filters.network, mode: "insensitive" } } : {}),
    ...(filters.approval && ["AUTOMATIC", "APPLICATION", "INVITE_ONLY"].includes(filters.approval) ? { approvalType: filters.approval as never } : {}),
    ...(filters.platform ? { supportedPlatforms: { has: filters.platform as never } } : {}),
    ...(filters.q
      ? { OR: [{ name: { contains: filters.q, mode: "insensitive" } }, { description: { contains: filters.q, mode: "insensitive" } }, { brand: { name: { contains: filters.q, mode: "insensitive" } } }] }
      : {}),
  };
  return prisma.affiliateProgram.findMany({ where, orderBy: [{ verifiedAt: { sort: "desc", nulls: "last" } }, { updatedAt: "desc" }], take, select: publicProgramSelect });
}

export async function getPublishedProgram(slug: string): Promise<PublicAffiliateProgram | null> {
  return prisma.affiliateProgram.findFirst({ where: { slug, status: "APPROVED", brand: { status: "ACTIVE" } }, select: publicProgramSelect });
}

/** Distinct values that actually exist, for the filter dropdowns. */
export async function programFacets() {
  const rows = await prisma.affiliateProgram.findMany({ where: { status: "APPROVED" }, select: { category: true, networkName: true } });
  const uniq = (xs: (string | null)[]) => [...new Set(xs.filter((x): x is string => !!x))].sort();
  return { categories: uniq(rows.map((r) => r.category)), networks: uniq(rows.map((r) => r.networkName)) };
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
