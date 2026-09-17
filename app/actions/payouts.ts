"use server";

import { revalidatePath } from "next/cache";
import { assertUser } from "@/lib/auth/guards";
import { PayoutError, requestPayout } from "@/lib/services/payouts";
import { payoutRequestSchema } from "@/lib/validation/admin";
import { fail, ok, safeErrorMessage, type ActionResult } from "@/lib/utils/action-result";

/**
 * Creator (commissions) or customer (rewards) asks for manual settlement of
 * their eligible balance. Creates a REQUESTED payout for admin review — nothing
 * is marked paid here.
 */
export async function requestPayoutAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  let user;
  try {
    user = await assertUser();
  } catch (err) {
    return fail(safeErrorMessage(err));
  }
  const parsed = payoutRequestSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid request.");

  // Role ↔ kind must match: creators settle commissions, customers settle rewards.
  if (parsed.data.kind === "COMMISSION" && user.role !== "CREATOR") return fail("Only creators can request commission payouts.");
  if (parsed.data.kind === "REWARD" && user.role !== "CUSTOMER") return fail("Only customers can redeem rewards.");

  try {
    const request = await requestPayout(user.id, parsed.data.kind, parsed.data.method);
    revalidatePath("/dashboard/creator/earnings");
    revalidatePath("/dashboard/customer/rewards");
    revalidatePath("/dashboard/admin/payouts");
    return ok({ id: request.id });
  } catch (err) {
    if (err instanceof PayoutError) return fail(err.message);
    console.error("[requestPayout] failed", err instanceof Error ? err.message : err);
    return fail("Could not submit the request. Please try again.");
  }
}
