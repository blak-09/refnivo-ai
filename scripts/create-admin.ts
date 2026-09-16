/**
 * Production admin bootstrap: `npm run admin:create`
 *
 * Creates (or promotes) an APPROVED admin account from environment variables
 * so no password ever appears in a shell history, chat, or log:
 *
 *   PowerShell:
 *     $env:DATABASE_URL   = "<production URL>"
 *     $env:ADMIN_EMAIL    = "you@company.com"
 *     $env:ADMIN_NAME     = "Your Name"
 *     $env:ADMIN_PASSWORD = Read-Host "Admin password"
 *     npm run admin:create
 *
 * Requires DATABASE_URL and refuses LOCAL hosts unless ADMIN_ALLOW_LOCAL=1 (so a
 * missing shell variable can never silently target the dev database). Idempotent:
 * re-running updates the password/name and ensures role ADMIN + status APPROVED.
 * Never prints the password or hash. Run `npm run db:target` first to confirm
 * which database will be used.
 */
import { describeDatabaseUrl, formatTarget } from "./lib/db-url";

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

  const email = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const name = (process.env.ADMIN_NAME ?? "Platform Admin").trim();
  const password = process.env.ADMIN_PASSWORD ?? "";

  if (!process.env.DATABASE_URL) fail("DATABASE_URL is not set.");
  const target = describeDatabaseUrl(process.env.DATABASE_URL);
  console.log(`[admin:create] database: ${formatTarget(target)}  (from ${urlFromShell ? "shell environment" : ".env file"})`);
  if (target?.local && process.env.ADMIN_ALLOW_LOCAL !== "1") {
    fail("Refusing to create an admin on a LOCAL database. Set $env:DATABASE_URL to the production URL in this shell, or set ADMIN_ALLOW_LOCAL=1 for local development.");
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail("ADMIN_EMAIL is missing or invalid.");
  if (password.length < 12 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    fail("ADMIN_PASSWORD must be at least 12 characters and include a letter and a number.");
  }
  if (email.endsWith("@localgrowth.demo")) fail("Refusing to create an admin on the demo email domain.");

  const prisma = new PrismaClient();
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.$transaction(async (tx) => {
      const admin = await tx.user.upsert({
        where: { email },
        create: { name, email, passwordHash, role: "ADMIN", status: "APPROVED", approvedAt: new Date() },
        update: { name, passwordHash, role: "ADMIN", status: "APPROVED", approvedAt: new Date(), rejectedAt: null, rejectionReason: null },
        select: { id: true, email: true, role: true, status: true },
      });
      await tx.auditLog.create({
        data: { userId: admin.id, action: "ADMIN_BOOTSTRAPPED", entityType: "User", entityId: admin.id, metadata: { via: "scripts/create-admin.ts" } },
      });
      return admin;
    });
    console.log(`[admin:create] ready: ${user.email} (${user.role}, ${user.status})`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => fail(err instanceof Error ? err.message : "failed"));
