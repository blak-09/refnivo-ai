import type { Metadata } from "next";
import { SettingsPage } from "@/components/account/settings-page";
import { requireRole } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Settings" };

export default async function CustomerSettingsPage() {
  const user = await requireRole("CUSTOMER");
  return <SettingsPage user={user} />;
}
