import type { Metadata } from "next";
import { NotificationsPage } from "@/components/notifications/notifications-page";
import { requireBrand } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Notifications" };

export default async function BrandNotificationsPage() {
  const { user } = await requireBrand();
  return <NotificationsPage userId={user.id} />;
}
