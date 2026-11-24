"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { assertBrandOwner, assertCreator } from "@/lib/auth/guards";
import {
  applyToBrief,
  cancelUgcCollaboration,
  confirmUgcPayment,
  createBrief,
  decideUgcApplication,
  markUgcPaid,
  reviewUgcSubmission,
  submitUgcContent,
  transitionBrief,
  UgcError,
  updateBrief,
  withdrawUgcApplication,
  type BriefAction,
} from "@/lib/services/ugc";
import { ugcApplySchema, ugcBriefSchema, ugcNoteSchema, ugcPaymentSchema, ugcReviewSchema, ugcSubmissionSchema } from "@/lib/validation/ugc";
import { fail, firstError, formValues, ok, safeErrorMessage, zodFieldErrors, type ActionResult } from "@/lib/utils/action-result";
import { rateLimit } from "@/lib/utils/rate-limit";

const id = z.string().trim().min(1).max(64);

/** FormData → object, collecting repeated keys into arrays. */
function formObject(formData: FormData, arrays: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of formData.entries()) {
    if (typeof v !== "string" || k.startsWith("$")) continue;
    if (arrays.includes(k)) {
      const list = out[k] as string[] | undefined;
      if (list) list.push(v);
      else out[k] = [v];
    } else out[k] = v;
  }
  return out;
}

function handle(err: unknown, label: string): ActionResult<never> {
  if (err instanceof UgcError) return fail(err.message);
  console.error(`[ugc:${label}] failed`, err instanceof Error ? err.message : err);
  return fail("Something went wrong. Please try again.");
}

function revalidateBrief(briefId?: string) {
  revalidatePath("/dashboard/brand/ugc");
  revalidatePath("/dashboard/creator/ugc");
  revalidatePath("/dashboard/brand/partners");
  if (briefId) {
    revalidatePath(`/dashboard/brand/ugc/${briefId}`);
    revalidatePath(`/dashboard/creator/ugc/${briefId}`);
  }
}

// ---------------------------------------------------------------------------
// Brand
// ---------------------------------------------------------------------------

export async function saveBriefAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  let ctx;
  try {
    ctx = await assertBrandOwner();
  } catch (err) {
    return fail(safeErrorMessage(err));
  }
  const parsed = ugcBriefSchema.safeParse(formObject(formData, ["contentTypes"]));
  if (!parsed.success) {
    const fieldErrors = zodFieldErrors(parsed.error);
    return fail(firstError(fieldErrors), fieldErrors, formValues(formData));
  }
  const briefId = formData.get("briefId");
  let savedId: string;
  try {
    const brief =
      typeof briefId === "string" && briefId
        ? await updateBrief(ctx.brand.id, ctx.user.id, briefId, parsed.data)
        : await createBrief(ctx.brand.id, ctx.user.id, parsed.data);
    savedId = brief.id;
  } catch (err) {
    const res = handle(err, "saveBrief");
    return res.ok ? res : { ...res, values: formValues(formData) };
  }
  revalidateBrief(savedId);
  redirect(`/dashboard/brand/ugc/${savedId}`);
}

export async function briefStatusAction(input: { briefId: string; action: BriefAction }): Promise<ActionResult> {
  let ctx;
  try {
    ctx = await assertBrandOwner();
  } catch (err) {
    return fail(safeErrorMessage(err));
  }
  const parsed = z.object({ briefId: id, action: z.enum(["PUBLISH", "CLOSE", "REOPEN", "ARCHIVE"]) }).safeParse(input);
  if (!parsed.success) return fail("Invalid request.");
  try {
    await transitionBrief(ctx.brand.id, ctx.user.id, parsed.data.briefId, parsed.data.action);
    revalidateBrief(parsed.data.briefId);
    return ok(undefined);
  } catch (err) {
    return handle(err, "briefStatus");
  }
}

export async function decideUgcApplicationAction(input: { collabId: string; decision: "ACCEPT" | "DECLINE"; note?: string }): Promise<ActionResult> {
  let ctx;
  try {
    ctx = await assertBrandOwner();
  } catch (err) {
    return fail(safeErrorMessage(err));
  }
  const parsed = z.object({ collabId: id, decision: z.enum(["ACCEPT", "DECLINE"]) }).and(ugcNoteSchema).safeParse(input);
  if (!parsed.success) return fail("Invalid request.");
  try {
    const collab = await decideUgcApplication(ctx.brand.id, ctx.user.id, parsed.data.collabId, parsed.data.decision, parsed.data.note);
    revalidateBrief(collab.briefId);
    return ok(undefined);
  } catch (err) {
    return handle(err, "decide");
  }
}

export async function cancelUgcCollaborationAction(input: { collabId: string; note?: string }): Promise<ActionResult> {
  let ctx;
  try {
    ctx = await assertBrandOwner();
  } catch (err) {
    return fail(safeErrorMessage(err));
  }
  const parsed = z.object({ collabId: id }).and(ugcNoteSchema).safeParse(input);
  if (!parsed.success) return fail("Invalid request.");
  try {
    const collab = await cancelUgcCollaboration(ctx.brand.id, ctx.user.id, parsed.data.collabId, parsed.data.note);
    revalidateBrief(collab.briefId);
    return ok(undefined);
  } catch (err) {
    return handle(err, "cancel");
  }
}

export async function reviewUgcSubmissionAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  let ctx;
  try {
    ctx = await assertBrandOwner();
  } catch (err) {
    return fail(safeErrorMessage(err));
  }
  const collabId = id.safeParse(formData.get("collabId"));
  const parsed = ugcReviewSchema.safeParse(formObject(formData, []));
  if (!collabId.success) return fail("Invalid request.");
  if (!parsed.success) {
    const fieldErrors = zodFieldErrors(parsed.error);
    return fail(firstError(fieldErrors), fieldErrors, formValues(formData));
  }
  try {
    const collab = await reviewUgcSubmission(ctx.brand.id, ctx.user.id, collabId.data, parsed.data.decision, parsed.data.feedback);
    revalidateBrief(collab.briefId);
    return ok(undefined);
  } catch (err) {
    return handle(err, "review");
  }
}

export async function markUgcPaidAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  let ctx;
  try {
    ctx = await assertBrandOwner();
  } catch (err) {
    return fail(safeErrorMessage(err));
  }
  const collabId = id.safeParse(formData.get("collabId"));
  const parsed = ugcPaymentSchema.safeParse(formObject(formData, []));
  if (!collabId.success || !parsed.success) return fail("Check the payment reference.");
  try {
    const collab = await markUgcPaid(ctx.brand.id, ctx.user.id, collabId.data, parsed.data.reference);
    revalidateBrief(collab.briefId);
    return ok(undefined);
  } catch (err) {
    return handle(err, "markPaid");
  }
}

// ---------------------------------------------------------------------------
// Creator
// ---------------------------------------------------------------------------

export async function applyToBriefAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  let user;
  try {
    user = await assertCreator();
  } catch (err) {
    return fail(safeErrorMessage(err));
  }
  const briefId = id.safeParse(formData.get("briefId"));
  const parsed = ugcApplySchema.safeParse(formObject(formData, []));
  if (!briefId.success) return fail("Invalid request.");
  if (!parsed.success) {
    const fieldErrors = zodFieldErrors(parsed.error);
    return fail(firstError(fieldErrors), fieldErrors, formValues(formData));
  }
  const limit = await rateLimit(`ugc-apply:${user.id}`, 30, 60 * 60 * 1000);
  if (!limit.ok) return fail("You have sent many applications in the last hour. Please try again later.", undefined, formValues(formData));
  try {
    await applyToBrief(user.id, briefId.data, parsed.data);
    revalidateBrief(briefId.data);
    return ok(undefined);
  } catch (err) {
    const res = handle(err, "apply");
    return res.ok ? res : { ...res, values: formValues(formData) };
  }
}

export async function withdrawUgcApplicationAction(collabId: string): Promise<ActionResult> {
  let user;
  try {
    user = await assertCreator();
  } catch (err) {
    return fail(safeErrorMessage(err));
  }
  const parsed = id.safeParse(collabId);
  if (!parsed.success) return fail("Invalid request.");
  try {
    const collab = await withdrawUgcApplication(user.id, parsed.data);
    revalidateBrief(collab.briefId);
    return ok(undefined);
  } catch (err) {
    return handle(err, "withdraw");
  }
}

export async function submitUgcContentAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  let user;
  try {
    user = await assertCreator();
  } catch (err) {
    return fail(safeErrorMessage(err));
  }
  const collabId = id.safeParse(formData.get("collabId"));
  const parsed = ugcSubmissionSchema.safeParse(formObject(formData, ["imageUrls"]));
  if (!collabId.success) return fail("Invalid request.");
  if (!parsed.success) {
    const fieldErrors = zodFieldErrors(parsed.error);
    return fail(firstError(fieldErrors), fieldErrors, formValues(formData));
  }
  try {
    await submitUgcContent(user.id, collabId.data, parsed.data);
    revalidatePath("/dashboard/creator/ugc", "layout");
    revalidatePath("/dashboard/brand/ugc", "layout");
    return ok(undefined);
  } catch (err) {
    return handle(err, "submit");
  }
}

export async function confirmUgcPaymentAction(collabId: string): Promise<ActionResult> {
  let user;
  try {
    user = await assertCreator();
  } catch (err) {
    return fail(safeErrorMessage(err));
  }
  const parsed = id.safeParse(collabId);
  if (!parsed.success) return fail("Invalid request.");
  try {
    const collab = await confirmUgcPayment(user.id, parsed.data);
    revalidateBrief(collab.briefId);
    return ok(undefined);
  } catch (err) {
    return handle(err, "confirmPayment");
  }
}
