"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertBrandOwner } from "@/lib/auth/guards";
import { addPartnerNote, deletePartnerNote, PartnershipError } from "@/lib/services/partnerships";
import { partnerNoteSchema } from "@/lib/validation/ugc";
import { fail, firstError, formValues, ok, safeErrorMessage, zodFieldErrors, type ActionResult } from "@/lib/utils/action-result";

const id = z.string().trim().min(1).max(64);

/** A private note about a creator partner (brand-only; never shown to the creator). */
export async function addPartnerNoteAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  let ctx;
  try {
    ctx = await assertBrandOwner();
  } catch (err) {
    return fail(safeErrorMessage(err));
  }
  const creatorId = id.safeParse(formData.get("creatorId"));
  const parsed = partnerNoteSchema.safeParse({ body: formData.get("body") ?? "" });
  if (!creatorId.success) return fail("Invalid request.");
  if (!parsed.success) {
    const fieldErrors = zodFieldErrors(parsed.error);
    return fail(firstError(fieldErrors), fieldErrors, formValues(formData));
  }
  try {
    await addPartnerNote(ctx.brand.id, ctx.user.id, creatorId.data, parsed.data.body);
    revalidatePath(`/dashboard/brand/partners/${creatorId.data}`);
    return ok(undefined);
  } catch (err) {
    if (err instanceof PartnershipError) return fail(err.message);
    console.error("[partnerNote] failed", err instanceof Error ? err.message : err);
    return fail("Could not save the note.");
  }
}

export async function deletePartnerNoteAction(noteId: string, creatorId: string): Promise<ActionResult> {
  let ctx;
  try {
    ctx = await assertBrandOwner();
  } catch (err) {
    return fail(safeErrorMessage(err));
  }
  if (!id.safeParse(noteId).success || !id.safeParse(creatorId).success) return fail("Invalid request.");
  try {
    await deletePartnerNote(ctx.brand.id, ctx.user.id, noteId);
    revalidatePath(`/dashboard/brand/partners/${creatorId}`);
    return ok(undefined);
  } catch (err) {
    if (err instanceof PartnershipError) return fail(err.message);
    return fail("Could not delete the note.");
  }
}
