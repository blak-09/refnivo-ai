import type { UserRole } from "@prisma/client";

export const ROLE_HOME: Record<UserRole, string> = {
  BRAND_OWNER: "/dashboard/brand",
  CREATOR: "/dashboard/creator",
  CUSTOMER: "/dashboard/customer",
  ADMIN: "/dashboard/admin",
};

export const ROLE_LABEL: Record<UserRole, string> = {
  BRAND_OWNER: "Brand owner",
  CREATOR: "Creator",
  CUSTOMER: "Customer",
  ADMIN: "Admin",
};

/** Maps the first dashboard path segment to the role allowed to view it. */
export const DASHBOARD_SEGMENT_ROLE: Record<string, UserRole> = {
  brand: "BRAND_OWNER",
  creator: "CREATOR",
  customer: "CUSTOMER",
  admin: "ADMIN",
};

export function roleHome(role: UserRole | undefined | null): string {
  return role ? ROLE_HOME[role] : "/auth/login";
}

export function roleForDashboardPath(pathname: string): UserRole | null {
  const match = pathname.match(/^\/dashboard\/([^/]+)/);
  if (!match) return null;
  return DASHBOARD_SEGMENT_ROLE[match[1]] ?? null;
}
