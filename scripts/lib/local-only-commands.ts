/**
 * Fixed allow-list for `scripts/db-local-only.ts`. Kept in its own module so
 * tests can assert on it without executing the script.
 */
export const LOCAL_ONLY_COMMANDS: Record<string, string> = {
  push: "npx prisma db push",
  reset: "npx prisma migrate reset --force",
  "migrate-dev": "npx prisma migrate dev",
};
