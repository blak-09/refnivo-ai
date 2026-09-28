import { randomBytes } from "node:crypto";
import { Prisma, type PaymentStatus, type PaymentTransaction } from "@prisma/client";
import { prisma, transaction } from "@/lib/db/prisma";
import { getPlan, periodEnd, type Plan } from "@/lib/config/plans";
import { PaymentProviderError, type PaymentProvider, type ProviderPayment } from "@/lib/payments";
import { securityEvent } from "@/lib/utils/security-log";
import { recordAudit } from "./audit";
import { notify } from "./notify";

export class PaymentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentError";
  }
}

/**
 * The provider charged something other than what we recorded. Thrown from inside
 * the write transaction (so nothing is granted) and turned into a FAILED row by
 * the caller afterwards — marking it inside the transaction would be rolled back
 * along with the abort.
 */
class AmountMismatchError extends Error {
  constructor(readonly transactionId: string) {
    super("charged amount did not match the order");
    this.name = "AmountMismatchError";
  }
}

/** A checkout attempt is only worth completing for this long. */
export const CHECKOUT_TTL_MS = 30 * 60 * 1000;

/** Statuses that can still change. Everything else is final. */
const OPEN: PaymentStatus[] = ["CREATED", "PENDING", "PROCESSING"];
const FINAL_PAID: PaymentStatus[] = ["PAID", "REFUNDED", "PARTIALLY_REFUNDED"];

export function isOpen(status: PaymentStatus): boolean {
  return OPEN.includes(status);
}

/** Human-readable reference: shown to the payer, safe to quote in support. */
export function newReference(): string {
  return `RFN-${randomBytes(4).toString("hex").toUpperCase()}`;
}

/**
 * Creates the local transaction and the provider order.
 *
 * The client sends a plan KEY only: the amount is read from the server-side plan
 * table and frozen on the row, so a tampered request can never change the price.
 * The row exists before the provider is called, so an order that is created but
 * never paid is still visible and can be reconciled.
 */
export async function startPlanCheckout(
  provider: PaymentProvider,
  input: { userId: string; brandId: string; brandName: string; planKey: unknown },
  now = new Date(),
): Promise<{ transaction: PaymentTransaction; plan: Plan; providerOrderId: string; publicKey: string }> {
  const plan = getPlan(input.planKey);
  if (!plan) throw new PaymentError("Unknown plan.");

  const reference = newReference();
  const row = await prisma.paymentTransaction.create({
    data: {
      reference,
      userId: input.userId,
      brandId: input.brandId,
      purpose: "BRAND_PLAN",
      planKey: plan.key,
      amount: plan.amount, // server-resolved, never from the request
      currency: plan.currency,
      status: "CREATED",
      provider: provider.key,
      expiresAt: new Date(now.getTime() + CHECKOUT_TTL_MS),
      metadata: { planName: plan.name, periodDays: plan.periodDays, brandName: input.brandName },
    },
  });

  try {
    const order = await provider.createOrder({
      reference,
      amount: plan.amount,
      currency: plan.currency,
      notes: { reference, planKey: plan.key, brandId: input.brandId },
    });
    // The provider must agree with what we asked for before any payer sees it.
    if (order.amount !== plan.amount || order.currency !== plan.currency) {
      await prisma.paymentTransaction.update({
        where: { id: row.id },
        data: { status: "FAILED", failureCode: "AMOUNT_MISMATCH", failureReason: "Provider order did not match the plan price." },
      });
      securityEvent("PAYMENT_AMOUNT_MISMATCH", { reference, expected: plan.amount, got: order.amount });
      throw new PaymentError("Could not start the payment. Please try again.");
    }
    const updated = await prisma.paymentTransaction.update({
      where: { id: row.id },
      data: { providerOrderId: order.providerOrderId, status: "PENDING" },
    });
    await recordAudit({
      userId: input.userId,
      action: "PAYMENT_STARTED",
      entityType: "PaymentTransaction",
      entityId: row.id,
      metadata: { reference, planKey: plan.key, amount: plan.amount, provider: provider.key },
    });
    return { transaction: updated, plan, providerOrderId: order.providerOrderId, publicKey: order.publicKey };
  } catch (err) {
    if (!(err instanceof PaymentError)) {
      await prisma.paymentTransaction
        .update({ where: { id: row.id }, data: { status: "FAILED", failureCode: "PROVIDER_UNAVAILABLE", failureReason: "Could not reach the payment provider." } })
        .catch(() => undefined);
      console.error("[payments] createOrder failed", err instanceof Error ? err.message : err);
      throw new PaymentError(err instanceof PaymentProviderError ? err.publicMessage : "Could not start the payment. Please try again.");
    }
    throw err;
  }
}

/**
 * Applies what the provider says about a payment to our row — the ONE place a
 * transaction can become PAID, used by both the post-checkout verify and the
 * webhook. Idempotent and monotonic:
 *
 *  - the row is re-read inside the transaction;
 *  - a row that is already PAID is never downgraded by a late or replayed event;
 *  - the amount and currency must match what we froze at creation;
 *  - granting the subscription happens in the same database transaction.
 */
export async function applyProviderPayment(
  payment: ProviderPayment,
  opts: { expectTransactionId?: string; source: "verify" | "webhook"; actorId?: string | null },
  now = new Date(),
): Promise<{ transaction: PaymentTransaction; changed: boolean }> {
  try {
    return await applyInTransaction(payment, opts, now);
  } catch (err) {
    if (err instanceof AmountMismatchError) {
      // Outside the aborted transaction, so the record of the refusal survives.
      await prisma.paymentTransaction.update({
        where: { id: err.transactionId },
        data: { status: "FAILED", failureCode: "AMOUNT_MISMATCH", failureReason: "Charged amount did not match the order.", providerPaymentId: payment.providerPaymentId },
      });
      throw new PaymentError("The charged amount did not match this order. Nothing was granted; our team has been alerted.");
    }
    throw err;
  }
}

async function applyInTransaction(
  payment: ProviderPayment,
  opts: { expectTransactionId?: string; source: "verify" | "webhook"; actorId?: string | null },
  now: Date,
): Promise<{ transaction: PaymentTransaction; changed: boolean }> {
  return transaction(async (tx) => {
    const row = await tx.paymentTransaction.findFirst({
      where: payment.providerOrderId ? { providerOrderId: payment.providerOrderId } : { providerPaymentId: payment.providerPaymentId },
    });
    if (!row) throw new PaymentError("No matching payment record.");
    if (opts.expectTransactionId && row.id !== opts.expectTransactionId) throw new PaymentError("Payment does not belong to this checkout.");

    // Guard the money: the provider must have charged exactly what we recorded.
    if (payment.amount !== row.amount || payment.currency !== row.currency) {
      securityEvent("PAYMENT_AMOUNT_MISMATCH", { reference: row.reference, expected: row.amount, got: payment.amount, source: opts.source });
      throw new AmountMismatchError(row.id); // aborts the transaction: nothing is granted
    }

    const alreadyPaid = FINAL_PAID.includes(row.status);
    // Never walk a settled payment backwards (a delayed "failed" after a capture, a replay).
    const nextStatus: PaymentStatus = alreadyPaid && !FINAL_PAID.includes(payment.status) ? row.status : payment.status;
    const becomesPaid = !alreadyPaid && FINAL_PAID.includes(nextStatus);

    if (row.status === nextStatus && row.providerPaymentId === payment.providerPaymentId && row.refundedAmount === payment.refundedAmount) {
      return { transaction: row, changed: false }; // nothing new in this event
    }

    const updated = await tx.paymentTransaction.update({
      where: { id: row.id },
      data: {
        status: nextStatus,
        providerPaymentId: payment.providerPaymentId,
        method: payment.method ?? row.method,
        refundedAmount: payment.refundedAmount,
        failureCode: nextStatus === "FAILED" ? payment.failureCode : null,
        failureReason: nextStatus === "FAILED" ? payment.failureReason : null,
        paidAt: becomesPaid ? (row.paidAt ?? now) : row.paidAt,
      },
    });

    if (becomesPaid && updated.purpose === "BRAND_PLAN" && updated.brandId && updated.planKey) {
      await grantPlan(tx, updated, now);
    }

    await recordAudit(
      {
        userId: opts.actorId ?? updated.userId,
        action: becomesPaid ? "PAYMENT_PAID" : `PAYMENT_${nextStatus}`,
        entityType: "PaymentTransaction",
        entityId: updated.id,
        metadata: { reference: updated.reference, source: opts.source, status: nextStatus, amount: updated.amount },
      },
      tx,
    );
    return { transaction: updated, changed: true };
  });
}

/** Grants or extends the brand's plan. Renewals extend from whichever is later: now, or the unused remainder. */
async function grantPlan(tx: Prisma.TransactionClient, row: PaymentTransaction, now: Date) {
  const plan = getPlan(row.planKey);
  if (!plan || !row.brandId) return;
  const existing = await tx.brandSubscription.findUnique({ where: { brandId: row.brandId } });
  const from = existing && existing.status === "ACTIVE" && existing.currentPeriodEnd > now ? existing.currentPeriodEnd : now;
  const end = periodEnd(plan, from);

  await tx.brandSubscription.upsert({
    where: { brandId: row.brandId },
    create: { brandId: row.brandId, planKey: plan.key, status: "ACTIVE", startedAt: now, currentPeriodEnd: end, transactionId: row.id },
    update: { planKey: plan.key, status: "ACTIVE", currentPeriodEnd: end, cancelledAt: null, transactionId: row.id },
  });

  await notify(
    {
      userId: row.userId,
      type: "SYSTEM",
      // One receipt per transaction, however many times the webhook arrives.
      idempotencyKey: `payment:${row.id}:PAID`,
      title: `Payment received — ${plan.name} plan`,
      body: `We received your payment of ₹${(row.amount / 100).toLocaleString("en-IN")} (${row.reference}). Your ${plan.name} plan is active until ${end.toDateString()}.`,
      href: `/dashboard/brand/billing/${row.id}`,
      email: true,
    },
    tx,
  );
}

/**
 * Post-checkout verification. The browser's callback is treated as a hint only:
 * the signature is checked first, then the payment is re-fetched from the
 * provider and THAT is what updates the row.
 */
export async function verifyCheckout(
  provider: PaymentProvider,
  input: { transactionId: string; userId: string; providerOrderId: string; providerPaymentId: string; signature: string },
): Promise<PaymentTransaction> {
  const row = await prisma.paymentTransaction.findFirst({ where: { id: input.transactionId, userId: input.userId } });
  if (!row) throw new PaymentError("Payment not found.");

  if (!provider.verifyCheckoutSignature({ providerOrderId: input.providerOrderId, providerPaymentId: input.providerPaymentId, signature: input.signature })) {
    securityEvent("PAYMENT_SIGNATURE_INVALID", { reference: row.reference, source: "verify" });
    await prisma.paymentTransaction.update({ where: { id: row.id }, data: { status: "FAILED", failureCode: "SIGNATURE_INVALID", failureReason: "Could not verify the payment." } });
    throw new PaymentError("We could not verify this payment. If money left your account it will be returned by your bank.");
  }
  if (input.providerOrderId !== row.providerOrderId) {
    securityEvent("PAYMENT_ORDER_MISMATCH", { reference: row.reference });
    throw new PaymentError("This payment belongs to a different order.");
  }

  let payment: ProviderPayment;
  try {
    payment = await provider.getPayment(input.providerPaymentId);
  } catch (err) {
    // Uncertain, never PAID: the webhook or a manual refresh settles it.
    console.error("[payments] getPayment failed", err instanceof Error ? err.message : err);
    await prisma.paymentTransaction.update({ where: { id: row.id }, data: { status: isOpen(row.status) ? "PROCESSING" : row.status, providerPaymentId: input.providerPaymentId } });
    throw new PaymentError("Your payment is being confirmed. This page updates automatically — no need to pay again.");
  }
  const { transaction: updated } = await applyProviderPayment(payment, { expectTransactionId: row.id, source: "verify", actorId: input.userId });
  return updated;
}

/**
 * Handles a verified webhook event. The event is recorded first, keyed by the
 * provider's event id, so a replay short-circuits before anything is applied.
 */
export async function handleWebhookEvent(
  event: { id: string; type: string; payment: ProviderPayment | null; providerOrderId: string | null },
  provider: string,
  payload: unknown,
): Promise<{ applied: boolean; reason?: string }> {
  try {
    await prisma.paymentEvent.create({ data: { provider, providerEventId: event.id, type: event.type, payload: payload as Prisma.InputJsonValue } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      securityEvent("PAYMENT_WEBHOOK_DUPLICATE", { type: event.type });
      return { applied: false, reason: "duplicate" };
    }
    throw err;
  }

  if (!event.payment) return { applied: false, reason: "no payment in event" };
  try {
    const { transaction: row, changed } = await applyProviderPayment(event.payment, { source: "webhook" });
    await prisma.paymentEvent.update({ where: { providerEventId: event.id }, data: { applied: changed, transactionId: row.id } });
    return { applied: changed };
  } catch (err) {
    console.error("[payments] webhook apply failed", err instanceof Error ? err.message : err);
    return { applied: false, reason: "no matching transaction" };
  }
}

/** Re-reads the provider and applies the result. Used by the "check again" control. */
export async function refreshPaymentStatus(provider: PaymentProvider, transactionId: string, userId: string): Promise<PaymentTransaction> {
  const row = await prisma.paymentTransaction.findFirst({ where: { id: transactionId, userId } });
  if (!row) throw new PaymentError("Payment not found.");
  if (!row.providerPaymentId) {
    // Nothing was ever paid; expire a stale attempt so it stops looking pending.
    if (row.expiresAt && row.expiresAt < new Date() && isOpen(row.status)) {
      return prisma.paymentTransaction.update({ where: { id: row.id }, data: { status: "EXPIRED" } });
    }
    return row;
  }
  const payment = await provider.getPayment(row.providerPaymentId);
  const { transaction: updated } = await applyProviderPayment(payment, { expectTransactionId: row.id, source: "verify", actorId: userId });
  return updated;
}

/** Marks an open attempt cancelled when the payer closes the provider's checkout. */
export async function markCheckoutCancelled(transactionId: string, userId: string): Promise<PaymentTransaction | null> {
  const row = await prisma.paymentTransaction.findFirst({ where: { id: transactionId, userId } });
  if (!row || !isOpen(row.status) || row.providerPaymentId) return row; // a started payment is never "cancelled" locally
  return prisma.paymentTransaction.update({ where: { id: row.id }, data: { status: "CANCELLED" } });
}

/**
 * Admin refund. The provider decides: only a confirmed refund changes the row,
 * anything else leaves the transaction PAID and records the attempt.
 */
export async function refundPayment(
  provider: PaymentProvider,
  input: { transactionId: string; adminId: string; amount?: number },
): Promise<{ state: string; transaction: PaymentTransaction }> {
  const row = await prisma.paymentTransaction.findUnique({ where: { id: input.transactionId } });
  if (!row) throw new PaymentError("Payment not found.");
  if (!row.providerPaymentId || !FINAL_PAID.includes(row.status)) throw new PaymentError("Only a paid transaction can be refunded.");
  const remaining = row.amount - row.refundedAmount;
  const amount = input.amount ?? remaining;
  if (amount <= 0 || amount > remaining) throw new PaymentError("Refund amount is more than the remaining balance.");

  await recordAudit({
    userId: input.adminId,
    action: "PAYMENT_REFUND_REQUESTED",
    entityType: "PaymentTransaction",
    entityId: row.id,
    metadata: { reference: row.reference, amount },
  });

  const result = await provider.refund({ providerPaymentId: row.providerPaymentId, amount, reference: row.reference });
  if (result.state !== "done") {
    // Not refunded until the provider says so; the webhook finishes the job.
    await recordAudit({ userId: input.adminId, action: "PAYMENT_REFUND_PENDING", entityType: "PaymentTransaction", entityId: row.id, metadata: { state: result.state } });
    return { state: result.state, transaction: row };
  }

  const refunded = row.refundedAmount + result.amount;
  const updated = await prisma.paymentTransaction.update({
    where: { id: row.id },
    data: {
      refundedAmount: refunded,
      status: refunded >= row.amount ? "REFUNDED" : "PARTIALLY_REFUNDED",
      metadata: { ...(row.metadata as object satisfies object), lastRefundId: result.providerRefundId } as Prisma.InputJsonValue,
    },
  });
  await recordAudit({
    userId: input.adminId,
    action: "PAYMENT_REFUNDED",
    entityType: "PaymentTransaction",
    entityId: row.id,
    metadata: { reference: row.reference, amount: result.amount, providerRefundId: result.providerRefundId },
  });
  return { state: "done", transaction: updated };
}

// ─── reads ────────────────────────────────────────────────────────────────────

export async function listUserTransactions(userId: string, take = 50) {
  return prisma.paymentTransaction.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take });
}

export async function getUserTransaction(userId: string, id: string) {
  return prisma.paymentTransaction.findFirst({ where: { id, userId } });
}

export async function getBrandSubscription(brandId: string) {
  return prisma.brandSubscription.findUnique({ where: { brandId } });
}

/** ACTIVE and still inside its paid period. */
export function subscriptionIsCurrent(sub: { status: string; currentPeriodEnd: Date } | null, now = new Date()): boolean {
  return !!sub && sub.status === "ACTIVE" && sub.currentPeriodEnd > now;
}

export async function listAllTransactions(take = 200) {
  return prisma.paymentTransaction.findMany({
    orderBy: { createdAt: "desc" },
    take,
    include: { user: { select: { name: true, email: true } }, brand: { select: { name: true, slug: true } } },
  });
}
