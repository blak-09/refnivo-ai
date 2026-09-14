/** Demo accounts are created by prisma/seed.ts and use this email domain. */
export const DEMO_EMAIL_DOMAIN = "localgrowth.demo";
export const DEMO_PASSWORD = "Demo@1234";

export function isDemoAccount(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase().endsWith(`@${DEMO_EMAIL_DOMAIN}`);
}

/** One quick sign-in ID per role (seeded by `npm run db:seed`). */
export const QUICK_DEMO_ACCOUNTS = [
  { role: "BRAND_OWNER", label: "Brand", email: `brand@${DEMO_EMAIL_DOMAIN}`, password: DEMO_PASSWORD },
  { role: "CREATOR", label: "Creator", email: `creator@${DEMO_EMAIL_DOMAIN}`, password: DEMO_PASSWORD },
  { role: "CUSTOMER", label: "Customer", email: `customer@${DEMO_EMAIL_DOMAIN}`, password: DEMO_PASSWORD },
  { role: "ADMIN", label: "Admin", email: `admin@${DEMO_EMAIL_DOMAIN}`, password: DEMO_PASSWORD },
] as const;

/**
 * Quick sign-in buttons are only shown outside production, or when explicitly
 * enabled for a demo deployment via NEXT_PUBLIC_SHOW_DEMO_LOGINS=true.
 */
export function showDemoLogins(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_SHOW_DEMO_LOGINS === "true";
}
