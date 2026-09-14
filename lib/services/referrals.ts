import type { ReferralStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

/**
 * Brand-facing referral list. Deliberately excludes any contact details
 * of referred people — the brand sees the partner, campaign, order
 * reference and amount, which is what it needs to verify.
 */
export async function listBrandReferrals(brandId: string, status?: ReferralStatus | "ALL") {
  return prisma.referral.findMany({
    where: { campaign: { brandId }, ...(status && status !== "ALL" ? { status } : {}) },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      status: true,
      qualifyingEvent: true,
      createdAt: true,
      verifiedAt: true,
      campaign: { select: { id: true, name: true, product: { select: { name: true } } } },
      referralLink: { select: { partnerType: true, code: true } },
      referrer: { select: { name: true, creatorProfile: { select: { displayName: true } } } },
      conversion: { select: { orderReference: true, amount: true, currency: true, source: true } },
      rewards: { select: { amount: true, status: true } },
      commissions: { select: { amount: true, status: true } },
    },
  });
}

export async function countReferralsByStatus(brandId: string) {
  const rows = await prisma.referral.groupBy({
    by: ["status"],
    where: { campaign: { brandId } },
    _count: { _all: true },
  });
  return Object.fromEntries(rows.map((r) => [r.status, r._count._all])) as Partial<Record<ReferralStatus, number>>;
}
