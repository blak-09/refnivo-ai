"use server";

import { createHash } from "node:crypto";
import { transaction } from "@/lib/db/prisma";
import { enqueueEmail } from "@/lib/email/outbox";
import { contactInbox } from "@/lib/config/contact";
import { getCurrentUser } from "@/lib/auth/guards";
import { contactMessageSchema, CONTACT_ROLE_LABEL } from "@/lib/validation/contact";
import { fail, firstError, formValues, ok, zodFieldErrors, type ActionResult } from "@/lib/utils/action-result";
import { clientIp, rateLimit } from "@/lib/utils/rate-limit";
import { securityEvent } from "@/lib/utils/security-log";

/**
 * Contact form → the existing transactional e-mail outbox (lib/email/outbox.ts),
 * so a message is queued inside a transaction, dispatched after commit through
 * the configured provider, and retried by the outbox cron if the provider is
 * down. Nothing is "sent" optimistically: a failure to queue is reported.
 *
 * Delivery address: CONTACT_INBOX_EMAIL, else the published address.
 */
export async function sendContactMessageAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = contactMessageSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors = zodFieldErrors(parsed.error);
    return fail(firstError(fieldErrors), fieldErrors, formValues(formData));
  }
  const data = parsed.data;

  if (data.company) {
    // Honeypot filled: accept silently so bots learn nothing.
    securityEvent("CONTACT_HONEYPOT", {});
    return ok(undefined);
  }

  const ip = await clientIp();
  const perIp = await rateLimit(`contact:${ip}`, 5, 60 * 60 * 1000);
  const perEmail = await rateLimit(`contact-email:${data.email.toLowerCase()}`, 5, 24 * 60 * 60 * 1000);
  const blocked = [perIp, perEmail].find((r) => !r.ok);
  if (blocked && !blocked.ok) {
    securityEvent("RATE_LIMITED", { scope: "contact" });
    return fail(
      `You have sent several messages already. Please try again in ${Math.max(1, Math.ceil(blocked.retryAfterSeconds / 60))} minutes, or email us directly.`,
      undefined,
      formValues(formData),
    );
  }

  const user = await getCurrentUser();
  // One message per identical submission per hour: a double click or a retry
  // after a network blip cannot deliver the same message twice.
  const hour = Math.floor(Date.now() / (60 * 60 * 1000));
  const idempotencyKey = `contact:${createHash("sha256").update(`${hour}:${data.email.toLowerCase()}:${data.subject}:${data.message}`).digest("hex").slice(0, 40)}`;

  const text = [
    `New message from the Refnivo contact form.`,
    "",
    `Name:    ${data.name}`,
    `Email:   ${data.email}`,
    `Role:    ${CONTACT_ROLE_LABEL[data.role]}`,
    `Account: ${user ? `signed in (${user.role})` : "not signed in"}`,
    `Subject: ${data.subject}`,
    "",
    data.message,
    "",
    `— Reply directly to ${data.email}`,
  ].join("\n");

  try {
    const result = await transaction((tx) =>
      enqueueEmail(tx, {
        idempotencyKey,
        to: contactInbox(),
        subject: `[Contact · ${CONTACT_ROLE_LABEL[data.role]}] ${data.subject}`,
        text,
        userId: user?.id ?? null,
      }),
    );
    // A duplicate key means the identical message is already queued — still a success for the sender.
    if (!result.queued && result.reason !== "DUPLICATE") throw new Error(`unexpected enqueue result: ${result.reason}`);
    return ok(undefined);
  } catch (err) {
    console.error("[contact] could not queue message", err instanceof Error ? err.message : err);
    return fail("We could not send your message right now. Please email us directly and we will pick it up.", undefined, formValues(formData));
  }
}
