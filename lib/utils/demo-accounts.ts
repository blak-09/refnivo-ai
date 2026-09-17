import "server-only";
import { DEMO_EMAIL_DOMAIN } from "./demo";

/**
 * Seeded demo credentials — SERVER ONLY, development only. Kept out of every
 * client bundle; the login page only forwards them when `showDemoLogins()` is
 * true (never in production) and the accounts actually exist in the database.
 * The seed script (`prisma/seed.ts`) defines the same password independently.
 */
export const DEMO_PASSWORD = "Demo@1234";

/** One quick sign-in ID per role (seeded by `npm run db:seed`). */
export const QUICK_DEMO_ACCOUNTS = [
  { role: "BRAND_OWNER", label: "Brand", email: `brand@${DEMO_EMAIL_DOMAIN}`, password: DEMO_PASSWORD },
  { role: "CREATOR", label: "Creator", email: `creator@${DEMO_EMAIL_DOMAIN}`, password: DEMO_PASSWORD },
  { role: "CUSTOMER", label: "Customer", email: `customer@${DEMO_EMAIL_DOMAIN}`, password: DEMO_PASSWORD },
  { role: "ADMIN", label: "Admin", email: `admin@${DEMO_EMAIL_DOMAIN}`, password: DEMO_PASSWORD },
] as const;
