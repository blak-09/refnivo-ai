/**
 * Admin account diagnosis: `npm run admin:check`
 *
 * Read-only. Explains why an admin cannot sign in and what to do about it,
 * without printing any secret (no password, no hash, no connection string).
 *
 *   PowerShell:
 *     $env:DATABASE_URL = Read-Host "Production DATABASE_URL"   # same value as Vercel
 *     $env:ADMIN_EMAIL  = "you@company.com"                     # optional: check one account
 *     npm run admin:check
 *
 * Reports every ADMIN account (or the given e-mail): status, whether a
 * password is set, forced rotation, Google link, last login, and the exact
 * next step (create with `admin:create`, rotate with ADMIN_ROTATE_EXISTING=1,
 * reactivate from /dashboard/admin/users, …). Also checks that the database
 * schema has the migrations this build requires.
 */
import { normalizeDatabaseUrl } from "../lib/config/database-url";
import { describeDatabaseUrl, formatTarget } from "./lib/db-url";

const REQUIRED_MIGRATION = "20260918120000_google_oauth";

function fail(msg: string): never {
  console.error(`[admin:check] ${msg}`);
  process.exit(1);
}

async function main() {
  await import("dotenv/config");
  const { PrismaClient } = await import("@prisma/client");
  if (process.env.DATABASE_URL) process.env.DATABASE_URL = normalizeDatabaseUrl(process.env.DATABASE_URL);
  const target = describeDatabaseUrl(process.env.DATABASE_URL);
  if (!target || !target.ok) fail("DATABASE_URL is not set or could not be parsed.");
  console.log(`[admin:check] database: ${formatTarget(target)}`);

  const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });
  try {
    const migrated = await prisma.$queryRaw<{ n: number }[]>`
      SELECT COUNT(*)::int AS n FROM "_prisma_migrations" WHERE "migration_name" = ${REQUIRED_MIGRATION} AND "finished_at" IS NOT NULL`;
    console.log(`[admin:check] schema: ${Number(migrated[0]?.n) > 0 ? "current" : `BEHIND — run npm run db:deploy (missing ${REQUIRED_MIGRATION})`}`);

    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const users = await prisma.user.findMany({
      where: email ? { email } : { role: "ADMIN" },
      orderBy: { createdAt: "asc" },
      select: {
        email: true,
        role: true,
        status: true,
        passwordHash: true,
        mustChangePassword: true,
        sessionVersion: true,
        lastLoginAt: true,
        suspendedAt: true,
        createdAt: true,
        oauthAccounts: { select: { provider: true } },
      },
    });

    if (!users.length) {
      console.log(email ? `[admin:check] no account with e-mail ${mask(email)}.` : "[admin:check] no ADMIN account exists in this database.");
      console.log("  → create one: powershell -ExecutionPolicy Bypass -File scripts\\create-admin.ps1");
      return;
    }

    for (const u of users) {
      const google = u.oauthAccounts.some((a) => a.provider === "google");
      console.log(`\n[admin:check] ${mask(u.email)}  role=${u.role}  status=${u.status}  created=${u.createdAt.toISOString().slice(0, 10)}`);
      console.log(`  password set: ${u.passwordHash ? "yes" : "NO"}   google linked: ${google ? "yes" : "no"}   must change password: ${u.mustChangePassword ? "yes" : "no"}   sessionVersion: ${u.sessionVersion}   last login: ${u.lastLoginAt?.toISOString() ?? "never"}`);
      const steps: string[] = [];
      if (u.role !== "ADMIN") steps.push("this account is not an admin — admin:create never promotes existing accounts; use a different e-mail or ask an existing admin");
      if (u.status === "SUSPENDED") steps.push("suspended — reactivate it from another admin's /dashboard/admin/users, or rotate with admin:create + ADMIN_ROTATE_EXISTING=1 (does not change status)");
      if (u.status === "PENDING" || u.status === "REJECTED") steps.push(`status ${u.status} — only APPROVED accounts can sign in`);
      if (!u.passwordHash) steps.push("no password: sign in with Google (linked) or set a password via admin:create with ADMIN_ROTATE_EXISTING=1");
      if (u.passwordHash && u.mustChangePassword) steps.push("first sign-in will land on Settings and require the bootstrap password + a new one; if the bootstrap password is lost, rotate: $env:ADMIN_ROTATE_EXISTING='1' before admin:create");
      if (u.passwordHash && !u.mustChangePassword && u.status === "APPROVED" && u.role === "ADMIN") steps.push("account is healthy — a login failure means wrong password (rotate with ADMIN_ROTATE_EXISTING=1) or the 10-attempts/10-minutes login limit; also make sure the Vercel DATABASE_URL points at THIS database");
      for (const s of steps) console.log(`  → ${s}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

function mask(email: string): string {
  const [user, domain] = email.split("@");
  return `${user.slice(0, 2)}***@${domain ?? ""}`;
}

main().catch((err) => fail(err instanceof Error ? err.message : "failed"));
