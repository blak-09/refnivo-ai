/**
 * Diagnostic: `npm run db:target`
 * Shows which DATABASE_URL the scripts will use and where it came from
 * (shell environment vs .env file). Prints host/port/database only — never
 * the username or password. Run this before any production script.
 */
import { describeDatabaseUrl, formatTarget } from "./lib/db-url";

// Capture BEFORE dotenv runs so we can tell shell vs file.
const fromShell = process.env.DATABASE_URL;

async function main() {
  await import("dotenv/config");
  const effective = process.env.DATABASE_URL;

  const source = fromShell ? "shell environment ($env:DATABASE_URL / export)" : effective ? ".env file (no shell variable was set)" : "nowhere — DATABASE_URL is not set";
  console.log(`[db-target] source : ${source}`);
  console.log(`[db-target] target : ${formatTarget(describeDatabaseUrl(effective))}`);

  const t = describeDatabaseUrl(effective);
  if (t?.local) {
    console.log("[db-target] note   : this is the LOCAL development database. For production, set $env:DATABASE_URL in the SAME shell session before running the script.");
  } else if (t && t.port === "6543" && !t.pgbouncer) {
    console.log("[db-target] warn   : port 6543 is a transaction pooler — append ?pgbouncer=true or Prisma will fail with a prepared-statement error.");
  }
}

main();
