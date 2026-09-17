"use server";

import { checkRegistrationSchema } from "@/lib/validation/auth";
import { findRegistrationByEmail, findRegistrationById, type RegistrationInfo } from "@/lib/services/registrations";
import { clientIp, rateLimit } from "@/lib/utils/rate-limit";
import { fail, firstError, formValues, ok, zodFieldErrors, type ActionResult } from "@/lib/utils/action-result";

export type CheckResult = { lookedUpBy: "id" | "email"; registration: RegistrationInfo | null };

export async function checkRegistrationAction(
  _prev: ActionResult<CheckResult> | null,
  formData: FormData,
): Promise<ActionResult<CheckResult>> {
  const limit = await rateLimit(`check:${await clientIp()}`, 10, 10 * 60 * 1000);
  if (!limit.ok) {
    return fail(`Too many attempts. Please try again in ${limit.retryAfterSeconds} seconds.`, undefined, formValues(formData));
  }

  const parsed = checkRegistrationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors = zodFieldErrors(parsed.error);
    return fail(firstError(fieldErrors), fieldErrors, formValues(formData));
  }

  const { registrationId, email } = parsed.data;
  const lookedUpBy: "id" | "email" = registrationId?.trim() ? "id" : "email";
  const registration = registrationId?.trim()
    ? await findRegistrationById(registrationId)
    : email?.trim()
      ? await findRegistrationByEmail(email)
      : null;

  if (!registration) {
    return fail("No registration found for those details. Check the Registration ID or email and try again.", undefined, formValues(formData));
  }

  return ok({ lookedUpBy, registration });
}
