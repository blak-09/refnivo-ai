import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";

/**
 * Convenience path from the spec (`/admin/registrations`). The real, guarded
 * panel lives under the dashboard so it shares the admin layout and route
 * protection. Access is re-checked here before redirecting.
 */
export default async function AdminRegistrationsRedirect() {
  await requireRole("ADMIN");
  redirect("/dashboard/admin/registrations");
}
