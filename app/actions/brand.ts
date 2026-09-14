"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertRole, assertBrandOwner } from "@/lib/auth/guards";
import { createBrand, getBrandForOwner, updateBrand } from "@/lib/services/brands";
import { brandSchema } from "@/lib/validation/brand";
import { fail, firstError, formValues, ok, safeErrorMessage, zodFieldErrors, type ActionResult } from "@/lib/utils/action-result";

export async function createBrandAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  let user;
  try {
    user = await assertRole("BRAND_OWNER");
  } catch (err) {
    return fail(safeErrorMessage(err));
  }

  const parsed = brandSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors = zodFieldErrors(parsed.error);
    return fail(firstError(fieldErrors), fieldErrors, formValues(formData));
  }

  // v1: one brand per owner. Re-submitting onboarding just goes to the dashboard.
  const existing = await getBrandForOwner(user.id);
  if (existing) redirect("/dashboard/brand");

  try {
    await createBrand(user.id, parsed.data);
  } catch (err) {
    console.error("[createBrand] failed", err instanceof Error ? err.message : err);
    return fail("Could not create the brand. Please try again.");
  }
  redirect("/dashboard/brand?welcome=1");
}

export async function updateBrandAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  let ctx;
  try {
    ctx = await assertBrandOwner();
  } catch (err) {
    return fail(safeErrorMessage(err));
  }

  const parsed = brandSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors = zodFieldErrors(parsed.error);
    return fail(firstError(fieldErrors), fieldErrors, formValues(formData));
  }

  try {
    const updated = await updateBrand(ctx.brand.id, ctx.user.id, parsed.data);
    if (!updated) return fail("Brand not found.");
  } catch (err) {
    console.error("[updateBrand] failed", err instanceof Error ? err.message : err);
    return fail("Could not save changes. Please try again.");
  }
  revalidatePath("/dashboard/brand", "layout");
  revalidatePath("/brands");
  return ok(undefined);
}
