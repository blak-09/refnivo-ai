"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { unstable_update } from "@/lib/auth";
import { assertUser } from "@/lib/auth/guards";
import { roleHome } from "@/lib/auth/roles";
import { ONBOARDING_PROFILE_PATH, ONBOARDING_REVIEW_PATH, safeNext, withNext } from "@/lib/onboarding/paths";
import { LANDING_CACHE_TAG } from "@/lib/services/landing";
import {
  changeOnboardingRole,
  getOnboardingContext,
  isRegistrable,
  OnboardingError,
  readDraft,
  saveOnboardingDraft,
  saveProfile,
} from "@/lib/services/onboarding";
import { uploadsAvailable } from "@/lib/storage/availability";
import { isRegistrableRole } from "@/lib/services/oauth";
import { profileFormObject, profileSchemaFor, type ProfileFormValues } from "@/lib/validation/onboarding";
import { firstError, safeErrorMessage, zodFieldErrors, type FieldErrors } from "@/lib/utils/action-result";
import { logServerError } from "@/lib/utils/server-log";

/** Like ActionResult, but echoes checkbox groups back as arrays. */
export type ProfileActionState =
  | { ok: true; message: string; savedAt?: string }
  | { ok: false; error: string; fieldErrors?: FieldErrors; values?: ProfileFormValues };

const failed = (error: string, fieldErrors?: FieldErrors, values?: ProfileFormValues): ProfileActionState => ({ ok: false, error, fieldErrors, values });

function revalidateProfiles(publicPath: string | null) {
  revalidatePath("/dashboard", "layout");
  revalidatePath("/brands");
  revalidatePath("/creators");
  if (publicPath) revalidatePath(publicPath);
  revalidateTag(LANDING_CACHE_TAG, "max");
}

/**
 * Page 1 for a signed-in account that has not finished onboarding: keep the
 * role, or switch it while that is still safe (see roleChangeBlockers).
 */
export async function chooseRoleAction(_prev: ProfileActionState | null, formData: FormData): Promise<ProfileActionState> {
  let user;
  try {
    user = await assertUser();
  } catch (err) {
    return failed(safeErrorMessage(err));
  }
  const next = safeNext(formData.get("next"));
  if (user.onboardingCompletedAt) redirect(next ?? roleHome(user.role));
  const role = formData.get("role");
  if (!isRegistrableRole(role)) return failed("Choose how you would like to use Refnivo.");
  if (!isRegistrable(user.role)) redirect(roleHome(user.role));

  if (role !== user.role) {
    try {
      await changeOnboardingRole(user.id, user.role, role);
      // The JWT carries the role (proxy routing); refresh it from the database.
      await unstable_update({});
    } catch (err) {
      if (err instanceof OnboardingError) return failed(err.message);
      logServerError("onboarding.role", err);
      return failed("Could not change your account type. Please try again.");
    }
  }
  redirect(withNext(ONBOARDING_PROFILE_PATH, next));
}

/**
 * Page 2. intent=save stores the draft as typed ("Save progress"); intent=continue
 * validates fully, stores the draft and moves to the review page.
 */
export async function saveOnboardingProfileAction(_prev: ProfileActionState | null, formData: FormData): Promise<ProfileActionState> {
  let user;
  try {
    user = await assertUser();
  } catch (err) {
    return failed(safeErrorMessage(err));
  }
  const next = safeNext(formData.get("next"));
  if (user.onboardingCompletedAt) redirect(next ?? roleHome(user.role));
  if (!isRegistrable(user.role)) redirect(roleHome(user.role));
  const role = user.role;
  const values = profileFormObject(role, formData);

  if (formData.get("intent") === "save") {
    try {
      const draft = await saveOnboardingDraft(user.id, role, values);
      return { ok: true, message: "Progress saved. You can come back and finish any time.", savedAt: draft.savedAt };
    } catch (err) {
      logServerError("onboarding.draft", err);
      return failed("Could not save your progress. Please try again.", undefined, values);
    }
  }

  const parsed = profileSchemaFor(role, uploadsAvailable() ? "required" : "optional").safeParse(values);
  if (!parsed.success) {
    const fieldErrors = zodFieldErrors(parsed.error);
    // Keep what they typed even when it does not validate yet.
    await saveOnboardingDraft(user.id, role, values).catch(() => {});
    return failed(firstError(fieldErrors), fieldErrors, values);
  }
  try {
    await saveOnboardingDraft(user.id, role, values);
  } catch (err) {
    logServerError("onboarding.draft", err);
    return failed("Could not save your profile. Please try again.", undefined, values);
  }
  redirect(withNext(ONBOARDING_REVIEW_PATH, next));
}

/** Page 3 → "Complete registration": write the profile, finish onboarding, open the dashboard. */
export async function completeOnboardingAction(_prev: ProfileActionState | null, formData: FormData): Promise<ProfileActionState> {
  let user;
  try {
    user = await assertUser();
  } catch (err) {
    return failed(safeErrorMessage(err));
  }
  const next = safeNext(formData.get("next"));
  if (user.onboardingCompletedAt) redirect(next ?? roleHome(user.role));
  if (!isRegistrable(user.role)) redirect(roleHome(user.role));

  const ctx = await getOnboardingContext(user.id);
  const draft = readDraft(ctx.onboardingDraft, user.role);
  if (!draft) redirect(withNext(ONBOARDING_PROFILE_PATH, next));
  const parsed = profileSchemaFor(user.role, uploadsAvailable() ? "required" : "optional").safeParse(draft.values);
  if (!parsed.success) redirect(withNext(ONBOARDING_PROFILE_PATH, next));

  let publicPath: string | null = null;
  try {
    ({ publicPath } = await saveProfile(user.id, { role: user.role, values: parsed.data } as Parameters<typeof saveProfile>[1], { complete: true }));
  } catch (err) {
    if (err instanceof OnboardingError) {
      return failed(err.field === "username" ? `${err.message} Use "Edit profile" to change it.` : err.message);
    }
    logServerError("onboarding.complete", err);
    return failed("Could not complete your registration. Please try again.");
  }
  revalidateProfiles(publicPath);
  redirect(next ?? `${roleHome(user.role)}?welcome=1`);
}

/** Settings → Edit profile (any role, after onboarding). */
export async function saveProfileAction(_prev: ProfileActionState | null, formData: FormData): Promise<ProfileActionState> {
  let user;
  try {
    user = await assertUser();
  } catch (err) {
    return failed(safeErrorMessage(err));
  }
  if (!isRegistrable(user.role)) return failed("This account has no profile to edit.");
  if (!user.onboardingCompletedAt) redirect(ONBOARDING_PROFILE_PATH);
  const values = profileFormObject(user.role, formData);
  // Existing profiles may predate a required photo — never block an edit on it.
  const parsed = profileSchemaFor(user.role, "optional").safeParse(values);
  if (!parsed.success) {
    const fieldErrors = zodFieldErrors(parsed.error);
    return failed(firstError(fieldErrors), fieldErrors, values);
  }
  try {
    const { publicPath } = await saveProfile(user.id, { role: user.role, values: parsed.data } as Parameters<typeof saveProfile>[1], { complete: false });
    revalidateProfiles(publicPath);
  } catch (err) {
    if (err instanceof OnboardingError) return failed(err.message, err.field ? { [err.field]: err.message } : undefined, values);
    logServerError("profile.save", err);
    return failed("Could not save your profile. Please try again.", undefined, values);
  }
  return { ok: true, message: "Profile saved." };
}
