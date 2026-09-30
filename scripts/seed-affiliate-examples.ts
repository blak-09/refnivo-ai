/**
 * Verified external programme listings: `npm run db:seed:affiliate-examples`
 *
 * Inserts the entries in prisma/seed-data/affiliate-programs.ts that are not in
 * the database yet — published and verified as of each entry's check date.
 * Existing rows are never overwritten. Local databases only — production
 * receives the same rows through the reviewed SQL script (see docs/PRODUCTION.md).
 */
import { PrismaClient } from "@prisma/client";
import { seedExampleAffiliatePrograms } from "../prisma/seed-data/affiliate-programs";
import { assertLocalTarget, formatTarget } from "./lib/db-url";

async function main() {
  await import("dotenv/config");
  const verdict = assertLocalTarget(process.env.DATABASE_URL, process.env.NODE_ENV);
  console.log(`[affiliate-examples] target : ${formatTarget(verdict.target)}`);
  if (!verdict.ok) {
    console.error(`[affiliate-examples] refused — ${verdict.reason}`);
    process.exit(1);
  }
  const prisma = new PrismaClient();
  try {
    const result = await prisma.$transaction((tx) => seedExampleAffiliatePrograms(tx));
    console.log(`[affiliate-examples] created: ${result.created.join(", ") || "none"} | already present: ${result.skipped.join(", ") || "none"}`);
    if (result.created.length) console.log("[affiliate-examples] published as verified; manage them in Admin → Affiliate programs.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[affiliate-examples] failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
