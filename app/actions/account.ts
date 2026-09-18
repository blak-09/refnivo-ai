"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { signOut } from "@/lib/auth";
import { assertUser } from "@/lib/auth/guards";
import { AccountDeletionError, deleteOwnAccount } from "@/lib/services/account-deletion";
import { changePassword, updateAccount, WrongPasswordError } from "@/lib/services/users";
import { clientIp, rateLimit } from "@/lib/utils/rate-limit";
import { logServerError } from "@/lib/utils/server-log";
import { accountSchema, changePasswordSchema } from "@/lib/validation/account";
import { fail, firstError, formValues, ok, safeErrorMessage, zodFieldErrors, type ActionResult } from "@/lib/utils/action-result";

export async function updateAccountAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  let user;
  try {
    user = await assertUser();
  } catch (err) {
    return fail(safeErrorMessage(err));
  }
  const parsed = accountSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors = zodFieldErrors(parsed.error);
    return fail(firstError(fieldErrors), fieldErrors, formValues(formData));
  }
  try {
    await updateAccount(user.id, parsed.data);
  } catch (err) {
    console.error("[updateAccount] failed", err instanceof Error ? err.message : err);
    return fail("Could not save your details.");
  }
  revalidatePath("/dashboard", "layout");
  return ok(undefined);
}

export async function changePasswordAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  let user;
  try {
    user = await assertUser();
  } catch (err) {
    return fail(safeErrorMessage(err));
  }
  const parsed = changePasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors = zodFieldErrors(parsed.error);
    return fail(firstError(fieldErrors), fieldErrors, formValues(formData));
  }
  try {
    await changePassword(user.id, parsed.data.currentPassword, parsed.data.newPassword);
  } catch (err) {
    if (err instanceof WrongPasswordError) return fail(err.message, { currentPassword: err.message });
    console.error("[changePassword] failed", err instanceof Error ? err.message : err);
    return fail("Could not change your password.");
  }
  // The session version just changed, so every existing session — including this
  // one — is now invalid. Sign out cleanly and ask the user to log in again.
  await signOut({ redirectTo: "/auth/login?reason=password-changed" });
  return ok(undefined);
}

const deleteAccountSchema = z.object({
  confirmation: z.string().trim().min(1, "Type DELETE to confirm."),
  currentPassword: z.string().optional().or(z.literal("")),
});

/**
 * Danger zone: delete the signed-in user's OWN account. The user id comes
 * from the session only; the service re-checks the typed phrase, the current
 * password (password accounts), open payouts and the admin rule, then
 * anonymises the row and bumps sessionVersion. We sign out afterwards.
 */
export async function deleteAccountAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  let user;
  try {
    user = await assertUser();
  } catch (err) {
    return fail(safeErrorMessage(err));
  }
  const limit = await rateLimit(`delete-account:${await clientIp()}`, 5, 15 * 60 * 1000);
  if (!limit.ok) return fail(`Too many attempts. Please try again in ${limit.retryAfterSeconds} seconds.`);

  const parsed = deleteAccountSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors = zodFieldErrors(parsed.error);
    return fail(firstError(fieldErrors), fieldErrors);
  }
  try {
    await deleteOwnAccount(user.id, { confirmation: parsed.data.confirmation, currentPassword: parsed.data.currentPassword || null });
  } catch (err) {
    if (err instanceof AccountDeletionError) {
      const field = /password/i.test(err.message) ? "currentPassword" : /confirm/i.test(err.message) ? "confirmation" : undefined;
      return fail(err.message, field ? { [field]: err.message } : undefined);
    }
    logServerError("deleteAccount", err);
    return fail("Could not delete your account. Please try again.");
  }
  await signOut({ redirectTo: "/auth/login?reason=account-deleted" });
  return ok(undefined);
}
