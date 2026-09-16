/**
 * Safe production migration runner: `npm run db:deploy`
 *
 * - Only ever runs `prisma migrate deploy` (never db push / migrate reset).
 * - Refuses to run without DATABASE_URL.
 * - Prints the target host/database (never the password) and the pending
 *   migrations, then applies them. Set DB_DEPLOY_DRY_RUN=1 to only report.
 *
 * Take a backup before running against production (see docs/PRODUCTION.md).
 */
import { execSync } from "node:child_process";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("[db-deploy] DATABASE_URL is not set. Refusing to run.");
  process.exit(1);
}

let target = "(unparseable DATABASE_URL)";
try {
  const u = new URL(url);
  target = `${u.hostname}:${u.port || "5432"}${u.pathname}`;
} catch {
  /* keep placeholder */
}
console.log(`[db-deploy] target: ${target}`);

const run = (cmd: string) => execSync(cmd, { stdio: "inherit", env: process.env });

console.log("[db-deploy] migration status:");
try {
  run("npx prisma migrate status");
} catch {
  // `migrate status` exits non-zero when migrations are pending — that is expected here.
}

if (process.env.DB_DEPLOY_DRY_RUN === "1") {
  console.log("[db-deploy] dry run — nothing applied.");
  process.exit(0);
}

console.log("[db-deploy] applying pending migrations with `prisma migrate deploy` …");
run("npx prisma migrate deploy");
console.log("[db-deploy] done.");
