import { Prisma, type PayoutKind, type PayoutStatus } from "@prisma/client";
import { prisma, transaction } from "@/lib/db/prisma";
import { formatMoney } from "@/lib/money";
import { recordAudit } from "./audit";
import { adminUserIds, notify, notifyMany } from "./notify";

/**
 * Manual payout / redemption workflow.
 *
 * No money moves through the platform in this version. A creator (commissions)
 * or customer (rewards) requests settlement of their eligible ledger entries;
 * an admin reviews it, settles off-platform, and records the external
 * reference when marking it PAID. Only then do the linked commissions become
 * PAID / rewards become REDEEMED — never from the browser, never on request.
 *
 * Integrity: `payout_items.commissionId` / `rewardId` are unique, so a ledger
 * row can be part of at most one payout; eligibility queries exclude rows that
 * already have an item. Amounts are frozen on the request from the ledger rows.
 */
export class PayoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PayoutError";
  }
}

export const PAYOUT_METHODS = ["UPI", "Bank transfer", "Brand voucher"] as const;
export type PayoutMethod = (typeof PAYOUT_METHODS)[number];

export function payoutMinimumMinor(env: NodeJS.ProcessEnv = process.env): number {
  const n = Number(env.PAYOUT_MINIMUM_AMOUNT ?? 50_000);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 50_000;
}

const OPEN_STATUSES: PayoutStatus[] = ["REQUESTED", "UNDER_REVIEW", "APPROVED", "PROCESSING"];

/** Ledger rows that can be settled now: approved/available and not part of any payout. */
export async function eligibleItems(userId: string, kind: PayoutKind, db: Prisma.TransactionClient | typeof prisma = prisma) {
  if (kind === "COMMISSION") {
    const rows = await db.commission.findMany({
      where: { creatorId: userId, status: "APPROVED", payoutItem: null },
      select: { id: true, amount: true, currency: true },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((r) => ({ id: r.id, amount: r.amount, currency: r.currency }));
  }
  const rows = await db.reward.findMany({
    where: { recipientId: userId, status: "AVAILABLE", payoutItem: null },
    select: { id: true, amount: true, currency: true },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => ({ id: r.id, amount: r.amount, currency: r.currency }));
}

export async function payoutSummary(userId: string, kind: PayoutKind) {
  const [items, open, history] = await Promise.all([
    eligibleItems(userId, kind),
    prisma.payoutRequest.findFirst({ where: { userId, kind, status: { in: OPEN_STATUSES } }, select: { id: true, status: true, amount: true, requestedAt: true } }),
    prisma.payoutRequest.findMany({
      where: { userId, kind },
      orderBy: { requestedAt: "desc" },
      take: 20,
      select: { id: true, amount: true, currency: true, status: true, payoutMethod: true, payoutReference: true, adminNote: true, requestedAt: true, processedAt: true },
    }),
  ]);
  const eligible = items.reduce((s, i) => s + i.amount, 0);
  const minimum = payoutMinimumMinor();
  return { eligible, eligibleCount: items.length, minimum, canRequest: !open && eligible >= minimum && eligible > 0, open, history };
}

/** Creates a REQUESTED payout for every eligible ledger row of the user. */
export async function requestPayout(userId: string, kind: PayoutKind, method: PayoutMethod, now = new Date()) {
  return transaction(async (tx) => {
    // Serialise per user: two simultaneous requests would otherwise both pass
    // the "open request" check and race on the same ledger rows.
    await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${userId} FOR UPDATE`;
    const open = await tx.payoutRequest.findFirst({ where: { userId, kind, status: { in: OPEN_STATUSES } }, select: { id: true } });
    if (open) throw new PayoutError("You already have a payout request in progress.");

    const items = await eligibleItems(userId, kind, tx);
    if (!items.length) throw new PayoutError("Nothing is eligible for payout yet.");
    const currencies = new Set(items.map((i) => i.currency));
    if (currencies.size > 1) throw new PayoutError("Eligible entries use more than one currency; contact support.");
    const amount = items.reduce((s, i) => s + i.amount, 0);
    const minimum = payoutMinimumMinor();
    if (amount < minimum) throw new PayoutError("Your eligible balance is below the payout minimum.");

    let request;
    try {
      request = await tx.payoutRequest.create({
        data: {
          userId,
          kind,
          amount,
          currency: items[0].currency,
          payoutMethod: method,
          requestedAt: now,
          items: {
            create: items.map((i) => (kind === "COMMISSION" ? { commissionId: i.id, amount: i.amount } : { rewardId: i.id, amount: i.amount })),
          },
        },
        select: { id: true, amount: true, currency: true, status: true },
      });
    } catch (err) {
      // Unique payout_items.commissionId / rewardId: a row was claimed by another request in the meantime.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new PayoutError("Some entries were just included in another request. Refresh the page and try again.");
      }
      throw err;
    }

    await recordAudit({ userId, action: "PAYOUT_REQUESTED", entityType: "PayoutRequest", entityId: request.id, metadata: { kind, amount, method, items: items.length } }, tx);
    await notifyMany(
      await adminUserIds(tx),
      {
        type: "PAYOUT_REQUESTED",
        title: `New ${kind === "COMMISSION" ? "commission payout" : "reward redemption"} request`,
        body: `A ${kind === "COMMISSION" ? "creator" : "customer"} requested settlement of ${items.length} entr${items.length === 1 ? "y" : "ies"}.`,
        href: "/dashboard/admin/payouts",
      },
      tx,
    );
    return request;
  });
}

export type PayoutReviewAction = "UNDER_REVIEW" | "APPROVE" | "MARK_PAID" | "REJECT" | "FAIL";

const REVIEW_TRANSITIONS: Record<PayoutReviewAction, { from: PayoutStatus[]; to: PayoutStatus }> = {
  UNDER_REVIEW: { from: ["REQUESTED"], to: "UNDER_REVIEW" },
  APPROVE: { from: ["REQUESTED", "UNDER_REVIEW", "FAILED"], to: "APPROVED" },
  MARK_PAID: { from: ["APPROVED", "PROCESSING"], to: "PAID" },
  FAIL: { from: ["APPROVED", "PROCESSING"], to: "FAILED" },
  REJECT: { from: ["REQUESTED", "UNDER_REVIEW", "APPROVED", "FAILED"], to: "REJECTED" },
};

export function canReviewPayout(status: PayoutStatus, action: PayoutReviewAction): boolean {
  return REVIEW_TRANSITIONS[action].from.includes(status);
}

/**
 * Entries in a request whose ledger row can no longer be settled (reversed by
 * a refund, or rejected) after the request was made. Their amounts must not be
 * paid: the request is trimmed to what is still owed before APPROVE/MARK_PAID.
 */
type PayoutItemRow = {
  id: string;
  amount: number;
  commissionId: string | null;
  rewardId: string | null;
  commission: { status: string } | null;
  reward: { status: string } | null;
};

export function splitSettleable<T extends PayoutItemRow>(items: T[]): { settleable: T[]; dropped: T[] } {
  const settleable: T[] = [];
  const dropped: T[] = [];
  for (const item of items) {
    const status = item.commission?.status ?? item.reward?.status ?? null;
    const ok = item.commission ? status === "APPROVED" || status === "PAID" : status === "AVAILABLE" || status === "REDEEMED";
    (ok ? settleable : dropped).push(item);
  }
  return { settleable, dropped };
}

/**
 * Admin review. MARK_PAID requires an external settlement reference and is the
 * ONLY path that sets commissions PAID / rewards REDEEMED. REJECT releases the
 * ledger rows (items deleted) so they can be requested again later.
 *
 * APPROVE and MARK_PAID first reconcile the request against the ledger: rows
 * reversed after the request (refunds) are removed from it and the amount is
 * recomputed, so the admin is never told to settle money that is no longer
 * owed. The adjustment is audited and shown to the requester.
 */
export async function reviewPayout(
  adminId: string,
  payoutId: string,
  action: PayoutReviewAction,
  input: { reference?: string | null; note?: string | null } = {},
  now = new Date(),
) {
  return transaction(async (tx) => {
    const request = await tx.payoutRequest.findUnique({
      where: { id: payoutId },
      include: {
        items: {
          select: { id: true, amount: true, commissionId: true, rewardId: true, commission: { select: { status: true } }, reward: { select: { status: true } } },
        },
      },
    });
    if (!request) throw new PayoutError("Payout request not found.");
    if (!canReviewPayout(request.status, action)) throw new PayoutError(`This request cannot be ${action.toLowerCase().replace("_", " ")} from status ${request.status}.`);

    const reference = input.reference?.trim() || null;
    const note = input.note?.trim() || null;
    if (action === "MARK_PAID" && !reference) throw new PayoutError("An external settlement reference (UPI/bank transaction id or voucher code) is required to mark a payout as paid.");
    if (action === "REJECT" && !note) throw new PayoutError("Please give the requester a reason for the rejection.");

    // Reconcile with the ledger before any money-affecting transition.
    let items = request.items;
    let amount = request.amount;
    let adjustment: { droppedItems: number; droppedAmount: number; previousAmount: number } | null = null;
    if (action === "APPROVE" || action === "MARK_PAID") {
      const { settleable, dropped } = splitSettleable(request.items);
      if (dropped.length) {
        const droppedAmount = dropped.reduce((s, i) => s + i.amount, 0);
        const remaining = settleable.reduce((s, i) => s + i.amount, 0);
        if (remaining <= 0) {
          throw new PayoutError(
            `Every entry in this request was reversed after it was made (${formatMoney(droppedAmount, request.currency)}); nothing is owed. Reject the request so the user sees why.`,
          );
        }
        await tx.payoutItem.deleteMany({ where: { id: { in: dropped.map((i) => i.id) } } });
        adjustment = { droppedItems: dropped.length, droppedAmount, previousAmount: request.amount };
        items = settleable;
        amount = remaining;
      }
    }

    const to = REVIEW_TRANSITIONS[action].to;
    const terminal = to === "PAID" || to === "REJECTED";
    const updated = await tx.payoutRequest.update({
      where: { id: payoutId },
      data: {
        status: to,
        amount,
        adminNote: note ?? request.adminNote,
        payoutReference: action === "MARK_PAID" ? reference : request.payoutReference,
        processedById: adminId,
        processedAt: terminal ? now : request.processedAt,
      },
      select: { id: true, status: true, amount: true, currency: true, kind: true, userId: true },
    });

    if (action === "MARK_PAID") {
      const commissionIds = items.map((i) => i.commissionId).filter((id): id is string => !!id);
      const rewardIds = items.map((i) => i.rewardId).filter((id): id is string => !!id);
      if (commissionIds.length) await tx.commission.updateMany({ where: { id: { in: commissionIds }, status: "APPROVED" }, data: { status: "PAID" } });
      if (rewardIds.length) await tx.reward.updateMany({ where: { id: { in: rewardIds }, status: "AVAILABLE" }, data: { status: "REDEEMED" } });
    }
    if (action === "REJECT") {
      // Release the ledger rows so they stay APPROVED/AVAILABLE and can be requested again.
      await tx.payoutItem.deleteMany({ where: { payoutRequestId: payoutId } });
    }

    const kindLabel = request.kind === "COMMISSION" ? "payout" : "reward redemption";
    const titles: Record<PayoutReviewAction, string> = {
      UNDER_REVIEW: `Your ${kindLabel} request is under review`,
      APPROVE: `Your ${kindLabel} request was approved`,
      MARK_PAID: `Your ${kindLabel} has been settled`,
      FAIL: `Your ${kindLabel} could not be completed`,
      REJECT: `Your ${kindLabel} request was declined`,
    };
    const adjustmentNote = adjustment
      ? ` ${adjustment.droppedItems} entr${adjustment.droppedItems === 1 ? "y was" : "ies were"} reversed by a refund after you requested, so the amount is now ${formatMoney(amount, request.currency)} (was ${formatMoney(adjustment.previousAmount, request.currency)}).`
      : "";
    await notify(
      {
        userId: request.userId,
        type: "PAYOUT_UPDATED",
        idempotencyKey: `payout:${payoutId}:${request.status}:${action}`,
        title: titles[action],
        body: `${action === "MARK_PAID" ? `Reference: ${reference}` : (note ?? "")}${adjustmentNote}`.trim() || null,
        href: request.kind === "COMMISSION" ? "/dashboard/creator/earnings" : "/dashboard/customer/rewards",
        email: true,
      },
      tx,
    );
    await recordAudit(
      {
        userId: adminId,
        actorRole: "ADMIN",
        action: `PAYOUT_${action}`,
        entityType: "PayoutRequest",
        entityId: payoutId,
        metadata: { from: request.status, to, amount, kind: request.kind, hasReference: !!reference, note, ...(adjustment ? { adjustment } : {}) },
      },
      tx,
    );
    return updated;
  });
}

/**
 * Ledger rows that were settled (PAID / REDEEMED) and later REVERSED by a refund.
 * Money already left the platform; there is no automatic clawback — this list is
 * the admin's recovery worklist (deduct from the partner's next payout, or ask
 * the brand to absorb it).
 */
export async function listSettledThenReversed(take = 100) {
  const referralSelect = { conversion: { select: { orderReference: true, reversalReason: true } }, campaign: { select: { name: true, brand: { select: { name: true } } } } } as const;
  const payoutSelect = { payoutRequest: { select: { id: true, payoutReference: true, processedAt: true } } } as const;
  const [commissions, rewards] = await Promise.all([
    prisma.commission.findMany({
      where: { status: "REVERSED", payoutItem: { payoutRequest: { status: "PAID" } } },
      orderBy: { updatedAt: "desc" },
      take,
      select: { id: true, amount: true, currency: true, updatedAt: true, creator: { select: { id: true, name: true, email: true } }, referral: { select: referralSelect }, payoutItem: { select: payoutSelect } },
    }),
    prisma.reward.findMany({
      where: { status: "REVERSED", payoutItem: { payoutRequest: { status: "PAID" } } },
      orderBy: { updatedAt: "desc" },
      take,
      select: { id: true, amount: true, currency: true, updatedAt: true, recipient: { select: { id: true, name: true, email: true } }, referral: { select: referralSelect }, payoutItem: { select: payoutSelect } },
    }),
  ]);
  const rows = [
    ...commissions.map((c) => ({ kind: "COMMISSION" as const, id: c.id, amount: c.amount, currency: c.currency, reversedAt: c.updatedAt, partner: c.creator, referral: c.referral, payout: c.payoutItem?.payoutRequest ?? null })),
    ...rewards.map((r) => ({ kind: "REWARD" as const, id: r.id, amount: r.amount, currency: r.currency, reversedAt: r.updatedAt, partner: r.recipient, referral: r.referral, payout: r.payoutItem?.payoutRequest ?? null })),
  ];
  return rows.sort((a, b) => b.reversedAt.getTime() - a.reversedAt.getTime());
}

export async function listPayoutRequests(status?: PayoutStatus | "OPEN" | "ALL") {
  const where: Prisma.PayoutRequestWhereInput =
    !status || status === "OPEN" ? { status: { in: OPEN_STATUSES } } : status === "ALL" ? {} : { status };
  return prisma.payoutRequest.findMany({
    where,
    orderBy: { requestedAt: "desc" },
    take: 200,
    select: {
      id: true,
      kind: true,
      amount: true,
      currency: true,
      status: true,
      payoutMethod: true,
      payoutReference: true,
      adminNote: true,
      requestedAt: true,
      processedAt: true,
      user: { select: { id: true, name: true, email: true, role: true } },
      _count: { select: { items: true } },
    },
  });
}
