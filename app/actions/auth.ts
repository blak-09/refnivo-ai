"use server";

import { AuthError } from "next-auth";
import { redirect, unstable_rethrow } from "next/navigation";
import bcrypt from "bcryptjs";
import { signIn, signOut } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { roleHome } from "@/lib/auth/roles";
import { createUser, EmailTakenError } from "@/lib/services/users";
import { notifyRegistration } from "@/lib/services/notifications";
import { extractRegistrationDetails, loginSchema, registerSchema } from "@/lib/validation/auth";
import { clientIp, rateLimit } from "@/lib/utils/rate-limit";
import { securityEvent } from "@/lib/utils/security-log";
import { logServerError } from "@/lib/utils/server-log";
import { fail, firstError, formValues, zodFieldErrors, type ActionResult } from "@/lib/utils/action-result";

function safeCallback(url: FormDataEntryValue | null): string | null {
  if (typeof url !== "string" || !url.startsWith("/") || url.startsWith("//")) return null;
  return url;
}

export async function registerAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const limit = await rateLimit(`register:${await clientIp()}`, 5, 10 * 60 * 1000);
  if (!limit.ok) {
    return fail(`Too many attempts. Please try again in ${limit.retryAfterSeconds} seconds.`, undefined, formValues(formData));
  }

  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors = zodFieldErrors(parsed.error);
    return fail(firstError(fieldErrors), fieldErrors, formValues(formData));
  }

  const details = extractRegistrationDetails(parsed.data);

  let user;
  try {
    user = await createUser({
      name: parsed.data.name,
      email: parsed.data.email,
      password: parsed.data.password,
      role: parsed.data.role,
      phone: parsed.data.phone || null,
      registrationDetails: details,
    });
  } catch (err) {
    if (err instanceof EmailTakenError) return fail(err.message, { email: err.message }, formValues(formData));
    logServerError("register", err, { role: parsed.data.role });
    return fail("Could not create your account. Please try again.");
  }

  // Best-effort side-effect — never blocks the registration if it fails.
  await notifyRegistration("received", {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    registrationId: user.registrationId,
  });

  redirect(`/registration-pending?rid=${encodeURIComponent(user.registrationId ?? "")}`);
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

  const limit = await rateLimit(`login:${await clientIp()}:${parsed.data.email}`, 10, 10 * 60 * 1000);
  if (!limit.ok) {
    return fail(`Too many attempts. Please try again in ${limit.retryAfterSeconds} seconds.`, undefined, formValues(formData));
  }

  const callbackUrl = safeCallback(formData.get("callbackUrl"));

  // Look up the account so we can give the user a precise, safe reason.
  let user;
  try {
    user = await prisma.user.findUnique({
      where: { email: parsed.data.email },
      select: { passwordHash: true, status: true, role: true, rejectionReason: true },
    });
  } catch (err) {
    // Infrastructure failure (database unreachable, pending migration, pooler misconfiguration) — never a user error.
    logServerError("login", err);
    return fail("Sign-in is temporarily unavailable. Please try again in a moment.", undefined, formValues(formData));
  }

  // Case 1 — no account.
  if (!user) {
    securityEvent("LOGIN_FAILED", { reason: "NO_ACCOUNT", email: parsed.data.email });
    return fail("No account found. Please sign up first.", { _status: "NO_ACCOUNT" }, formValues(formData));
  }

  // Case 5 — verify the password BEFORE revealing any status, so account status
  // cannot be probed without the correct credentials.
  const passwordOk = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!passwordOk) {
    securityEvent("LOGIN_FAILED", { reason: "BAD_PASSWORD", email: parsed.data.email });
    return fail("Invalid email or password.", undefined, formValues(formData));
  }

  // Cases 2/3 + suspended — password is correct but the account can't sign in yet.
  if (user.status === "PENDING") {
    return fail("Your registration is still under review. Please wait for approval.", { _status: "PENDING" }, formValues(formData));
  }
  if (user.status === "REJECTED") {
    const reason = user.rejectionReason?.trim();
    return fail(
      reason ? `Your registration was not approved. Reason: ${reason}` : "Your registration was not approved.",
      { _status: "REJECTED" },
      formValues(formData),
    );
  }
  if (user.status === "SUSPENDED") {
    securityEvent("LOGIN_FAILED", { reason: "SUSPENDED", email: parsed.data.email });
    return fail("Your account has been suspended. Please contact support.", { _status: "SUSPENDED" }, formValues(formData));
  }

  // Case 4 — approved: sign in and route by role.
  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: callbackUrl ?? roleHome(user.role),
    });
  } catch (err) {
    unstable_rethrow(err);
    if (err instanceof AuthError) {
      return fail("Invalid email or password.", undefined, formValues(formData));
    }
    logServerError("login", err);
    return fail("Could not sign you in. Please try again.");
  }
  return { ok: true, data: undefined };
}

export async function logoutAction() {
  await signOut({ redirectTo: "/" });
}
