import "server-only";

/**
 * Notification abstraction for the manual verification flow.
 *
 * No email provider is wired up yet, so the default driver only logs. The
 * interface is provider-agnostic: implement `NotificationDriver` (e.g. with
 * Resend / SendGrid / Nodemailer) and switch `getNotifier()` on an env var —
 * callers (registration + approval/rejection) do not change.
 *
 * Notifications are always best-effort: a failure here must never block a
 * registration or an admin decision.
 */

export type RegistrationEvent = "received" | "approved" | "rejected";

export type NotificationRecipient = {
  name: string;
  email: string;
  role: string;
  registrationId?: string | null;
  rejectionReason?: string | null;
};

export interface NotificationDriver {
  send(event: RegistrationEvent, to: NotificationRecipient): Promise<void>;
}

/** Placeholder driver: records intent to the server log, sends nothing. */
class ConsoleNotificationDriver implements NotificationDriver {
  async send(event: RegistrationEvent, to: NotificationRecipient): Promise<void> {
    console.info(
      `[notifications] (${event}) → ${to.email} [${to.role}]` +
        (to.registrationId ? ` reg=${to.registrationId}` : "") +
        (event === "rejected" && to.rejectionReason ? ` reason=${to.rejectionReason}` : ""),
    );
  }
}

let cached: NotificationDriver | null = null;

function getNotifier(): NotificationDriver {
  if (cached) return cached;
  // Future: switch on process.env.NOTIFICATIONS_PROVIDER ("resend" | "sendgrid" | …).
  cached = new ConsoleNotificationDriver();
  return cached;
}

/** Fire-and-forget: never throws, never blocks the caller. */
export async function notifyRegistration(event: RegistrationEvent, to: NotificationRecipient): Promise<void> {
  try {
    await getNotifier().send(event, to);
  } catch (err) {
    console.error("[notifications] send failed", err instanceof Error ? err.message : err);
  }
}
