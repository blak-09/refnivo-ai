"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertRole, assertUser } from "@/lib/auth/guards";
import { refreshAutoPayout, startAutoPayout } from "@/lib/services/auto-payouts";
import { addPayoutAccount, PayoutAccountError, removePayoutAccount, revealPayoutAccount, setDefaultPayoutAccount } from "@/lib/services/payout-accounts";
import { PayoutError } from "@/lib/services/payouts";
import { fail, ok, safeErrorMessage, type ActionResult } from "@/lib/utils/action-result";
import { rateLimit } from "@/lib/utils/rate-limit";
import { securityEvent } from "@/lib/utils/security-log";

/**
 * Saved payout accounts (creators and customers) and the admin side of paying
 * into them. Pages only ever get masked labels back; the one action that
 * returns full details is the audited admin reveal.
 */
const idSchema = z.object({ accountId: z.string().min(1).max(40) });
const payoutIdSchema = z.object({ payoutId: z.string().min(1).max(40) });

async function partner() {
  const user = await assertUser();
  if (user.role !== "CREATOR" && user.role !== "CUSTOMER") throw new PayoutAccountError("Only creators and customers have payout accounts.");
  return user;
}

function revalidatePartner() {
  revalidatePath("/dashboard/creator/earnings");
  revalidatePath("/dashboard/customer/rewards");
}

function failFrom(err: unknown, label: string) {
  if (err instanceof PayoutAccountError || err instanceof PayoutError) return fail(err.message);
  console.error(`[payout-accounts] ${label} failed`, err instanceof Error ? err.message : err);
  return fail(safeErrorMessage(err));
}

export async function addPayoutAccountAction(input: unknown): Promise<ActionResult<{ id: string; label: string }>> {
  try {
    const user = await partner();
    const limit = await rateLimit(`payout-account:${user.id}`, 20, 60 * 60 * 1000);
    if (!limit.ok) {
      securityEvent("RATE_LIMITED", { scope: "payout-account" });
      return fail("Too many attempts. Please try again later.");
    }
    const account = await addPayoutAccount(user.id, input);
    revalidatePartner();
    return ok({ id: account.id, label: account.maskedLabel });
  } catch (err) {
    return failFrom(err, "add");
  }
}

export async function setDefaultPayoutAccountAction(input: unknown): Promise<ActionResult<null>> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid request.");
  try {
    const user = await partner();
    await setDefaultPayoutAccount(user.id, parsed.data.accountId);
    revalidatePartner();
    return ok(null);
  } catch (err) {
    return failFrom(err, "set default");
  }
}

export async function removePayoutAccountAction(input: unknown): Promise<ActionResult<null>> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid request.");
  try {
    const user = await partner();
    await removePayoutAccount(user.id, parsed.data.accountId);
    revalidatePartner();
    return ok(null);
  } catch (err) {
    return failFrom(err, "remove");
  }
}

/** Admin: full UPI ID / bank details to pay by hand. Every reveal is audited. */
export async function revealPayoutAccountAction(input: unknown): Promise<ActionResult<{ type: string; holderName: string; vpa?: string; accountNumber?: string; ifsc?: string }>> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid request.");
  try {
    const admin = await assertRole("ADMIN");
    return ok(await revealPayoutAccount(admin.id, parsed.data.accountId));
  } catch (err) {
    return failFrom(err, "reveal");
  }
}

/** Admin: send an approved payout through RazorpayX (or safely retry an unknown attempt). */
export async function startAutoPayoutAction(input: unknown): Promise<ActionResult<{ status: string | null }>> {
  const parsed = payoutIdSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid request.");
  try {
    const admin = await assertRole("ADMIN");
    const result = await startAutoPayout(admin.id, parsed.data.payoutId);
    revalidatePath("/dashboard/admin/payouts");
    return ok({ status: result.status });
  } catch (err) {
    revalidatePath("/dashboard/admin/payouts");
    return failFrom(err, "auto payout");
  }
}

export async function refreshAutoPayoutAction(input: unknown): Promise<ActionResult<{ status: string | null }>> {
  const parsed = payoutIdSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid request.");
  try {
    const admin = await assertRole("ADMIN");
    const result = await refreshAutoPayout(admin.id, parsed.data.payoutId);
    revalidatePath("/dashboard/admin/payouts");
    return ok({ status: result.status });
  } catch (err) {
    revalidatePath("/dashboard/admin/payouts");
    return failFrom(err, "refresh payout");
  }
}
