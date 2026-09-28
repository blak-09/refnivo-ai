"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertBrandOwner, assertRole } from "@/lib/auth/guards";
import { getPaymentProvider } from "@/lib/payments";
import { markCheckoutCancelled, PaymentError, refreshPaymentStatus, refundPayment, startPlanCheckout, verifyCheckout } from "@/lib/services/payments";
import { fail, ok, safeErrorMessage, type ActionResult } from "@/lib/utils/action-result";
import { clientIp, rateLimit } from "@/lib/utils/rate-limit";
import { securityEvent } from "@/lib/utils/security-log";

/**
 * Payment actions.
 *
 * Every one of these re-checks who is calling and re-resolves amounts on the
 * server. The client only ever sends identifiers — a plan key, a transaction id
 * and the provider's callback fields — never a price and never a status.
 */
const PAYMENTS_OFF = "Payments are not enabled on this deployment.";

const checkoutSchema = z.object({ planKey: z.string().min(1).max(40) });
const verifySchema = z.object({
  transactionId: z.string().min(1).max(40),
  razorpay_order_id: z.string().min(1).max(80),
  razorpay_payment_id: z.string().min(1).max(80),
  razorpay_signature: z.string().min(1).max(200),
});
const refundSchema = z.object({ transactionId: z.string().min(1).max(40), amountMinor: z.number().int().positive().optional() });

export async function startPlanCheckoutAction(
  input: unknown,
): Promise<ActionResult<{ transactionId: string; providerOrderId: string; publicKey: string; amount: number; currency: string; planName: string; reference: string }>> {
  const provider = getPaymentProvider();
  if (!provider) return fail(PAYMENTS_OFF);

  let ctx;
  try {
    ctx = await assertBrandOwner();
  } catch (err) {
    return fail(safeErrorMessage(err));
  }
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) return fail("Choose a plan to continue.");

  // Checkout creation is cheap for us and expensive for the provider: cap it.
  const limit = await rateLimit(`checkout:${ctx.user.id}`, 10, 60 * 60 * 1000);
  if (!limit.ok) {
    securityEvent("RATE_LIMITED", { scope: "checkout" });
    return fail("Too many payment attempts. Please wait a few minutes and try again.");
  }

  try {
    const { transaction, plan, providerOrderId, publicKey } = await startPlanCheckout(provider, {
      userId: ctx.user.id,
      brandId: ctx.brand.id,
      brandName: ctx.brand.name,
      planKey: parsed.data.planKey,
    });
    revalidatePath("/dashboard/brand/billing");
    return ok({
      transactionId: transaction.id,
      providerOrderId,
      publicKey,
      amount: transaction.amount,
      currency: transaction.currency,
      planName: plan.name,
      reference: transaction.reference,
    });
  } catch (err) {
    if (err instanceof PaymentError) return fail(err.message);
    console.error("[payments] checkout failed", err instanceof Error ? err.message : err);
    return fail("Could not start the payment. Please try again.");
  }
}

/** Post-checkout callback. Advisory only: the server verifies and re-reads the provider. */
export async function verifyPaymentAction(input: unknown): Promise<ActionResult<{ status: string }>> {
  const provider = getPaymentProvider();
  if (!provider) return fail(PAYMENTS_OFF);
  let user;
  try {
    user = (await assertBrandOwner()).user;
  } catch (err) {
    return fail(safeErrorMessage(err));
  }
  const parsed = verifySchema.safeParse(input);
  if (!parsed.success) return fail("Invalid payment response.");

  try {
    const row = await verifyCheckout(provider, {
      transactionId: parsed.data.transactionId,
      userId: user.id,
      providerOrderId: parsed.data.razorpay_order_id,
      providerPaymentId: parsed.data.razorpay_payment_id,
      signature: parsed.data.razorpay_signature,
    });
    revalidatePath("/dashboard/brand", "layout");
    return ok({ status: row.status });
  } catch (err) {
    if (err instanceof PaymentError) return fail(err.message);
    console.error("[payments] verify failed", err instanceof Error ? err.message : err);
    return fail("We could not confirm this payment yet. Open the payment page to check its status.");
  }
}

/** "Check again" on the status page — re-reads the provider, never trusts the client. */
export async function refreshPaymentAction(input: unknown): Promise<ActionResult<{ status: string }>> {
  const provider = getPaymentProvider();
  if (!provider) return fail(PAYMENTS_OFF);
  let user;
  try {
    user = (await assertBrandOwner()).user;
  } catch (err) {
    return fail(safeErrorMessage(err));
  }
  const parsed = z.object({ transactionId: z.string().min(1).max(40) }).safeParse(input);
  if (!parsed.success) return fail("Invalid request.");
  const limit = await rateLimit(`payment-refresh:${await clientIp()}`, 30, 10 * 60 * 1000);
  if (!limit.ok) return fail("Please wait a moment before checking again.");

  try {
    const row = await refreshPaymentStatus(provider, parsed.data.transactionId, user.id);
    revalidatePath("/dashboard/brand", "layout");
    return ok({ status: row.status });
  } catch (err) {
    if (err instanceof PaymentError) return fail(err.message);
    console.error("[payments] refresh failed", err instanceof Error ? err.message : err);
    return fail("Could not check the payment right now. Please try again shortly.");
  }
}

/** The payer closed the provider's checkout without paying. */
export async function cancelPaymentAction(input: unknown): Promise<ActionResult<{ status: string }>> {
  let user;
  try {
    user = (await assertBrandOwner()).user;
  } catch (err) {
    return fail(safeErrorMessage(err));
  }
  const parsed = z.object({ transactionId: z.string().min(1).max(40) }).safeParse(input);
  if (!parsed.success) return fail("Invalid request.");
  const row = await markCheckoutCancelled(parsed.data.transactionId, user.id);
  revalidatePath("/dashboard/brand/billing");
  return ok({ status: row?.status ?? "CANCELLED" });
}

/** Admin-only refund. Only a provider-confirmed refund changes the transaction. */
export async function refundPaymentAction(input: unknown): Promise<ActionResult<{ state: string }>> {
  const provider = getPaymentProvider();
  if (!provider) return fail(PAYMENTS_OFF);
  let admin;
  try {
    admin = await assertRole("ADMIN");
  } catch (err) {
    return fail(safeErrorMessage(err));
  }
  const parsed = refundSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid refund request.");

  try {
    const result = await refundPayment(provider, { transactionId: parsed.data.transactionId, adminId: admin.id, amount: parsed.data.amountMinor });
    revalidatePath("/dashboard/admin/payments");
    return ok({ state: result.state });
  } catch (err) {
    if (err instanceof PaymentError) return fail(err.message);
    console.error("[payments] refund failed", err instanceof Error ? err.message : err);
    return fail("The refund could not be started. Nothing has changed.");
  }
}
