"use server";

import { AuthError } from "next-auth";
import { redirect, unstable_rethrow } from "next/navigation";
import { signIn, signOut } from "@/lib/auth";
import { createUser, EmailTakenError } from "@/lib/services/users";
import { loginSchema, registerSchema } from "@/lib/validation/auth";
import { fail, firstError, formValues, zodFieldErrors, type ActionResult } from "@/lib/utils/action-result";

function safeCallback(url: FormDataEntryValue | null): string | null {
  if (typeof url !== "string" || !url.startsWith("/") || url.startsWith("//")) return null;
  return url;
}

export async function registerAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors = zodFieldErrors(parsed.error);
    return fail(firstError(fieldErrors), fieldErrors, formValues(formData));
  }

  try {
    await createUser(parsed.data);
  } catch (err) {
    if (err instanceof EmailTakenError) return fail(err.message, { email: err.message }, formValues(formData));
    console.error("[register] failed", err instanceof Error ? err.message : err);
    return fail("Could not create your account. Please try again.");
  }

  redirect("/auth/login?registered=1");
}

export async function loginAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors = zodFieldErrors(parsed.error);
    return fail(firstError(fieldErrors), fieldErrors, formValues(formData));
  }

  const callbackUrl = safeCallback(formData.get("callbackUrl"));

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: callbackUrl ?? "/dashboard",
    });
  } catch (err) {
    unstable_rethrow(err);
    if (err instanceof AuthError) {
      return fail("Invalid email or password.", undefined, formValues(formData));
    }
    console.error("[login] failed", err instanceof Error ? err.message : err);
    return fail("Could not sign you in. Please try again.");
  }
  return { ok: true, data: undefined };
}

export async function logoutAction() {
  await signOut({ redirectTo: "/" });
}
