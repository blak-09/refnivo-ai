import { NextResponse } from "next/server";
import { getBootState } from "@/lib/config/boot-state";
import { describeDatabaseTarget } from "@/lib/config/database-url";
import { checkDatabase, checkSchema } from "@/lib/db/health";
import { describeStorage } from "@/lib/storage/availability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/health — uptime probe for load balancers / monitors.
 *  200  app + database respond
 *  503  database down (coarse reason + error code + hint, never host or
 *       credentials), or the deployment is misconfigured (lists the failing
 *       rules by variable NAME so an operator can fix it without log access;
 *       values are never included)
 * Deliberately exposes no versions, hostnames or env values.
 */
export async function GET() {
  const boot = getBootState();
  if (!boot.ok) {
    return NextResponse.json(
      { ok: false, status: "misconfigured", errors: boot.errors, checkedAt: boot.checkedAt, time: new Date().toISOString() },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  const db = await checkDatabase();
  const schema = db.ok ? await checkSchema() : null;
  const body = db.ok
    ? {
        ok: true,
        status: schema?.ok ? "ok" : "schema-behind",
        db: "up",
        // Whether the newest migration the code needs has been applied (name only).
        schema: schema?.ok ? "current" : "behind",
        ...(schema && !schema.ok ? { missingMigration: schema.missing, hint: schema.hint } : {}),
        // Non-fatal configuration gaps (rate limiting, e-mail, storage, cron) — rule text only, never values.
        ...(boot.warnings.length ? { warnings: boot.warnings } : {}),
        // Where uploads go (provider, project host, bucket) — no keys.
        storage: describeStorage(process.env),
        latencyMs: db.latencyMs,
        time: new Date().toISOString(),
      }
    : {
        ok: false,
        status: "database-down",
        db: "down",
        reason: db.reason,
        code: db.code,
        hint: db.hint,
        // Where the app is trying to connect (host/port/database, masked user) — never the password.
        target: describeDatabaseTarget(process.env.DATABASE_URL),
        latencyMs: db.latencyMs,
        time: new Date().toISOString(),
      };
  return NextResponse.json(body, { status: db.ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
