"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { LANDING_CACHE_TAG } from "@/lib/services/landing";
import { redirect } from "next/navigation";
import { assertPartner, assertRole } from "@/lib/auth/guards";
import { CreatorError, getCreatorProfile, upsertCreatorProfile } from "@/lib/services/creators";
import { joinCampaign, PartnerError, withdrawApplication, type JoinResult } from "@/lib/services/partners";
import { applyToCampaignSchema, creatorProfileSchema } from "@/lib/validation/creator";
import { withdrawApplicationSchema } from "@/lib/validation/partner";
import { fail, firstError, formValues, ok, safeErrorMessage, zodFieldErrors, type ActionResult } from "@/lib/utils/action-result";

export async function saveCreatorProfileAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  let user;
  try {
    user = await assertRole("CREATOR");
  } catch (err) {
    return fail(safeErrorMessage(err));
  }

  const parsed = creatorProfileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors = zodFieldErrors(parsed.error);
    return fail(firstError(fieldErrors), fieldErrors, formValues(formData));
  }

  const isNew = !(await getCreatorProfile(user.id));
  try {
    await upsertCreatorProfile(user.id, parsed.data);
  } catch (err) {
    if (err instanceof CreatorError) return fail(err.message, { username: err.message }, formValues(formData));
    console.error("[saveCreatorProfile] failed", err instanceof Error ? err.message : err);
    return fail("Could not save your profile. Please try again.");
  }
  revalidatePath("/dashboard/creator", "layout");
  revalidatePath(`/creators/${parsed.data.username}`);
  revalidateTag(LANDING_CACHE_TAG, "max");
  if (isNew) redirect("/dashboard/creator?welcome=1");
  return ok(undefined);
}

/** Creator applies / customer joins. Returns the referral code when approved instantly. */
export async function joinCampaignAction(input: unknown): Promise<ActionResult<JoinResult>> {
  let user;
  try {
    user = await assertPartner();
  } catch (err) {
    return fail(safeErrorMessage(err));
  }
  const parsed = applyToCampaignSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid request.");

  if (user.role === "CREATOR" && !(await getCreatorProfile(user.id))) {
    return fail("Complete your creator profile before applying to campaigns.");
  }

  try {
    const result = await joinCampaign(
      { id: user.id, name: user.name, role: user.role as "CREATOR" | "CUSTOMER" },
      parsed.data.campaignId,
      parsed.data.message || null,
    );
    revalidatePath("/dashboard/creator", "layout");
    revalidatePath("/dashboard/customer", "layout");
    revalidatePath("/campaigns");
    return ok(result);
  } catch (err) {
    if (err instanceof PartnerError) return fail(err.message);
    console.error("[joinCampaign] failed", err instanceof Error ? err.message : err);
    return fail("Could not join the campaign. Please try again.");
  }
}

/** A creator or customer withdraws their own pending application. */
export async function withdrawApplicationAction(input: unknown): Promise<ActionResult> {
  let user;
  try {
    user = await assertPartner();
  } catch (err) {
    return fail(safeErrorMessage(err));
  }
  const parsed = withdrawApplicationSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid request.");
  try {
    await withdrawApplication(user.id, parsed.data.applicationId);
    revalidatePath("/dashboard/creator", "layout");
    revalidatePath("/dashboard/customer", "layout");
    return ok(undefined);
  } catch (err) {
    if (err instanceof PartnerError) return fail(err.message);
    console.error("[withdrawApplication] failed", err instanceof Error ? err.message : err);
    return fail("Could not withdraw the application.");
  }
}
