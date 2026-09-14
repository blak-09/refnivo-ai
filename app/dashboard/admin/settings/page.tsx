import type { Metadata } from "next";
import { SettingsPage } from "@/components/account/settings-page";
import { requireRole } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Settings" };

export default async function AdminSettingsPage() {
  const user = await requireRole("ADMIN");
  return <SettingsPage user={user} />;
}
