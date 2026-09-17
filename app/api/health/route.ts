import { NextResponse } from "next/server";
import { getBootState } from "@/lib/config/boot-state";
import { checkDatabase } from "@/lib/db/health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/health — uptime probe for load balancers / monitors.
 *  200  app + database respond
 *  503  database down, or the deployment is misconfigured (lists the failing
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
  const body = { ok: db.ok, status: db.ok ? "ok" : "database-down", db: db.ok ? "up" : "down", latencyMs: db.latencyMs, time: new Date().toISOString() };
  return NextResponse.json(body, { status: db.ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
