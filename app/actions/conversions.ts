"use server";

import { revalidatePath } from "next/cache";
import { assertBrandOwner } from "@/lib/auth/guards";
import { rupeesToPaise } from "@/lib/money";
import { ConversionError, reverseConversion, recordOrder, rejectConversion, verifyConversion } from "@/lib/services/conversions";
import { conversionDecisionSchema, conversionReversalSchema, recordOrderSchema } from "@/lib/validation/conversion";
import { fail, firstError, formValues, ok, safeErrorMessage, zodFieldErrors, type ActionResult } from "@/lib/utils/action-result";

function revalidate() {
  revalidatePath("/dashboard/brand", "layout");
  revalidatePath("/dashboard/creator", "layout");
  revalidatePath("/dashboard/customer", "layout");
}

export async function recordOrderAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  let ctx;
  try {
    ctx = await assertBrandOwner();
  } catch (err) {
    return fail(safeErrorMessage(err));
  }

  const parsed = recordOrderSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors = zodFieldErrors(parsed.error);
    return fail(firstError(fieldErrors), fieldErrors, formValues(formData));
  }

  try {
    await recordOrder(ctx.brand.id, ctx.user.id, {
      code: parsed.data.code,
      orderReference: parsed.data.orderReference,
      amountMinor: rupeesToPaise(parsed.data.amount),
      quantity: parsed.data.quantity,
      source: parsed.data.source,
      customerContact: parsed.data.customerContact || null,
      note: parsed.data.note || null,
    });
    revalidate();
    return ok(undefined);
  } catch (err) {
    if (err instanceof ConversionError) return fail(err.message, undefined, formValues(formData));
    console.error("[recordOrder] failed", err instanceof Error ? err.message : err);
    return fail("Could not record the order. Please try again.");
  }
}

export async function conversionDecisionAction(input: unknown): Promise<ActionResult> {
  let ctx;
  try {
    ctx = await assertBrandOwner();
  } catch (err) {
    return fail(safeErrorMessage(err));
  }
  const parsed = conversionDecisionSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid request.");

  try {
    if (parsed.data.decision === "VERIFY") await verifyConversion(ctx.brand.id, ctx.user.id, parsed.data.referralId);
    else await rejectConversion(ctx.brand.id, ctx.user.id, parsed.data.referralId, parsed.data.reason);
    revalidate();
    return ok(undefined);
  } catch (err) {
    if (err instanceof ConversionError) return fail(err.message);
    console.error("[conversionDecision] failed", err instanceof Error ? err.message : err);
    return fail("Could not update the order.");
  }
}

/** Brand records a refund for a verified order: ledger entries are reversed. */
export async function conversionReversalAction(input: unknown): Promise<ActionResult> {
  let ctx;
  try {
    ctx = await assertBrandOwner();
  } catch (err) {
    return fail(safeErrorMessage(err));
  }
  const parsed = conversionReversalSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid request.");
  try {
    await reverseConversion(ctx.brand.id, ctx.user.id, parsed.data.referralId, parsed.data.reason);
    revalidatePath("/dashboard/brand", "layout");
    return ok(undefined);
  } catch (err) {
    if (err instanceof ConversionError) return fail(err.message);
    console.error("[conversionReversal] failed", err instanceof Error ? err.message : err);
    return fail("Could not record the refund.");
  }
}
