/**
 * Dev-only helper: runs a real PostgreSQL server locally using the
 * `embedded-postgres` package, so the project can be developed and tested on
 * machines without a system-wide Postgres or Docker install.
 *
 * Usage:  npm run db:local
 * Then point DATABASE_URL at:
 *   postgresql://postgres:postgres@localhost:5433/localgrowth?schema=public
 *
 * Any hosted PostgreSQL (Neon, Supabase, Railway, Vercel Postgres) works the
 * same way in production — this script is never used there.
 */
import EmbeddedPostgres from "embedded-postgres";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";

const PORT = Number(process.env.LOCAL_PG_PORT ?? 5433);
const DATA_DIR = path.resolve(process.cwd(), ".localdb", "data");
const DB_NAMES = ["localgrowth", "localgrowth_test", "localgrowth_e2e"];

async function portInUse(port: number): Promise<boolean> {
  const net = await import("node:net");
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    socket.once("connect", () => { socket.destroy(); resolve(true); });
    socket.once("error", () => resolve(false));
  });
}

function keepAlive() {
  setInterval(() => {}, 1 << 30);
}

async function main() {
  if (await portInUse(PORT)) {
    console.log(`[local-db] PostgreSQL already running on localhost:${PORT} — reusing it.`);
    keepAlive();
    return;
  }
  // Remove a stale lock left behind by an unclean shutdown.
  const pidFile = path.join(DATA_DIR, "postmaster.pid");
  if (existsSync(pidFile)) {
    console.log("[local-db] Removing stale postmaster.pid");
    rmSync(pidFile, { force: true });
  }

  const pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: "postgres",
    password: "postgres",
    port: PORT,
    persistent: true,
    // UTF-8 regardless of the OS locale so ₹ and other symbols round-trip.
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    onLog: () => {},
    onError: (m) => console.error(String(m)),
  });

  const initialised = existsSync(path.join(DATA_DIR, "PG_VERSION"));
  if (!initialised) {
    console.log(`[local-db] Initialising cluster in ${DATA_DIR} ...`);
    await pg.initialise();
  }

  await pg.start();
  console.log(`[local-db] PostgreSQL listening on localhost:${PORT}`);

  const client = pg.getPgClient("postgres");
  await client.connect();
  for (const name of DB_NAMES) {
    const { rowCount } = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [name],
    );
    if (!rowCount) {
      await client.query(`CREATE DATABASE "${name}"`);
      console.log(`[local-db] Created database "${name}"`);
    }
  }
  await client.end();

  console.log(
    `[local-db] DATABASE_URL=postgresql://postgres:postgres@localhost:${PORT}/localgrowth?schema=public`,
  );
  console.log("[local-db] Press Ctrl+C to stop.");

  const shutdown = async () => {
    console.log("\n[local-db] Stopping ...");
    await pg.stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  keepAlive();
}

main().catch((err) => {
  console.error("[local-db] Failed:", err);
  process.exit(1);
});
