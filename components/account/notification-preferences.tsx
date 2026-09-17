"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setEmailNotificationsAction } from "@/app/actions/notifications";

/** E-mail opt-in toggle. In-app notifications are always on; this only controls e-mail copies. */
export function NotificationPreferences({ emailNotifications, emailConfigured }: { emailNotifications: boolean; emailConfigured: boolean }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function toggle(next: boolean) {
    setPending(true);
    try {
      const res = await setEmailNotificationsAction(next);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(next ? "E-mail notifications enabled." : "E-mail notifications disabled.");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3 text-sm">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          className="mt-0.5 size-4 accent-primary"
          checked={emailNotifications}
          disabled={pending}
          onChange={(e) => toggle(e.target.checked)}
          aria-describedby="email-notifications-hint"
        />
        <span>
          <span className="font-medium">E-mail me about important events</span>
          <span id="email-notifications-hint" className="block text-muted-foreground">
            Application decisions, verified orders, payouts and account changes. In-app notifications are always available on the Notifications page.
          </span>
        </span>
      </label>
      {!emailConfigured ? <p className="text-xs text-muted-foreground">E-mail delivery is not configured on this deployment yet, so no messages are sent until it is.</p> : null}
    </div>
  );
}
