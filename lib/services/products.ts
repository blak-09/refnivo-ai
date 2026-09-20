import { Prisma, type ProductStatus } from "@prisma/client";
import { cleanupReplacedImages } from "@/lib/storage/cleanup";
import { prisma } from "@/lib/db/prisma";
import { toProductData, type ProductValues } from "@/lib/validation/product";
import { recordAudit } from "./audit";
import { uniqueSlug } from "./brands";

export class ProductError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProductError";
  }
}

const slugExists = (tx: Prisma.TransactionClient, excludeId?: string) => async (s: string) =>
  !!(await tx.product.findFirst({ where: { slug: s, ...(excludeId ? { NOT: { id: excludeId } } : {}) }, select: { id: true } }));

export async function listBrandProducts(brandId: string, status?: ProductStatus | "ALL") {
  return prisma.product.findMany({
    where: { brandId, ...(status && status !== "ALL" ? { status } : {}) },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { campaigns: true } } },
  });
}

export async function getBrandProduct(brandId: string, productId: string) {
  return prisma.product.findFirst({ where: { id: productId, brandId } });
}

export async function createProduct(brandId: string, brandName: string, userId: string, values: ProductValues) {
  return prisma.$transaction(async (tx) => {
    const slug = await uniqueSlug(`${brandName} ${values.name}`, slugExists(tx));
    try {
      const product = await tx.product.create({ data: { brandId, slug, ...toProductData(values) } });
      await recordAudit(
        { userId, action: "PRODUCT_CREATED", entityType: "Product", entityId: product.id, metadata: { brandId, name: product.name } },
        tx,
      );
      return product;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ProductError("A product with this SKU already exists for your brand.");
      }
      throw err;
    }
  });
}

export async function updateProduct(brandId: string, brandName: string, userId: string, productId: string, values: ProductValues) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.product.findFirst({ where: { id: productId, brandId } });
    if (!existing) throw new ProductError("Product not found.");
    const slug = existing.name === values.name ? existing.slug : await uniqueSlug(`${brandName} ${values.name}`, slugExists(tx, productId));
    try {
      const product = await tx.product.update({ where: { id: productId }, data: { slug, ...toProductData(values) } });
      await recordAudit({ userId, action: "PRODUCT_UPDATED", entityType: "Product", entityId: productId, metadata: { brandId } }, tx);
      cleanupReplacedImages([{ previous: existing.imageUrl, next: product.imageUrl }]);
      return product;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ProductError("A product with this SKU already exists for your brand.");
      }
      throw err;
    }
  });
}

/** Products with campaigns are archived instead of deleted so history stays intact. */
export async function archiveProduct(brandId: string, userId: string, productId: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.product.findFirst({ where: { id: productId, brandId }, include: { _count: { select: { campaigns: true } } } });
    if (!existing) throw new ProductError("Product not found.");
    const live = await tx.campaign.count({ where: { productId, status: { in: ["ACTIVE", "PAUSED"] } } });
    if (live > 0) throw new ProductError("End or archive this product's live campaigns before archiving it.");
    const product = await tx.product.update({ where: { id: productId }, data: { status: "ARCHIVED" } });
    await recordAudit({ userId, action: "PRODUCT_ARCHIVED", entityType: "Product", entityId: productId, metadata: { brandId } }, tx);
    return product;
  });
}

// ---------------------------------------------------------------------------
// Public reads
// ---------------------------------------------------------------------------

export async function listPublicProducts(opts: { category?: string; q?: string; brandSlug?: string } = {}) {
  return prisma.product.findMany({
    where: {
      status: "ACTIVE",
      brand: { status: "ACTIVE", ...(opts.brandSlug ? { slug: opts.brandSlug } : {}) },
      ...(opts.category ? { category: opts.category } : {}),
      ...(opts.q ? { name: { contains: opts.q, mode: "insensitive" } } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      slug: true,
      imageUrl: true,
      category: true,
      price: true,
      currency: true,
      brand: { select: { name: true, slug: true, logoUrl: true, verificationStatus: true } },
      campaigns: {
        where: { status: "ACTIVE" },
        select: { id: true, slug: true, currency: true, creatorCommissionType: true, creatorCommissionValue: true, rewardType: true, customerRewardValue: true },
        take: 1,
        orderBy: { creatorCommissionValue: "desc" },
      },
    },
  });
}

export async function getPublicProduct(slug: string) {
  return prisma.product.findFirst({
    where: { slug, status: "ACTIVE", brand: { status: "ACTIVE" } },
    include: {
      brand: { select: { id: true, name: true, slug: true, logoUrl: true, tagline: true, verificationStatus: true, website: true } },
      campaigns: {
        where: { status: "ACTIVE" },
        orderBy: { publishedAt: "desc" },
        select: {
          id: true,
          name: true,
          slug: true,
          campaignType: true,
          rewardType: true,
          customerRewardValue: true,
          creatorCommissionType: true,
          creatorCommissionValue: true,
          currency: true,
          startDate: true,
          endDate: true,
          _count: { select: { partnerApplications: { where: { status: "APPROVED", partnerType: "CREATOR" } } } },
        },
      },
    },
  });
}
