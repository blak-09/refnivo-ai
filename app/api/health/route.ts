import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/guards";
import { getBootState } from "@/lib/config/boot-state";
import { describeDatabaseTarget } from "@/lib/config/database-url";
import { checkDatabase, checkSchema } from "@/lib/db/health";
import { describeStorage } from "@/lib/storage/availability";
import { SOCIAL_PLATFORMS, getSocialProvider } from "@/lib/social";
import { probeRateLimitStore } from "@/lib/utils/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Same-length constant-time compare for the optional HEALTH_TOKEN header. */
function tokenMatches(given: string | null, expected: string | undefined): boolean {
  if (!given || !expected) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Details (storage host, providers, warnings, DB target) only for admins or a monitor holding HEALTH_TOKEN. */
async function canSeeDetails(request: Request): Promise<boolean> {
  if (tokenMatches(request.headers.get("x-health-token"), process.env.HEALTH_TOKEN?.trim() || undefined)) return true;
  try {
    const user = await getCurrentUser();
    return user?.role === "ADMIN";
  } catch {
    return false;
  }
}

/**
 * GET /api/health — uptime probe for load balancers / monitors.
 *  200  app + database respond
 *  503  database down, or the deployment is misconfigured
 *
 * The public answer is only `{ ok, status, db, schema, time }`. Operator
 * details (failing rules by variable NAME, schema hint, warnings, storage
 * host/bucket, limiter store, social providers, masked DB target) are added
 * for a signed-in admin or a request carrying `x-health-token: $HEALTH_TOKEN`
 * (docs/AUDIT.md W11). Never versions, credentials or env values.
 */
export async function GET(request: Request) {
  const boot = getBootState();
  const details = await canSeeDetails(request);
  if (!boot.ok) {
    return NextResponse.json(
      details
        ? { ok: false, status: "misconfigured", errors: boot.errors, checkedAt: boot.checkedAt, time: new Date().toISOString() }
        : { ok: false, status: "misconfigured", time: new Date().toISOString() },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  const db = await checkDatabase();
  const schema = db.ok ? await checkSchema() : null;
  if (!details) {
    const body = db.ok
      ? { ok: true, status: schema?.ok ? "ok" : "schema-behind", db: "up", schema: schema?.ok ? "current" : "behind", time: new Date().toISOString() }
      : { ok: false, status: "database-down", db: "down", time: new Date().toISOString() };
    return NextResponse.json(body, { status: db.ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
  }
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
        // Which limiter store is actually answering (fail-open hides provider errors from users).
        rateLimit: await probeRateLimitStore(),
        // Which social platforms creators can connect (true = both keys and the encryption key are set). No values.
        social: Object.fromEntries(SOCIAL_PLATFORMS.map((p) => [p.toLowerCase(), getSocialProvider(p) !== null])),
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
