"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { assertBrandOwner, assertCreator, assertRole } from "@/lib/auth/guards";
import { addAffiliateCode, AffiliateLinkError, removeAffiliateLink, saveAffiliateLink } from "@/lib/services/affiliate-links";
import {
  adminCreateAffiliateProgram,
  adminDeleteAffiliateProgram,
  adminSetAffiliateProgramState,
  adminUpdateAffiliateProgram,
  AffiliateProgramError,
  createAffiliateProgram,
  reviewAffiliateProgram,
  setAffiliateProgramState,
  updateAffiliateProgram,
} from "@/lib/services/affiliate-programs";
import { adminAffiliateProgramSchema, affiliateCodeSchema, affiliateLinkSchema, affiliateProgramSchema } from "@/lib/validation/affiliate";
import { fail, firstError, formValues, ok, safeErrorMessage, zodFieldErrors, type ActionResult } from "@/lib/utils/action-result";
import { rateLimit } from "@/lib/utils/rate-limit";

/**
 * External affiliate programme actions. Every one resolves the caller's own side
 * from the session: a brand edits only its listings, a creator only their links,
 * and only an admin reviews.
 */
function revalidateAll() {
  revalidatePath("/affiliate-programs");
  revalidatePath("/dashboard/brand/affiliate-programs");
  revalidatePath("/dashboard/creator/affiliate-links");
  revalidatePath("/dashboard/admin/affiliate-programs");
}

/** Form fields arrive as strings; platforms arrive as repeated checkbox values. */
function programInput(formData: FormData) {
  const raw = Object.fromEntries(formData);
  return { ...raw, supportedPlatforms: formData.getAll("supportedPlatforms").map(String) };
}

// ─── brand ───────────────────────────────────────────────────────────────────

export async function saveAffiliateProgramAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  let ctx;
  try {
    ctx = await assertBrandOwner();
  } catch (err) {
    return fail(safeErrorMessage(err));
  }
  const parsed = affiliateProgramSchema.safeParse(programInput(formData));
  if (!parsed.success) {
    const fieldErrors = zodFieldErrors(parsed.error);
    return fail(firstError(fieldErrors), fieldErrors, formValues(formData));
  }
  const submit = formData.get("intent") === "submit";
  const id = String(formData.get("id") ?? "");

  try {
    if (id) await updateAffiliateProgram(ctx.brand.id, ctx.user.id, id, parsed.data, { submit });
    else await createAffiliateProgram(ctx.brand.id, ctx.user.id, parsed.data, { submit });
  } catch (err) {
    if (err instanceof AffiliateProgramError) return fail(err.message, undefined, formValues(formData));
    console.error("[affiliate] save program failed", err instanceof Error ? err.message : err);
    return fail("Could not save the listing. Please try again.", undefined, formValues(formData));
  }
  revalidateAll();
  redirect("/dashboard/brand/affiliate-programs");
}

export async function affiliateProgramStateAction(input: unknown): Promise<ActionResult> {
  let ctx;
  try {
    ctx = await assertBrandOwner();
  } catch (err) {
    return fail(safeErrorMessage(err));
  }
  const parsed = z.object({ id: z.string().min(1).max(40), action: z.enum(["PAUSE", "RESUME", "CLOSE"]) }).safeParse(input);
  if (!parsed.success) return fail("Invalid request.");
  try {
    await setAffiliateProgramState(ctx.brand.id, ctx.user.id, parsed.data.id, parsed.data.action);
    revalidateAll();
    return ok(undefined);
  } catch (err) {
    if (err instanceof AffiliateProgramError) return fail(err.message);
    return fail("Could not update the listing.");
  }
}

// ─── admin ───────────────────────────────────────────────────────────────────

export async function reviewAffiliateProgramAction(input: unknown): Promise<ActionResult> {
  let admin;
  try {
    admin = await assertRole("ADMIN");
  } catch (err) {
    return fail(safeErrorMessage(err));
  }
  const parsed = z
    .object({ id: z.string().min(1).max(40), decision: z.enum(["APPROVE", "REJECT", "PAUSE"]), note: z.string().trim().max(500).optional(), verified: z.boolean().optional() })
    .safeParse(input);
  if (!parsed.success) return fail("Invalid request.");
  try {
    await reviewAffiliateProgram(admin.id, parsed.data.id, parsed.data);
    revalidateAll();
    return ok(undefined);
  } catch (err) {
    if (err instanceof AffiliateProgramError) return fail(err.message);
    return fail("Could not record the decision.");
  }
}

/**
 * Admin adds or edits a listing — including one for a brand that has no Refnivo
 * account yet. New listings land in the review queue; nothing publishes here.
 */
export async function adminSaveAffiliateProgramAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  let admin;
  try {
    admin = await assertRole("ADMIN");
  } catch (err) {
    return fail(safeErrorMessage(err));
  }
  const parsed = adminAffiliateProgramSchema.safeParse(programInput(formData));
  if (!parsed.success) {
    const fieldErrors = zodFieldErrors(parsed.error);
    return fail(firstError(fieldErrors), fieldErrors, formValues(formData));
  }
  const id = String(formData.get("id") ?? "");
  try {
    if (id) await adminUpdateAffiliateProgram(admin.id, id, parsed.data);
    else await adminCreateAffiliateProgram(admin.id, parsed.data);
  } catch (err) {
    if (err instanceof AffiliateProgramError) return fail(err.message, undefined, formValues(formData));
    console.error("[affiliate] admin save program failed", err instanceof Error ? err.message : err);
    return fail("Could not save the listing. Please try again.", undefined, formValues(formData));
  }
  revalidateAll();
  redirect(`/dashboard/admin/affiliate-programs?status=${id ? "ALL" : "PENDING_REVIEW"}`);
}

export async function adminAffiliateProgramStateAction(input: unknown): Promise<ActionResult> {
  let admin;
  try {
    admin = await assertRole("ADMIN");
  } catch (err) {
    return fail(safeErrorMessage(err));
  }
  const parsed = z.object({ id: z.string().min(1).max(40), action: z.enum(["CLOSE", "REOPEN", "DELETE"]) }).safeParse(input);
  if (!parsed.success) return fail("Invalid request.");
  try {
    if (parsed.data.action === "DELETE") await adminDeleteAffiliateProgram(admin.id, parsed.data.id);
    else await adminSetAffiliateProgramState(admin.id, parsed.data.id, parsed.data.action);
    revalidateAll();
    return ok(undefined);
  } catch (err) {
    if (err instanceof AffiliateProgramError) return fail(err.message);
    return fail("Could not update the listing.");
  }
}

// ─── creator ─────────────────────────────────────────────────────────────────

export async function saveAffiliateLinkAction(_prev: ActionResult<{ code: string }> | null, formData: FormData): Promise<ActionResult<{ code: string }>> {
  let user;
  try {
    user = await assertCreator();
  } catch (err) {
    return fail(safeErrorMessage(err));
  }
  const parsed = affiliateLinkSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors = zodFieldErrors(parsed.error);
    return fail(firstError(fieldErrors), fieldErrors, formValues(formData));
  }
  const limit = await rateLimit(`affiliate-link:${user.id}`, 40, 60 * 60 * 1000);
  if (!limit.ok) return fail("That is a lot of links at once. Please try again shortly.");

  try {
    const link = await saveAffiliateLink({ creatorId: user.id, ...parsed.data });
    revalidateAll();
    return ok({ code: link.codes[0]?.code ?? "" });
  } catch (err) {
    if (err instanceof AffiliateLinkError) return fail(err.message, undefined, formValues(formData));
    console.error("[affiliate] save link failed", err instanceof Error ? err.message : err);
    return fail("Could not save your link. Please try again.", undefined, formValues(formData));
  }
}

export async function addAffiliateCodeAction(input: unknown): Promise<ActionResult<{ code: string }>> {
  let user;
  try {
    user = await assertCreator();
  } catch (err) {
    return fail(safeErrorMessage(err));
  }
  const parsed = affiliateCodeSchema.safeParse(input);
  if (!parsed.success) return fail("Choose a platform.");
  try {
    const code = await addAffiliateCode({ creatorId: user.id, linkId: parsed.data.linkId, source: parsed.data.source });
    revalidatePath("/dashboard/creator/affiliate-links");
    return ok({ code: code.code });
  } catch (err) {
    if (err instanceof AffiliateLinkError) return fail(err.message);
    return fail("Could not create the link.");
  }
}

export async function removeAffiliateLinkAction(input: unknown): Promise<ActionResult> {
  let user;
  try {
    user = await assertCreator();
  } catch (err) {
    return fail(safeErrorMessage(err));
  }
  const parsed = z.object({ linkId: z.string().min(1).max(40) }).safeParse(input);
  if (!parsed.success) return fail("Invalid request.");
  try {
    await removeAffiliateLink(user.id, parsed.data.linkId);
    revalidatePath("/dashboard/creator/affiliate-links");
    return ok(undefined);
  } catch (err) {
    if (err instanceof AffiliateLinkError) return fail(err.message);
    return fail("Could not remove the link.");
  }
}
