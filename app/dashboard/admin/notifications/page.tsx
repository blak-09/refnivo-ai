import type { Metadata } from "next";
import { NotificationsPage } from "@/components/notifications/notifications-page";
import { requireRole } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Notifications" };

export default async function AdminNotificationsPage() {
  const user = await requireRole("ADMIN");
  return <NotificationsPage userId={user.id} />;
}
