import { NextResponse } from "next/server";
import { checkDatabase } from "@/lib/db/health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/health — uptime probe for load balancers / monitors.
 * Returns 200 when the app and database respond, 503 otherwise.
 * Deliberately exposes no versions, hostnames, env values or error text.
 */
export async function GET() {
  const db = await checkDatabase();
  const body = { ok: db.ok, db: db.ok ? "up" : "down", latencyMs: db.latencyMs, time: new Date().toISOString() };
  return NextResponse.json(body, { status: db.ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
