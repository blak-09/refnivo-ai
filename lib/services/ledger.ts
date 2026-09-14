import { prisma } from "@/lib/db/prisma";

/** Reward & commission ledger view for a brand (all its campaigns). */
export async function getBrandLedger(brandId: string) {
  const [rewards, commissions] = await Promise.all([
    prisma.reward.findMany({
      where: { referral: { campaign: { brandId } } },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        amount: true,
        currency: true,
        status: true,
        rewardType: true,
        createdAt: true,
        recipient: { select: { name: true } },
        referral: { select: { campaign: { select: { id: true, name: true } } } },
      },
    }),
    prisma.commission.findMany({
      where: { referral: { campaign: { brandId } } },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        amount: true,
        currency: true,
        status: true,
        createdAt: true,
        creator: { select: { name: true, creatorProfile: { select: { displayName: true } } } },
        referral: { select: { campaign: { select: { id: true, name: true } } } },
      },
    }),
  ]);

  const sumBy = <T extends { amount: number; status: string }>(rows: T[], statuses: string[]) =>
    rows.filter((r) => statuses.includes(r.status)).reduce((s, r) => s + r.amount, 0);

  return {
    rewards,
    commissions,
    totals: {
      rewardsPending: sumBy(rewards, ["PENDING"]),
      rewardsApproved: sumBy(rewards, ["APPROVED", "AVAILABLE"]),
      rewardsRedeemed: sumBy(rewards, ["REDEEMED"]),
      commissionsPending: sumBy(commissions, ["PENDING"]),
      commissionsApproved: sumBy(commissions, ["APPROVED"]),
      commissionsPaid: sumBy(commissions, ["PAID"]),
    },
  };
}
