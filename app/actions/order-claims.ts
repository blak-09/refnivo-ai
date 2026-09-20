"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { assertBrandOwner, getCurrentUser } from "@/lib/auth/guards";
import { rupeesToPaise } from "@/lib/money";
import { ConversionError } from "@/lib/services/conversions";
import { confirmOrderClaim, OrderClaimError, rejectOrderClaim, submitOrderClaim } from "@/lib/services/order-claims";
import { ATTRIBUTION_COOKIE, type Attribution } from "@/lib/services/tracking";
import { orderClaimDecisionSchema, orderClaimSchema } from "@/lib/validation/conversion";
import { fail, firstError, formValues, ok, safeErrorMessage, zodFieldErrors, type ActionResult } from "@/lib/utils/action-result";
import { clientIp, rateLimit } from "@/lib/utils/rate-limit";
import { hashValue } from "@/lib/services/tracking";
import { securityEvent } from "@/lib/utils/security-log";

function readAttribution(raw: string | undefined): Attribution | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<Attribution>;
    if (typeof parsed.code === "string" && typeof parsed.campaignId === "string" && typeof parsed.at === "number") return parsed as Attribution;
  } catch {
    // malformed cookie — treat as absent
  }
  return null;
}

/** Public: a customer submits their order number for a campaign (no account needed). */
export async function submitOrderClaimAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = orderClaimSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors = zodFieldErrors(parsed.error);
    return fail(firstError(fieldErrors), fieldErrors, formValues(formData));
  }
  if (parsed.data.website) {
    // Honeypot filled: pretend success so bots learn nothing.
    securityEvent("ORDER_CLAIM_HONEYPOT", { campaignId: parsed.data.campaignId });
    return ok(undefined);
  }

  const ip = await clientIp();
  const perIp = await rateLimit(`claim:${ip}`, 10, 60 * 60 * 1000);
  const perContact = await rateLimit(`claim-contact:${hashValue(parsed.data.contact)}`, 10, 24 * 60 * 60 * 1000);
  const blocked = [perIp, perContact].find((r) => !r.ok);
  if (blocked && !blocked.ok) {
    securityEvent("RATE_LIMITED", { scope: "order-claim" });
    return fail(`Too many submissions. Please try again in ${Math.max(1, Math.ceil(blocked.retryAfterSeconds / 60))} minutes.`, undefined, formValues(formData));
  }

  const [user, jar] = await Promise.all([getCurrentUser(), cookies()]);
  try {
    await submitOrderClaim({
      campaignId: parsed.data.campaignId,
      code: parsed.data.code,
      orderReference: parsed.data.orderReference,
      contact: parsed.data.contact,
      note: parsed.data.note || null,
      customerId: user?.id ?? null,
      attribution: readAttribution(jar.get(ATTRIBUTION_COOKIE)?.value),
      ip,
    });
    revalidatePath("/dashboard/brand", "layout");
    revalidatePath("/dashboard/customer", "layout");
    return ok(undefined);
  } catch (err) {
    if (err instanceof OrderClaimError) return fail(err.message, undefined, formValues(formData));
    console.error("[submitOrderClaim] failed", err instanceof Error ? err.message : err);
    return fail("Could not submit your order right now. Please try again.");
  }
}

/** Brand: confirm (record + verify) or reject a customer's order claim. */
export async function orderClaimDecisionAction(input: unknown): Promise<ActionResult> {
  let ctx;
  try {
    ctx = await assertBrandOwner();
  } catch (err) {
    return fail(safeErrorMessage(err));
  }
  const parsed = orderClaimDecisionSchema.safeParse(input);
  if (!parsed.success) return fail(firstError(zodFieldErrors(parsed.error)) || "Invalid request.");

  try {
    if (parsed.data.decision === "CONFIRM") {
      await confirmOrderClaim(ctx.brand.id, ctx.user.id, parsed.data.claimId, { amountMinor: rupeesToPaise(parsed.data.amount), quantity: parsed.data.quantity });
    } else {
      await rejectOrderClaim(ctx.brand.id, ctx.user.id, parsed.data.claimId, parsed.data.reason);
    }
    revalidatePath("/dashboard/brand", "layout");
    revalidatePath("/dashboard/creator", "layout");
    revalidatePath("/dashboard/customer", "layout");
    return ok(undefined);
  } catch (err) {
    if (err instanceof OrderClaimError || err instanceof ConversionError) return fail(err.message);
    console.error("[orderClaimDecision] failed", err instanceof Error ? err.message : err);
    return fail("Could not update the claim. Please try again.");
  }
}
