/**
 * Production admin bootstrap: `npm run admin:create`
 *
 * Creates the single bootstrap admin from environment variables so no password
 * ever appears in a shell history, chat, or log:
 *
 *   PowerShell:
 *     $env:DATABASE_URL            = "<production URL>"
 *     $env:ADMIN_BOOTSTRAP_CONFIRM = "<database hostname, e.g. aws-0-ap-northeast-1.pooler.supabase.com>"
 *     $env:ADMIN_EMAIL             = "you@company.com"
 *     $env:ADMIN_NAME              = "Your Name"
 *     $env:ADMIN_PASSWORD          = Read-Host "Admin password"
 *     npm run admin:create
 *
 * Safety (see scripts/lib/admin-bootstrap.ts):
 *  - refuses LOCAL hosts unless ADMIN_ALLOW_LOCAL=1;
 *  - requires ADMIN_BOOTSTRAP_CONFIRM to equal the target hostname;
 *  - NEVER overwrites or promotes an existing account (an existing ADMIN can
 *    only be password-rotated with ADMIN_ROTATE_EXISTING=1);
 *  - refuses a second admin unless ADMIN_ALLOW_ADDITIONAL=1;
 *  - rejects weak or known-exposed passwords;
 *  - the new admin must change the password at first login (mustChangePassword).
 * Never prints the password, hash, or connection string. Run `npm run db:target`
 * first to confirm which database will be used.
 */
import { formatTarget } from "./lib/db-url";
import { preflight } from "./lib/admin-bootstrap";
import { applyBootstrap } from "./lib/admin-bootstrap-apply";
import { securityEvent } from "../lib/utils/security-log";

// Captured before ANY .env loading. Note: importing @prisma/client also loads
// .env, so Prisma and dotenv are imported lazily inside main(), after this line.
const urlFromShell = process.env.DATABASE_URL;

function fail(msg: string): never {
  console.error(`[admin:create] ${msg}`);
  process.exit(1);
}

async function main() {
  await import("dotenv/config");
  const [{ default: bcrypt }, { PrismaClient }] = await Promise.all([import("bcryptjs"), import("@prisma/client")]);

  const env = process.env;
  const pre = preflight(env);
  console.log(`[admin:create] database: ${formatTarget(pre.target)}  (from ${urlFromShell ? "shell environment" : ".env file"})`);
  if (!pre.ok) {
    securityEvent("ADMIN_BOOTSTRAP_REFUSED", { code: pre.code, host: pre.target?.host ?? null });
    fail(pre.message);
  }

  const prisma = new PrismaClient();
  try {
    const passwordHash = await bcrypt.hash(pre.password, 12);
    const result = await applyBootstrap(prisma, { email: pre.email, name: pre.name, passwordHash, env });
    if (!result.ok) {
      securityEvent("ADMIN_BOOTSTRAP_REFUSED", { code: result.decision.code, host: pre.target.host });
      fail(result.decision.message);
    }
    console.log(
      `[admin:create] ${result.action === "rotate" ? "rotated" : "created"}: ${result.email} (ADMIN, APPROVED) — password change required at first login.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => fail(err instanceof Error ? err.message : "failed"));
