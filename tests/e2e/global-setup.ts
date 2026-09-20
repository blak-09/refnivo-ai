import { execSync } from "node:child_process";
import { Client } from "pg";
import { PrismaClient } from "@prisma/client";

/**
 * Prepares the dedicated e2e database: creates it if missing, applies the
 * migrations and clears rows from a previous run. Everything the specs create
 * uses unique e-mails, so this only ever touches e2e data.
 */
export const E2E_DATABASE_URL = process.env.E2E_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5433/localgrowth_e2e?schema=public";

export default async function globalSetup() {
  const url = new URL(E2E_DATABASE_URL);
  const dbName = url.pathname.replace(/^\//, "");
  const admin = new Client({ connectionString: `${url.protocol}//${url.username}:${url.password}@${url.host}/postgres` });
  await admin.connect();
  try {
    const exists = await admin.query("select 1 from pg_database where datname = $1", [dbName]);
    if (!exists.rowCount) await admin.query(`create database "${dbName}"`);
  } finally {
    await admin.end();
  }

  execSync("npx prisma migrate deploy", { stdio: "inherit", env: { ...process.env, DATABASE_URL: E2E_DATABASE_URL } });

  const prisma = new PrismaClient({ datasources: { db: { url: E2E_DATABASE_URL } } });
  try {
    await prisma.auditLog.deleteMany();
    await prisma.emailOutbox.deleteMany();
    await prisma.user.deleteMany(); // cascades to brands, products, campaigns, links, referrals, ledgers
  } finally {
    await prisma.$disconnect();
  }
}
