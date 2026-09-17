import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { TEST_DATABASE_URL } from "./test-db-url";

/**
 * Applies migrations to the dedicated test database and clears rows left by
 * a previous run. Uses ordinary deletes (cascades from users) rather than a
 * schema reset, so it can never touch anything but test data.
 */
export default async function setup() {
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  });

  const prisma = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });
  try {
    await prisma.auditLog.deleteMany();
    await prisma.emailOutbox.deleteMany(); // userId is SetNull on user delete, so clear explicitly
    await prisma.user.deleteMany(); // cascades to brands, products, campaigns, links, referrals, ledgers
  } finally {
    await prisma.$disconnect();
  }
}
