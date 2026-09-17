/**
 * Safe production migration runner: `npm run db:deploy`
 *
 * - Only ever runs `prisma migrate deploy` (never db push / migrate reset).
 * - Refuses to run without DATABASE_URL.
 * - Remote targets require DB_DEPLOY_CONFIRM_HOST to equal the target hostname.
 * - Refuses a database that has no migration history yet (P3005) — baseline it
 *   first (docs/PRODUCTION.md §3).
 * - Prints the target host/database (never the password) and the pending
 *   migrations, then applies them. Set DB_DEPLOY_DRY_RUN=1 to only report.
 *
 * Take a backup before running against production (see docs/PRODUCTION.md).
 */
import { execSync } from "node:child_process";
import { formatTarget } from "./lib/db-url";
import { decideDeploy, needsBaseline } from "./lib/deploy-guard";

function fail(msg: string): never {
  console.error(`[db-deploy] ${msg}`);
  process.exit(1);
}

const verdict = decideDeploy({ url: process.env.DATABASE_URL, confirmHost: process.env.DB_DEPLOY_CONFIRM_HOST });
console.log(`[db-deploy] target: ${formatTarget(verdict.target)}`);
if (!verdict.ok) fail(`refused — ${verdict.reason}`);

console.log("[db-deploy] migration status:");
let status = "";
try {
  status = execSync("npx prisma migrate status", { encoding: "utf8", env: process.env, stdio: ["ignore", "pipe", "pipe"] });
} catch (err) {
  // `migrate status` exits non-zero when migrations are pending — that is expected here.
  const e = err as { stdout?: string; stderr?: string };
  status = `${e.stdout ?? ""}\n${e.stderr ?? ""}`;
}
process.stdout.write(status.endsWith("\n") ? status : `${status}\n`);
if (needsBaseline(status)) {
  fail("this database has no migration history (P3005). Baseline it first — see docs/PRODUCTION.md §3. Nothing was applied.");
}

if (process.env.DB_DEPLOY_DRY_RUN === "1") {
  console.log("[db-deploy] dry run — nothing applied.");
  process.exit(0);
}

console.log("[db-deploy] applying pending migrations with `prisma migrate deploy` …");
execSync("npx prisma migrate deploy", { stdio: "inherit", env: process.env });
console.log("[db-deploy] done.");
