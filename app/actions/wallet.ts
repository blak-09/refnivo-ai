"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertBrandOwner, assertRole } from "@/lib/auth/guards";
import { getPaymentProvider } from "@/lib/payments";
import { PaymentError, startWalletTopup } from "@/lib/services/payments";
import { adminAdjustWallet, walletEnabled, WalletError } from "@/lib/services/wallet";
import { fail, ok, safeErrorMessage, type ActionResult } from "@/lib/utils/action-result";
import { rateLimit } from "@/lib/utils/rate-limit";
import { securityEvent } from "@/lib/utils/security-log";

/**
 * Brand wallet: online top-ups (Razorpay checkout) and admin adjustments.
 * The wallet is credited only when the provider confirms the payment
 * (lib/services/payments.ts → grantTopup), never from this action.
 */
const topupSchema = z.object({ amountMinor: z.number().int().positive() });
const adjustSchema = z.object({
  brandId: z.string().min(1).max(40),
  amountMinor: z.number().int().refine((n) => n !== 0, "Enter a non-zero amount."),
  note: z.string().trim().min(3, "Give a reason for the adjustment.").max(300),
  requestKey: z.string().min(8).max(64),
});

export async function startWalletTopupAction(
  input: unknown,
): Promise<ActionResult<{ transactionId: string; providerOrderId: string; publicKey: string; amount: number; currency: string; planName: string; reference: string }>> {
  if (!walletEnabled()) return fail("The brand wallet is not switched on.");
  const provider = getPaymentProvider();
  if (!provider) return fail("Online payments are not enabled on this deployment.");

  let ctx;
  try {
    ctx = await assertBrandOwner();
  } catch (err) {
    return fail(safeErrorMessage(err));
  }
  const parsed = topupSchema.safeParse(input);
  if (!parsed.success) return fail("Enter an amount to add.");

  const limit = await rateLimit(`checkout:${ctx.user.id}`, 10, 60 * 60 * 1000);
  if (!limit.ok) {
    securityEvent("RATE_LIMITED", { scope: "checkout" });
    return fail("Too many payment attempts. Please wait a few minutes and try again.");
  }

  try {
    const { transaction, providerOrderId, publicKey } = await startWalletTopup(provider, {
      userId: ctx.user.id,
      brandId: ctx.brand.id,
      brandName: ctx.brand.name,
      amountMinor: parsed.data.amountMinor,
    });
    revalidatePath("/dashboard/brand/wallet");
    return ok({
      transactionId: transaction.id,
      providerOrderId,
      publicKey,
      amount: transaction.amount,
      currency: transaction.currency,
      planName: "Wallet top-up",
      reference: transaction.reference,
    });
  } catch (err) {
    if (err instanceof PaymentError) return fail(err.message);
    console.error("[wallet] top-up failed", err instanceof Error ? err.message : err);
    return fail("Could not start the payment. Please try again.");
  }
}

/** Admin credit (+) or debit (−) with a reason — e.g. a bank transfer received offline. */
export async function adminAdjustWalletAction(input: unknown): Promise<ActionResult<{ balance: number }>> {
  let admin;
  try {
    admin = await assertRole("ADMIN");
  } catch (err) {
    return fail(safeErrorMessage(err));
  }
  const parsed = adjustSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the adjustment.");
  try {
    const result = await adminAdjustWallet(admin.id, parsed.data.brandId, parsed.data.amountMinor, parsed.data.note, parsed.data.requestKey);
    revalidatePath("/dashboard/admin/wallets");
    revalidatePath("/dashboard/brand/wallet");
    return ok({ balance: result.balance });
  } catch (err) {
    if (err instanceof WalletError) return fail(err.message);
    console.error("[wallet] adjust failed", err instanceof Error ? err.message : err);
    return fail("Could not adjust the wallet.");
  }
}
