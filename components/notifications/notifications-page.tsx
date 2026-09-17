import { PageHeader } from "@/components/dashboard/primitives";
import { NotificationList } from "@/components/notifications/notification-list";
import { listNotifications } from "@/lib/services/notify";

/** Shared notifications page used by every role's dashboard. */
export async function NotificationsPage({ userId }: { userId: string }) {
  const items = await listNotifications(userId, 100);
  return (
    <div className="space-y-6">
      <PageHeader title="Notifications" description="Application decisions, orders, payouts and account updates. Important ones are also e-mailed when enabled in Settings." />
      <NotificationList items={items} />
    </div>
  );
}
