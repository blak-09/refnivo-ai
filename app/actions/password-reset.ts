"use server";

import { redirect } from "next/navigation";
import { isEmailConfigured } from "@/lib/email";
import { requestPasswordReset, resetPasswordWithToken, ResetTokenError } from "@/lib/services/password-reset";
import { forgotPasswordSchema, resetPasswordSchema } from "@/lib/validation/auth";
import { clientIp, rateLimit } from "@/lib/utils/rate-limit";
import { securityEvent } from "@/lib/utils/security-log";
import { fail, firstError, formValues, ok, zodFieldErrors, type ActionResult } from "@/lib/utils/action-result";

/**
 * Always answers the same way whether or not the e-mail exists. Rate-limited
 * per IP (5 / 15 min) and per e-mail (3 / hour) so the endpoint cannot be used
 * to flood someone's inbox.
 */
export async function forgotPasswordAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors = zodFieldErrors(parsed.error);
    return fail(firstError(fieldErrors), fieldErrors, formValues(formData));
  }

  const ip = await clientIp();
  const perIp = await rateLimit(`reset:${ip}`, 5, 15 * 60 * 1000);
  const perEmail = await rateLimit(`reset-email:${parsed.data.email}`, 3, 60 * 60 * 1000);
  if (!perIp.ok || !perEmail.ok) {
    const retry = Math.max(perIp.ok ? 0 : perIp.retryAfterSeconds, perEmail.ok ? 0 : perEmail.retryAfterSeconds);
    return fail(`Too many attempts. Please try again in ${retry} seconds.`, undefined, formValues(formData));
  }

  if (!isEmailConfigured()) {
    // Be honest: without a mail provider no link can be delivered.
    securityEvent("ENV_VALIDATION_WARNING", { message: "password reset requested but no e-mail provider is configured" });
    return fail("Password reset by e-mail is not available on this deployment yet. Please contact support to regain access.");
  }

  try {
    await requestPasswordReset(parsed.data.email);
  } catch (err) {
    console.error("[forgotPassword] failed", err instanceof Error ? err.message : err);
    // Same neutral answer — never reveal whether the account exists.
  }
  return ok(undefined);
}

export async function resetPasswordAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors = zodFieldErrors(parsed.error);
    return fail(firstError(fieldErrors), fieldErrors);
  }

  const limit = await rateLimit(`reset-token:${await clientIp()}`, 10, 15 * 60 * 1000);
  if (!limit.ok) return fail(`Too many attempts. Please try again in ${limit.retryAfterSeconds} seconds.`);

  try {
    await resetPasswordWithToken(parsed.data.token, parsed.data.password);
  } catch (err) {
    if (err instanceof ResetTokenError) return fail(err.message);
    console.error("[resetPassword] failed", err instanceof Error ? err.message : err);
    return fail("Could not reset your password. Please request a new link.");
  }
  redirect("/auth/login?reason=password-changed");
}
