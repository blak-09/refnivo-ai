import { Prisma, type ConversionSource, type ReferralStatus } from "@prisma/client";
import { prisma, transaction } from "@/lib/db/prisma";
import { isCampaignLive } from "@/lib/domain/campaign-rules";
import { computeCreatorCommission, computeCustomerReward, meetsMinimumPurchase } from "@/lib/domain/rewards";
import { normalizeReferralCode } from "@/lib/utils/codes";
import { recordAudit } from "./audit";
import { adminUserIds, notify, notifyMany } from "./notify";
import { hashValue } from "./tracking";

export class ConversionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConversionError";
  }
}

export type RecordOrderInput = {
  code: string;
  orderReference: string;
  /** Order value in minor units. */
  amountMinor: number;
  quantity?: number;
  source?: ConversionSource;
  /** Optional customer email/phone. Stored only as a salted hash for duplicate & self-referral checks. */
  customerContact?: string | null;
  note?: string | null;
};

/**
 * A brand records an online order that came through a referral code. Creates a
 * PURCHASED referral + conversion and PENDING ledger entries. Nothing is owed
 * until the brand verifies the order.
 */
export async function recordOrder(brandId: string, actorId: string, input: RecordOrderInput, now = new Date()) {
  const code = normalizeReferralCode(input.code);
  return transaction(async (tx) => {
    const link = await tx.referralLink.findUnique({
      where: { code },
      include: {
        campaign: true,
        owner: { select: { id: true, email: true, phone: true } },
      },
    });
    if (!link || link.campaign.brandId !== brandId) throw new ConversionError("Referral code not found for your brand.");
    if (link.status !== "ACTIVE") throw new ConversionError("This referral link is disabled.");
    if (!isCampaignLive(link.campaign, now)) throw new ConversionError("This campaign is not active — paused or expired campaigns cannot accept new conversions.");
    if (!meetsMinimumPurchase(link.campaign, input.amountMinor)) {
      throw new ConversionError("Order value is below the campaign's minimum order value.");
    }

    const contactHash = input.customerContact ? hashValue(input.customerContact) : null;
    if (contactHash) {
      const selfHashes = [link.owner.email, link.owner.phone].filter(Boolean).map((v) => hashValue(v as string));
      if (selfHashes.includes(contactHash)) throw new ConversionError("Self-referral blocked: the customer contact matches the referring partner.");
      const duplicate = await tx.referral.findFirst({
        where: { campaignId: link.campaignId, referredPhoneHash: contactHash, status: { in: ["PURCHASED", "VERIFIED"] } },
        select: { id: true },
      });
      if (duplicate && link.campaign.newCustomerOnly) {
        throw new ConversionError("Duplicate referral: this customer already has an order on this campaign (new customers only).");
      }
    }

    const referral = await tx.referral.create({
      data: {
        campaignId: link.campaignId,
        referralLinkId: link.id,
        referrerId: link.ownerId,
        referredPhoneHash: contactHash,
        status: "PURCHASED",
        qualifyingEvent: input.note?.trim() || "Online order",
      },
    });

    // A previously REJECTED order with the same reference (typo, wrong code) may be recorded again:
    // the old row is renamed, not deleted, so the audit trail keeps both attempts.
    const clash = await tx.conversion.findUnique({
      where: { brandId_orderReference: { brandId, orderReference: input.orderReference.trim() } },
      select: { id: true, referral: { select: { status: true } } },
    });
    if (clash && clash.referral.status === "REJECTED") {
      await tx.conversion.update({ where: { id: clash.id }, data: { orderReference: `${input.orderReference.trim()}~rejected~${clash.id.slice(-6)}` } });
    }

    let conversion;
    try {
      conversion = await tx.conversion.create({
        data: {
          referralId: referral.id,
          brandId,
          orderReference: input.orderReference.trim(),
          amount: input.amountMinor,
          quantity: input.quantity ?? 1,
          source: input.source ?? "REFERRAL_CODE",
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConversionError("An order with this reference has already been recorded.");
      }
      throw err;
    }

    // Pending ledger entries — amounts are fixed now so later rule edits never change them.
    if (link.partnerType === "CREATOR") {
      const amount = computeCreatorCommission(link.campaign, input.amountMinor);
      if (amount > 0) {
        await tx.commission.create({ data: { referralId: referral.id, creatorId: link.ownerId, amount, currency: link.campaign.currency } });
      }
    } else {
      const amount = computeCustomerReward(link.campaign, input.amountMinor);
      if (amount > 0) {
        await tx.reward.create({
          data: { referralId: referral.id, recipientId: link.ownerId, rewardType: link.campaign.rewardType, amount, currency: link.campaign.currency },
        });
      }
    }

    await notify(
      {
        userId: link.ownerId,
        type: "ORDER_RECORDED",
        title: `New order through your link: ${link.campaign.name}`,
        body: "The brand recorded an order that came through your referral. Your commission or reward is pending verification.",
        href: link.partnerType === "CREATOR" ? "/dashboard/creator/conversions" : "/dashboard/customer/rewards",
      },
      tx,
    );
    await recordAudit(
      {
        userId: actorId,
        action: "ORDER_RECORDED",
        entityType: "Conversion",
        entityId: conversion.id,
        metadata: { brandId, campaignId: link.campaignId, code, amount: input.amountMinor, source: conversion.source },
      },
      tx,
    );
    return { referral, conversion };
  });
}

/**
 * Approves a recorded order: referral → VERIFIED, ledger entries → APPROVED / AVAILABLE.
 *
 * Concurrency: the campaign row is locked (SELECT … FOR UPDATE) for the whole
 * transaction, so simultaneous verifications on the same campaign run one at a
 * time. Each verifier re-reads the referral and the spent totals *after*
 * acquiring the lock, so the budget check always sees the previous verifier's
 * committed ledger rows and the campaign can never be over-committed.
 */
export async function verifyConversion(brandId: string, actorId: string, referralId: string, now = new Date()) {
  return transaction(async (tx) => {
    // 1. Ownership-scoped lookup to learn the campaign (no lock yet).
    const target = await tx.referral.findFirst({ where: { id: referralId, campaign: { brandId } }, select: { campaignId: true } });
    if (!target) throw new ConversionError("Order not found.");

    // 2. Serialize verifications per campaign. Held until commit/rollback.
    await tx.$queryRaw`SELECT "id" FROM "campaigns" WHERE "id" = ${target.campaignId} FOR UPDATE`;

    // 3. Everything below is read under the lock.
    const referral = await tx.referral.findFirst({
      where: { id: referralId, campaign: { brandId } },
      include: {
        conversion: true,
        campaign: { select: { budget: true, id: true, name: true } },
        referralLink: { select: { partnerType: true } },
        commissions: true,
        rewards: true,
      },
    });
    if (!referral || !referral.conversion) throw new ConversionError("Order not found.");
    if (referral.status !== "PURCHASED") throw new ConversionError("Only orders pending verification can be verified.");

    const owed = [...referral.commissions, ...referral.rewards].reduce((s, e) => s + e.amount, 0);
    if (referral.campaign.budget !== null) {
      const [c, r] = await Promise.all([
        tx.commission.aggregate({ where: { referral: { campaignId: referral.campaign.id }, status: { in: ["APPROVED", "PAID"] } }, _sum: { amount: true } }),
        tx.reward.aggregate({ where: { referral: { campaignId: referral.campaign.id }, status: { in: ["APPROVED", "AVAILABLE", "REDEEMED"] } }, _sum: { amount: true } }),
      ]);
      const spent = (c._sum.amount ?? 0) + (r._sum.amount ?? 0);
      if (spent + owed > referral.campaign.budget) {
        throw new ConversionError("Verifying this order would exceed the campaign budget. Increase the budget first.");
      }
    }

    await tx.referral.update({ where: { id: referralId }, data: { status: "VERIFIED", verifiedAt: now } });
    await tx.conversion.update({ where: { id: referral.conversion.id }, data: { verifiedById: actorId, verifiedAt: now } });
    await tx.commission.updateMany({ where: { referralId, status: "PENDING" }, data: { status: "APPROVED" } });
    await tx.reward.updateMany({ where: { referralId, status: "PENDING" }, data: { status: "AVAILABLE" } });
    await notify(
      {
        userId: referral.referrerId,
        type: "CONVERSION_VERIFIED",
        idempotencyKey: `conversion:${referralId}:VERIFIED`,
        title: `Order verified: ${referral.campaign.name}`,
        body: referral.referralLink.partnerType === "CREATOR" ? "Your commission for this order is now approved." : "Your reward for this order is now available.",
        href: referral.referralLink.partnerType === "CREATOR" ? "/dashboard/creator/earnings" : "/dashboard/customer/rewards",
        email: true,
      },
      tx,
    );
    await recordAudit(
      { userId: actorId, action: "CONVERSION_VERIFIED", entityType: "Referral", entityId: referralId, metadata: { brandId, orderReference: referral.conversion.orderReference, owed } },
      tx,
    );
  });
}

export async function rejectConversion(brandId: string, actorId: string, referralId: string, reason?: string | null) {
  return transaction(async (tx) => {
    const referral = await tx.referral.findFirst({
      where: { id: referralId, campaign: { brandId } },
      include: { conversion: true, campaign: { select: { name: true } }, referralLink: { select: { partnerType: true } } },
    });
    if (!referral || !referral.conversion) throw new ConversionError("Order not found.");
    if (referral.status !== "PURCHASED") throw new ConversionError("Only orders pending verification can be rejected.");

    await tx.referral.update({ where: { id: referralId }, data: { status: "REJECTED", qualifyingEvent: reason?.trim() || referral.qualifyingEvent } });
    await tx.commission.updateMany({ where: { referralId, status: "PENDING" }, data: { status: "REJECTED" } });
    await tx.reward.updateMany({ where: { referralId, status: "PENDING" }, data: { status: "REJECTED" } });
    await notify(
      {
        userId: referral.referrerId,
        type: "CONVERSION_REJECTED",
        title: `Order not verified: ${referral.campaign.name}`,
        body: reason?.trim() ? `The brand rejected this order. Reason: ${reason.trim()}` : "The brand rejected this order, so no commission or reward is owed.",
        href: referral.referralLink.partnerType === "CREATOR" ? "/dashboard/creator/conversions" : "/dashboard/customer/rewards",
      },
      tx,
    );
    await recordAudit(
      { userId: actorId, action: "CONVERSION_REJECTED", entityType: "Referral", entityId: referralId, metadata: { brandId, orderReference: referral.conversion.orderReference, reason: reason ?? null } },
      tx,
    );
  });
}

/**
 * Refund / reversal of a VERIFIED order. The referral becomes REFUNDED and every
 * approved (or already paid / redeemed) ledger entry becomes REVERSED, which
 * removes it from budget maths and from payout eligibility. Entries that were
 * already settled through a payout stay linked to that payout so the admin can
 * see the negative balance; nothing is deleted. Serialised per campaign with
 * the same row lock as verification so budget totals stay consistent.
 */
export async function reverseConversion(brandId: string, actorId: string, referralId: string, reason: string, now = new Date()) {
  return transaction(async (tx) => {
    const target = await tx.referral.findFirst({ where: { id: referralId, campaign: { brandId } }, select: { campaignId: true } });
    if (!target) throw new ConversionError("Order not found.");
    await tx.$queryRaw`SELECT "id" FROM "campaigns" WHERE "id" = ${target.campaignId} FOR UPDATE`;

    const referral = await tx.referral.findFirst({
      where: { id: referralId, campaign: { brandId } },
      include: {
        conversion: true,
        campaign: { select: { name: true } },
        referralLink: { select: { partnerType: true } },
        commissions: { select: { id: true, status: true, amount: true, payoutItem: { select: { payoutRequest: { select: { id: true, status: true } } } } } },
        rewards: { select: { id: true, status: true, amount: true, payoutItem: { select: { payoutRequest: { select: { id: true, status: true } } } } } },
      },
    });
    if (!referral || !referral.conversion) throw new ConversionError("Order not found.");
    if (referral.status !== "VERIFIED") throw new ConversionError("Only verified orders can be refunded.");
    if (referral.conversion.reversedAt) throw new ConversionError("This order has already been refunded.");

    const reversedCommissions = referral.commissions.filter((c) => c.status === "APPROVED" || c.status === "PAID");
    const reversedRewards = referral.rewards.filter((r) => r.status === "AVAILABLE" || r.status === "APPROVED" || r.status === "REDEEMED");
    const alreadySettled = referral.commissions.some((c) => c.status === "PAID") || referral.rewards.some((r) => r.status === "REDEEMED");

    await tx.referral.update({ where: { id: referralId }, data: { status: "REFUNDED" } });
    await tx.conversion.update({ where: { id: referral.conversion.id }, data: { reversedAt: now, reversalReason: reason.trim() } });
    await tx.commission.updateMany({ where: { id: { in: reversedCommissions.map((c) => c.id) } }, data: { status: "REVERSED" } });
    await tx.reward.updateMany({ where: { id: { in: reversedRewards.map((r) => r.id) } }, data: { status: "REVERSED" } });

    const reversedAmount = [...reversedCommissions, ...reversedRewards].reduce((s, e) => s + e.amount, 0);

    // A reversed entry sitting in a payout request that is still open: admins
    // must know before they settle it (reviewPayout also re-checks and trims).
    const openPayoutIds = [
      ...new Set(
        [...reversedCommissions, ...reversedRewards]
          .map((e) => e.payoutItem?.payoutRequest)
          .filter((r): r is { id: string; status: "REQUESTED" | "UNDER_REVIEW" | "APPROVED" | "PROCESSING" } =>
            !!r && ["REQUESTED", "UNDER_REVIEW", "APPROVED", "PROCESSING"].includes(r.status),
          )
          .map((r) => r.id),
      ),
    ];
    if (openPayoutIds.length) {
      await notifyMany(
        await adminUserIds(tx),
        {
          type: "PAYOUT_UPDATED",
          idempotencyKey: `payout-reversal:${referralId}`,
          title: "A refund touched an open payout request",
          body: `An order was refunded after its ${referral.referralLink.partnerType === "CREATOR" ? "commission" : "reward"} was included in a pending payout. The request amount will be trimmed when you approve or mark it paid.`,
          href: "/dashboard/admin/payouts",
        },
        tx,
      );
    }
    await notify(
      {
        userId: referral.referrerId,
        type: "CONVERSION_REVERSED",
        idempotencyKey: `conversion:${referralId}:REVERSED`,
        title: `Order refunded: ${referral.campaign.name}`,
        body: `The brand recorded a refund for this order, so the related ${referral.referralLink.partnerType === "CREATOR" ? "commission" : "reward"} was reversed. Reason: ${reason.trim()}`,
        href: referral.referralLink.partnerType === "CREATOR" ? "/dashboard/creator/earnings" : "/dashboard/customer/rewards",
        email: true,
      },
      tx,
    );
    await recordAudit(
      {
        userId: actorId,
        action: "CONVERSION_REVERSED",
        entityType: "Referral",
        entityId: referralId,
        metadata: { brandId, orderReference: referral.conversion.orderReference, reason: reason.trim(), reversedAmount, alreadySettled, openPayoutIds },
      },
      tx,
    );
    return { reversedAmount, alreadySettled };
  });
}

export async function listBrandOrders(brandId: string, status?: ReferralStatus | "ALL") {
  return prisma.conversion.findMany({
    where: { brandId, ...(status && status !== "ALL" ? { referral: { status } } : {}) },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      orderReference: true,
      amount: true,
      quantity: true,
      currency: true,
      source: true,
      createdAt: true,
      verifiedAt: true,
      reversedAt: true,
      reversalReason: true,
      referral: {
        select: {
          id: true,
          status: true,
          qualifyingEvent: true,
          campaign: { select: { id: true, name: true, product: { select: { name: true } } } },
          referralLink: { select: { code: true, partnerType: true } },
          referrer: { select: { name: true, creatorProfile: { select: { displayName: true, username: true } } } },
          rewards: { select: { amount: true, status: true } },
          commissions: { select: { amount: true, status: true } },
        },
      },
    },
  });
}

export async function countOrdersByStatus(brandId: string) {
  const rows = await prisma.referral.groupBy({
    by: ["status"],
    where: { campaign: { brandId }, conversion: { isNot: null } },
    _count: { _all: true },
  });
  return Object.fromEntries(rows.map((r) => [r.status, r._count._all])) as Partial<Record<ReferralStatus, number>>;
}

/** Partner-facing conversions: never exposes the referred customer's details. */
export async function listPartnerConversions(userId: string) {
  return prisma.referral.findMany({
    where: { referrerId: userId, conversion: { isNot: null } },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      status: true,
      createdAt: true,
      verifiedAt: true,
      campaign: { select: { name: true, slug: true, brand: { select: { name: true } }, product: { select: { name: true } } } },
      conversion: { select: { amount: true, currency: true, createdAt: true } },
      commissions: { select: { amount: true, status: true, currency: true } },
      rewards: { select: { amount: true, status: true, currency: true } },
    },
  });
}
