import { Prisma, type ConversionSource, type ReferralStatus } from "@prisma/client";
import { prisma, transaction } from "@/lib/db/prisma";
import { checkOrderDate, payableAtFor } from "@/lib/domain/campaign-rules";
import { computeCreatorCommission, computeCustomerReward, meetsMinimumPurchase } from "@/lib/domain/rewards";
import { normalizeReferralCode } from "@/lib/utils/codes";
import { recordAudit } from "./audit";
import { creditForReversedOrder, debitForVerifiedOrder, debitWallet, walletEnabled, WalletError } from "./wallet";
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
  /** Already-hashed contact (order claims store only the hash); takes precedence over customerContact. */
  customerContactHash?: string | null;
  note?: string | null;
  /** When the customer placed the order. Defaults to now. Must fall inside the campaign's run. */
  orderedAt?: Date | null;
  /** `orderedAt` is a calendar day from a date input (yyyy-mm-dd), not an exact time. */
  orderedOnDay?: boolean;
};

type Tx = Prisma.TransactionClient;

/**
 * A brand records an online order that came through a referral code. Creates a
 * PURCHASED referral + conversion and PENDING ledger entries. Nothing is owed
 * until the brand verifies the order.
 */
export async function recordOrder(brandId: string, actorId: string, input: RecordOrderInput, now = new Date()) {
  return transaction((tx) => recordOrderInTx(tx, brandId, actorId, input, now));
}

/** Transaction-scoped body of recordOrder, so callers can compose it (e.g. confirming an order claim). */
export async function recordOrderInTx(tx: Tx, brandId: string, actorId: string, input: RecordOrderInput, now = new Date()) {
  const code = normalizeReferralCode(input.code);
  {
    const link = await tx.referralLink.findUnique({
      where: { code },
      include: {
        campaign: true,
        owner: { select: { id: true, email: true, phone: true } },
      },
    });
    if (!link || link.campaign.brandId !== brandId) throw new ConversionError("Referral code not found for your brand.");
    if (link.status !== "ACTIVE") throw new ConversionError("This referral link is disabled.");
    const check = checkOrderDate(link.campaign, input.orderedAt ?? now, now, { wholeDay: !!input.orderedAt && !!input.orderedOnDay });
    if (check.problem) throw new ConversionError(check.problem);
    const orderedAt = check.orderedAt;
    if (!meetsMinimumPurchase(link.campaign, input.amountMinor)) {
      throw new ConversionError("Order value is below the campaign's minimum order value.");
    }

    const contactHash = input.customerContactHash ?? (input.customerContact ? hashValue(input.customerContact) : null);
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
          orderedAt,
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
        metadata: { brandId, campaignId: link.campaignId, code, amount: input.amountMinor, source: conversion.source, orderedAt: orderedAt.toISOString() },
      },
      tx,
    );
    return { referral, conversion };
  }
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
  return transaction((tx) => verifyConversionInTx(tx, brandId, actorId, referralId, now));
}

/** Transaction-scoped body of verifyConversion (the campaign lock is held until the caller's transaction ends). */
export async function verifyConversionInTx(tx: Tx, brandId: string, actorId: string, referralId: string, now = new Date()) {
  {
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
        campaign: { select: { budget: true, id: true, name: true, holdDays: true } },
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

    // Wallet on: the order is paid for out of the brand wallet in this same transaction
    // (throws, and verifies nothing, if the balance does not cover it).
    if (walletEnabled()) {
      try {
        await debitForVerifiedOrder(tx, { brandId, referralId, owed, orderReference: referral.conversion.orderReference, actorId });
      } catch (err) {
        if (err instanceof WalletError) throw new ConversionError(err.message);
        throw err;
      }
    }

    await tx.referral.update({ where: { id: referralId }, data: { status: "VERIFIED", verifiedAt: now } });
    await tx.conversion.update({ where: { id: referral.conversion.id }, data: { verifiedById: actorId, verifiedAt: now } });
    const payableAt = payableAtFor(referral.campaign.holdDays, now);
    await tx.commission.updateMany({ where: { referralId, status: "PENDING" }, data: { status: "APPROVED", payableAt } });
    await tx.reward.updateMany({ where: { referralId, status: "PENDING" }, data: { status: "AVAILABLE", payableAt } });
    const holdNote = payableAt ? ` It can be paid out from ${payableAt.toISOString().slice(0, 10)}, after the brand's ${referral.campaign.holdDays}-day refund window.` : "";
    await notify(
      {
        userId: referral.referrerId,
        type: "CONVERSION_VERIFIED",
        idempotencyKey: `conversion:${referralId}:VERIFIED`,
        title: `Order verified: ${referral.campaign.name}`,
        body: (referral.referralLink.partnerType === "CREATOR" ? "Your commission for this order is now approved." : "Your reward for this order is now available.") + holdNote,
        href: referral.referralLink.partnerType === "CREATOR" ? "/dashboard/creator/earnings" : "/dashboard/customer/rewards",
        email: true,
      },
      tx,
    );
    await recordAudit(
      { userId: actorId, action: "CONVERSION_VERIFIED", entityType: "Referral", entityId: referralId, metadata: { brandId, orderReference: referral.conversion.orderReference, owed, payableAt: payableAt?.toISOString() ?? null } },
      tx,
    );
  }
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
        commissions: { select: { id: true, status: true, amount: true, payableAt: true, payoutItem: { select: { payoutRequest: { select: { id: true, status: true } } } } } },
        rewards: { select: { id: true, status: true, amount: true, payableAt: true, payoutItem: { select: { payoutRequest: { select: { id: true, status: true } } } } } },
      },
    });
    if (!referral || !referral.conversion) throw new ConversionError("Order not found.");
    if (referral.status !== "VERIFIED") throw new ConversionError("Only verified orders can be refunded.");
    if (referral.conversion.reversedAt) throw new ConversionError("This order has already been refunded.");
    // Partners are protected once money has moved or the refund window has passed:
    // brands can refund only while the commission/reward is still on hold and unpaid.
    const entries = [...referral.commissions, ...referral.rewards];
    if (referral.commissions.some((c) => c.status === "PAID") || referral.rewards.some((r) => r.status === "REDEEMED")) {
      throw new ConversionError("This order's commission or reward has already been paid out, so it can no longer be refunded here. Contact Refnivo support if the order was returned.");
    }
    if (referral.conversion.contestOutcome === "UPHELD") {
      throw new ConversionError("Refnivo reviewed this order after a partner contest and kept it. Contact Refnivo support to change it.");
    }
    if (entries.some((e) => e.payableAt && e.payableAt <= now) || (entries.length > 0 && entries.every((e) => !e.payableAt) && referral.conversion.verifiedAt && referral.conversion.verifiedAt.getTime() < now.getTime() - 60 * 24 * 60 * 60 * 1000)) {
      throw new ConversionError("The refund window for this order has closed. Contact Refnivo support if the order was returned.");
    }

    const reversedCommissions = referral.commissions.filter((c) => c.status === "APPROVED" || c.status === "PAID");
    const reversedRewards = referral.rewards.filter((r) => r.status === "AVAILABLE" || r.status === "APPROVED" || r.status === "REDEEMED");
    const alreadySettled = referral.commissions.some((c) => c.status === "PAID") || referral.rewards.some((r) => r.status === "REDEEMED");

    await tx.referral.update({ where: { id: referralId }, data: { status: "REFUNDED" } });
    await tx.conversion.update({ where: { id: referral.conversion.id }, data: { reversedAt: now, reversalReason: reason.trim() } });
    await tx.commission.updateMany({ where: { id: { in: reversedCommissions.map((c) => c.id) } }, data: { status: "REVERSED" } });
    await tx.reward.updateMany({ where: { id: { in: reversedRewards.map((r) => r.id) } }, data: { status: "REVERSED" } });
    // Whatever this order took from the wallet goes back (nothing, if it was verified before the wallet).
    await creditForReversedOrder(tx, { brandId, referralId, orderReference: referral.conversion.orderReference, actorId });

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

/** What a partner is still waiting on from brands (W4/W5): recorded orders and buyer claims not yet decided. */
export async function partnerWaitingSummary(userId: string) {
  const [orders, claims] = await Promise.all([
    prisma.referral.count({ where: { referrerId: userId, status: "PURCHASED", conversion: { isNot: null } } }),
    prisma.orderClaim.count({ where: { status: "PENDING", referralLink: { ownerId: userId } } }),
  ]);
  return { orders, claims };
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
      updatedAt: true,
      verifiedAt: true,
      qualifyingEvent: true,
      campaign: { select: { name: true, slug: true, brand: { select: { name: true } }, product: { select: { name: true } } } },
      conversion: {
        select: {
          amount: true,
          currency: true,
          createdAt: true,
          orderedAt: true,
          reversedAt: true,
          reversalReason: true,
          contestedAt: true,
          contestResolvedAt: true,
          contestOutcome: true,
          contestNote: true,
        },
      },
      commissions: { select: { amount: true, status: true, currency: true, payableAt: true } },
      rewards: { select: { amount: true, status: true, currency: true, payableAt: true } },
    },
  });
}

// ---------------------------------------------------------------------------
// Partner contests (docs/AUDIT.md W3): a creator or customer can ask Refnivo to
// review an order the brand rejected or refunded. An admin decides; every step
// is notified and audited in the same transaction.
// ---------------------------------------------------------------------------

/** How long after the brand's decision a partner can contest it. */
export const CONTEST_WINDOW_DAYS = 30;

export async function contestConversion(userId: string, referralId: string, reason: string, now = new Date()) {
  const text = reason.trim();
  if (text.length < 10) throw new ConversionError("Tell Refnivo what went wrong (at least 10 characters).");
  if (text.length > 1000) throw new ConversionError("Keep the reason under 1,000 characters.");
  return transaction(async (tx) => {
    const referral = await tx.referral.findFirst({
      where: { id: referralId, referrerId: userId },
      include: { conversion: true, campaign: { select: { name: true, brand: { select: { ownerId: true, name: true } } } } },
    });
    if (!referral || !referral.conversion) throw new ConversionError("Order not found.");
    if (referral.status !== "REJECTED" && referral.status !== "REFUNDED") throw new ConversionError("Only rejected or refunded orders can be contested.");
    if (referral.conversion.contestedAt) throw new ConversionError("You have already contested this order.");
    const decidedAt = referral.conversion.reversedAt ?? referral.updatedAt;
    if (now.getTime() - decidedAt.getTime() > CONTEST_WINDOW_DAYS * 24 * 60 * 60 * 1000) {
      throw new ConversionError(`Orders can be contested within ${CONTEST_WINDOW_DAYS} days of the brand's decision.`);
    }
    await tx.conversion.update({ where: { id: referral.conversion.id }, data: { contestedAt: now, contestReason: text } });
    await notifyMany(
      await adminUserIds(tx),
      {
        type: "SYSTEM",
        idempotencyKey: `contest:${referralId}`,
        title: `Order contested: ${referral.conversion.orderReference}`,
        body: `A partner disputes the ${referral.status === "REJECTED" ? "rejection" : "refund"} of an order on "${referral.campaign.name}" (${referral.campaign.brand.name}).`,
        href: "/dashboard/admin/contests",
        email: true,
      },
      tx,
    );
    await notify(
      {
        userId: referral.campaign.brand.ownerId,
        type: "SYSTEM",
        idempotencyKey: `contest-brand:${referralId}`,
        title: `A partner contested order ${referral.conversion.orderReference}`,
        body: "Refnivo will review the order and may contact you for proof (for example the refund or cancellation record).",
        href: "/dashboard/brand/orders",
      },
      tx,
    );
    await recordAudit(
      { userId, action: "CONVERSION_CONTESTED", entityType: "Referral", entityId: referralId, metadata: { status: referral.status, reason: text } },
      tx,
    );
  });
}

export type ContestOutcome = "UPHELD" | "DISMISSED";

/**
 * Admin decision on a contest.
 *  - DISMISSED: the brand's decision stands.
 *  - UPHELD on a REJECTED order: the order goes back to "pending verification"
 *    (entries back to PENDING) so the brand must look at it again.
 *  - UPHELD on a REFUNDED order: the order is reinstated as verified; its
 *    unpaid entries become payable again and, with the wallet on, the amount is
 *    taken from the brand wallet again (it may go negative: Refnivo decided).
 */
export async function resolveContest(adminId: string, referralId: string, outcome: ContestOutcome, note: string, now = new Date()) {
  const text = note.trim();
  if (!text) throw new ConversionError("Add a note explaining the decision.");
  return transaction(async (tx) => {
    const target = await tx.referral.findUnique({ where: { id: referralId }, select: { campaignId: true } });
    if (!target) throw new ConversionError("Order not found.");
    await tx.$queryRaw`SELECT "id" FROM "campaigns" WHERE "id" = ${target.campaignId} FOR UPDATE`;
    const referral = await tx.referral.findUnique({
      where: { id: referralId },
      include: {
        conversion: true,
        campaign: { select: { name: true, brandId: true, brand: { select: { ownerId: true } } } },
        referralLink: { select: { partnerType: true } },
        commissions: { select: { id: true, status: true, amount: true, payoutItem: { select: { id: true } } } },
        rewards: { select: { id: true, status: true, amount: true, payoutItem: { select: { id: true } } } },
      },
    });
    if (!referral || !referral.conversion) throw new ConversionError("Order not found.");
    if (!referral.conversion.contestedAt) throw new ConversionError("This order has not been contested.");
    if (referral.conversion.contestResolvedAt) throw new ConversionError("This contest has already been resolved.");

    if (outcome === "UPHELD" && referral.status === "REJECTED") {
      await tx.referral.update({ where: { id: referralId }, data: { status: "PURCHASED" } });
      await tx.commission.updateMany({ where: { referralId, status: "REJECTED" }, data: { status: "PENDING" } });
      await tx.reward.updateMany({ where: { referralId, status: "REJECTED" }, data: { status: "PENDING" } });
    } else if (outcome === "UPHELD" && referral.status === "REFUNDED") {
      const commissions = referral.commissions.filter((c) => c.status === "REVERSED" && !c.payoutItem);
      const rewards = referral.rewards.filter((r) => r.status === "REVERSED" && !r.payoutItem);
      const owed = [...commissions, ...rewards].reduce((s, e) => s + e.amount, 0);
      if (walletEnabled() && owed > 0) {
        await debitWallet(tx, {
          brandId: referral.campaign.brandId,
          amount: owed,
          type: "ORDER_DEBIT",
          idempotencyKey: `order-reinstated:${referralId}`,
          referralId,
          note: `Order ${referral.conversion.orderReference} reinstated after review`,
          actorId: adminId,
          allowNegative: true,
        });
      }
      await tx.referral.update({ where: { id: referralId }, data: { status: "VERIFIED" } });
      await tx.conversion.update({ where: { id: referral.conversion.id }, data: { reversedAt: null } });
      await tx.commission.updateMany({ where: { id: { in: commissions.map((c) => c.id) } }, data: { status: "APPROVED", payableAt: null } });
      await tx.reward.updateMany({ where: { id: { in: rewards.map((r) => r.id) } }, data: { status: "AVAILABLE", payableAt: null } });
    } else if (outcome === "UPHELD") {
      throw new ConversionError("This order is no longer rejected or refunded, so there is nothing to reinstate.");
    }

    await tx.conversion.update({ where: { id: referral.conversion.id }, data: { contestResolvedAt: now, contestOutcome: outcome, contestNote: text } });
    const href = referral.referralLink.partnerType === "CREATOR" ? "/dashboard/creator/conversions" : "/dashboard/customer/rewards";
    const upheldBody = referral.status === "REJECTED" ? "The order is back with the brand for verification." : "The order is reinstated and your earnings are payable again.";
    await notify(
      {
        userId: referral.referrerId,
        type: "SYSTEM",
        idempotencyKey: `contest-resolved:${referralId}`,
        title: `Contest ${outcome === "UPHELD" ? "accepted" : "closed"}: ${referral.campaign.name}`,
        body: `${outcome === "UPHELD" ? upheldBody : "Refnivo reviewed the order and the brand's decision stands."} Note: ${text}`,
        href,
        email: true,
      },
      tx,
    );
    await notify(
      {
        userId: referral.campaign.brand.ownerId,
        type: "SYSTEM",
        idempotencyKey: `contest-resolved-brand:${referralId}`,
        title: `Contest on order ${referral.conversion.orderReference} ${outcome === "UPHELD" ? "accepted" : "closed"}`,
        body: `${outcome === "UPHELD" ? (referral.status === "REJECTED" ? "Please verify or reject the order again." : "The order was reinstated as verified.") : "Your decision stands."} Note: ${text}`,
        href: "/dashboard/brand/orders",
      },
      tx,
    );
    await recordAudit(
      { userId: adminId, actorRole: "ADMIN", action: "CONTEST_RESOLVED", entityType: "Referral", entityId: referralId, metadata: { outcome, note: text, previousStatus: referral.status } },
      tx,
    );
  });
}

export async function listContests(state: "OPEN" | "RESOLVED" = "OPEN", take = 100) {
  return prisma.conversion.findMany({
    where: { contestedAt: { not: null }, contestResolvedAt: state === "OPEN" ? null : { not: null } },
    orderBy: { contestedAt: state === "OPEN" ? "asc" : "desc" },
    take,
    select: {
      orderReference: true,
      amount: true,
      currency: true,
      orderedAt: true,
      createdAt: true,
      reversalReason: true,
      contestedAt: true,
      contestReason: true,
      contestResolvedAt: true,
      contestOutcome: true,
      contestNote: true,
      brand: { select: { name: true } },
      referral: {
        select: {
          id: true,
          status: true,
          qualifyingEvent: true,
          campaign: { select: { name: true } },
          referralLink: { select: { code: true, partnerType: true } },
          referrer: { select: { name: true } },
        },
      },
    },
  });
}

export async function countOpenContests() {
  return prisma.conversion.count({ where: { contestedAt: { not: null }, contestResolvedAt: null } });
}
