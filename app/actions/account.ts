"use server";

import { revalidatePath } from "next/cache";
import { assertUser } from "@/lib/auth/guards";
import { changePassword, updateAccount, WrongPasswordError } from "@/lib/services/users";
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
  return ok(undefined);
}
