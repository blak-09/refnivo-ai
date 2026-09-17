import type { Metadata } from "next";
import { NotificationsPage } from "@/components/notifications/notifications-page";
import { requireRole } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Notifications" };

export default async function CreatorNotificationsPage() {
  const user = await requireRole("CREATOR");
  return <NotificationsPage userId={user.id} />;
}
