import "server-only";
import { transaction } from "@/lib/db/prisma";
import { enqueueEmail } from "@/lib/email/outbox";
import { notify } from "./notify";

/**
 * Registration lifecycle messages (received / approved / rejected).
 *
 * "received" is e-mail only — the account cannot sign in yet, so an in-app
 * notification would be invisible; it is account-critical, so it ignores the
 * e-mail opt-out. Approval / rejection create an in-app notification and (when
 * the user has e-mail on) an outbox row. Everything is written in one
 * transaction and delivered only after commit; nothing here can block or roll
 * back the registration or the admin decision.
 */
export type RegistrationEvent = "received" | "approved" | "rejected";

export type NotificationRecipient = {
  id: string;
  name: string;
  email: string;
  role: string;
  registrationId?: string | null;
  rejectionReason?: string | null;
};

function appUrl(path: string): string {
  return `${(process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "")}${path}`;
}

function receivedMessage(to: NotificationRecipient): { subject: string; text: string } {
  return {
    subject: "We received your Refnivo AI registration",
    text: [
      `Hi ${to.name},`,
      "",
      "Thanks for registering. Our team reviews every account before it can sign in.",
      to.registrationId ? `Your registration ID is ${to.registrationId}. You can check its status at ${appUrl("/check-registration")}.` : "",
      "",
      "— Refnivo AI",
    ].join("\n"),
  };
}

/** Best-effort: never throws, never blocks the caller. */
export async function notifyRegistration(event: RegistrationEvent, to: NotificationRecipient): Promise<void> {
  try {
    await transaction(async (tx) => {
      if (event === "received") {
        const { subject, text } = receivedMessage(to);
        await enqueueEmail(tx, { idempotencyKey: `registration:${to.id}:received`, to: to.email, subject, text, userId: to.id });
        return;
      }
      await notify(
        {
          userId: to.id,
          type: event === "approved" ? "ACCOUNT_APPROVED" : "ACCOUNT_REJECTED",
          idempotencyKey: `registration:${to.id}:${event}:${to.rejectionReason ?? ""}`,
          title: event === "approved" ? "Your Refnivo AI account is approved" : "Update on your Refnivo AI registration",
          body:
            event === "approved"
              ? `Your account has been approved. Sign in at ${appUrl("/auth/login")} to get started.`
              : `We were unable to approve your registration at this time.${to.rejectionReason ? ` Reason: ${to.rejectionReason}` : ""} You can review the status at ${appUrl("/check-registration")}.`,
          href: event === "approved" ? "/dashboard" : null,
          email: true,
        },
        tx,
      );
    });
  } catch (err) {
    console.error("[notifications] failed", err instanceof Error ? err.message : err);
  }
}
