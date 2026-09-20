import "server-only";
import { getCurrentUser } from "./guards";

/**
 * Creator audience numbers are self-reported and exist so BRANDS can evaluate
 * applications. They are never shown to customers (or anonymous visitors, who
 * may be customers) — see CLAUDE.md. Brands and admins see them, labelled.
 */
export async function canViewAudienceNumbers(): Promise<boolean> {
  const user = await getCurrentUser();
  return user?.role === "BRAND_OWNER" || user?.role === "ADMIN";
}
