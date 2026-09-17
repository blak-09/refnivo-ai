/**
 * Local-only Prisma commands: `npm run db:push:local`, `npm run db:reset:local`,
 * `npm run db:migrate`.
 *
 * These commands can rewrite or drop a database, so they only ever run against
 * localhost. There is deliberately NO override flag: a remote host, a
 * production NODE_ENV, or an unparseable/missing DATABASE_URL always refuses.
 * The sub-command comes from a fixed allow-list, never from user input.
 */
import { execSync } from "node:child_process";
import { assertLocalTarget, formatTarget } from "./lib/db-url";
import { LOCAL_ONLY_COMMANDS } from "./lib/local-only-commands";

function fail(msg: string): never {
  console.error(`[db-local-only] ${msg}`);
  process.exit(1);
}

async function main() {
  const which = process.argv[2] ?? "";
  const command = LOCAL_ONLY_COMMANDS[which];
  if (!command) fail(`unknown command "${which}". Expected one of: ${Object.keys(LOCAL_ONLY_COMMANDS).join(", ")}.`);

  await import("dotenv/config");
  const verdict = assertLocalTarget(process.env.DATABASE_URL, process.env.NODE_ENV);
  console.log(`[db-local-only] target : ${formatTarget(verdict.target)}`);
  if (!verdict.ok) fail(`refused — ${verdict.reason}`);

  console.log(`[db-local-only] running: ${command}`);
  execSync(command, { stdio: "inherit", env: process.env });
}

main().catch((err) => fail(err instanceof Error ? err.message : "failed"));
