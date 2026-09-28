/**
 * Dev-only: waits until the database answers a query, then exits 0.
 *
 * `npm run dev:all` starts the embedded Postgres and `next dev` together. The
 * port opens before Postgres accepts queries ("the database system is starting
 * up"), so a port check is not enough — this runs a real `SELECT 1`. Without it,
 * the first requests (or a background cache revalidation) hit a starting
 * database and surface a PrismaClientInitializationError in the dev overlay.
 *
 * Only waits for local databases; any other target returns immediately.
 */
import { PrismaClient } from "@prisma/client";
import { assertLocalTarget } from "./lib/db-url";

const TIMEOUT_MS = Number(process.env.WAIT_FOR_DB_TIMEOUT_MS ?? 90_000);
const INTERVAL_MS = 500;

async function main() {
  await import("dotenv/config");
  if (!assertLocalTarget(process.env.DATABASE_URL, process.env.NODE_ENV).ok) return;

  const started = Date.now();
  let lastError = "";
  while (Date.now() - started < TIMEOUT_MS) {
    const prisma = new PrismaClient();
    try {
      await prisma.$queryRaw`SELECT 1`;
      console.log(`[wait-for-db] database ready after ${((Date.now() - started) / 1000).toFixed(1)}s`);
      return;
    } catch (err) {
      lastError = err instanceof Error ? err.message.split("\n").filter(Boolean).pop() ?? err.message : String(err);
    } finally {
      await prisma.$disconnect().catch(() => {});
    }
    await new Promise((r) => setTimeout(r, INTERVAL_MS));
  }
  // Start the web server anyway; the app degrades gracefully without a database.
  console.warn(`[wait-for-db] gave up after ${TIMEOUT_MS / 1000}s (${lastError}) — starting anyway.`);
}

main().catch((err) => {
  console.warn("[wait-for-db] skipped:", err instanceof Error ? err.message : err);
});
