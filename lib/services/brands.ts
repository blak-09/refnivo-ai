import { Prisma } from "@prisma/client";
import { cleanupReplacedImages } from "@/lib/storage/cleanup";
import { prisma } from "@/lib/db/prisma";
import { slugify } from "@/lib/utils/slug";
import { toSocialLinks, type BrandValues } from "@/lib/validation/brand";
import { recordAudit } from "./audit";

function toBrandData(v: BrandValues) {
  return {
    name: v.name,
    tagline: v.tagline || null,
    description: v.description || null,
    industry: v.industry || null,
    website: v.website || null,
    logoUrl: v.logoUrl || null,
    coverImageUrl: v.coverImageUrl || null,
    supportEmail: v.supportEmail || null,
    country: v.country || "India",
    socialLinks: toSocialLinks(v),
  };
}

export async function uniqueSlug(
  base: string,
  exists: (candidate: string) => Promise<boolean>,
): Promise<string> {
  const root = slugify(base);
  let candidate = root;
  for (let i = 2; i < 50; i++) {
    if (!(await exists(candidate))) return candidate;
    candidate = `${root}-${i}`;
  }
  return `${root}-${Date.now().toString(36)}`;
}

export async function getBrandForOwner(ownerId: string) {
  return prisma.brand.findFirst({ where: { ownerId }, orderBy: { createdAt: "asc" } });
}

export class BrandExistsError extends Error {
  constructor() {
    super("You already have a brand profile.");
    this.name = "BrandExistsError";
  }
}

export async function createBrand(ownerId: string, values: BrandValues) {
  return prisma.$transaction(async (tx) => {
    if (await tx.brand.findUnique({ where: { ownerId }, select: { id: true } })) throw new BrandExistsError();
    const slug = await uniqueSlug(values.name, async (s) => !!(await tx.brand.findUnique({ where: { slug: s }, select: { id: true } })));
    const brand = await tx.brand.create({ data: { ownerId, slug, ...toBrandData(values) } });
    await recordAudit(
      { userId: ownerId, action: "BRAND_CREATED", entityType: "Brand", entityId: brand.id, metadata: { name: brand.name } },
      tx,
    );
    return brand;
  });
}

/** Ownership is enforced in the WHERE clause — a non-owner update touches zero rows. */
export async function updateBrand(brandId: string, ownerId: string, values: BrandValues) {
  const data = toBrandData(values);
  const updated = await prisma.$transaction(async (tx) => {
    const before = await tx.brand.findFirst({ where: { id: brandId, ownerId }, select: { logoUrl: true, coverImageUrl: true } });
    if (!before) return null;
    await tx.brand.update({ where: { id: brandId }, data });
    await recordAudit({ userId: ownerId, action: "BRAND_UPDATED", entityType: "Brand", entityId: brandId }, tx);
    const brand = await tx.brand.findUnique({ where: { id: brandId } });
    return { brand, before };
  });
  if (!updated) return null;
  cleanupReplacedImages([
    { previous: updated.before.logoUrl, next: updated.brand?.logoUrl },
    { previous: updated.before.coverImageUrl, next: updated.brand?.coverImageUrl },
  ]);
  return updated.brand;
}

// ---------------------------------------------------------------------------
// Public reads
// ---------------------------------------------------------------------------

export const publicBrandSelect = {
  id: true,
  name: true,
  slug: true,
  tagline: true,
  description: true,
  logoUrl: true,
  coverImageUrl: true,
  website: true,
  industry: true,
  socialLinks: true,
  country: true,
  verificationStatus: true,
  createdAt: true,
} satisfies Prisma.BrandSelect;

export async function listPublicBrands(opts: { industry?: string; q?: string; limit?: number } = {}) {
  const brands = await prisma.brand.findMany({
    where: {
      status: "ACTIVE",
      ...(opts.industry ? { industry: opts.industry } : {}),
      ...(opts.q ? { name: { contains: opts.q, mode: "insensitive" } } : {}),
    },
    orderBy: [{ verificationStatus: "desc" }, { createdAt: "desc" }],
    ...(opts.limit ? { take: opts.limit } : {}),
    select: {
      ...publicBrandSelect,
      _count: { select: { products: { where: { status: "ACTIVE" } }, campaigns: { where: { status: "ACTIVE" } } } },
    },
  });
  return brands;
}

export async function getPublicBrand(slug: string) {
  return prisma.brand.findFirst({
    where: { slug, status: "ACTIVE" },
    select: {
      ...publicBrandSelect,
      products: {
        where: { status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, slug: true, imageUrl: true, category: true, price: true, currency: true },
      },
      campaigns: {
        where: { status: "ACTIVE" },
        orderBy: { publishedAt: "desc" },
        select: {
          id: true,
          name: true,
          slug: true,
          rewardType: true,
          customerRewardValue: true,
          creatorCommissionType: true,
          creatorCommissionValue: true,
          campaignType: true,
          currency: true,
          endDate: true,
          product: { select: { name: true, imageUrl: true, price: true } },
          _count: { select: { partnerApplications: { where: { status: "APPROVED", partnerType: "CREATOR" } } } },
        },
      },
      _count: { select: { products: { where: { status: "ACTIVE" } }, campaigns: { where: { status: "ACTIVE" } } } },
    },
  });
}
