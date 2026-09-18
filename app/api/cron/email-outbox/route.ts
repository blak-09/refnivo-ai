import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { dispatchPendingEmails, outboxCounts } from "@/lib/email/outbox";
import { logServerError } from "@/lib/utils/server-log";
import { securityEvent } from "@/lib/utils/security-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorised(header: string | null, secret: string | undefined): boolean {
  if (!secret || !header?.startsWith("Bearer ")) return false;
  const given = Buffer.from(header.slice(7));
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * GET /api/cron/email-outbox — retry safety net for the transactional e-mail
 * outbox (first attempts happen right after each commit; this catches
 * failures and abandoned claims). Called by Vercel Cron (which sends
 * `Authorization: Bearer $CRON_SECRET` automatically) and/or the GitHub
 * Actions schedule in `.github/workflows/email-outbox.yml`.
 * Returns counts only — never addresses or bodies.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET is not configured." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  if (!authorised(request.headers.get("authorization"), secret)) {
    securityEvent("RATE_LIMITED", { scope: "cron", reason: "UNAUTHORISED" });
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  try {
    const before = await outboxCounts();
    const dispatched = await dispatchPendingEmails({ limit: 200 });
    const after = await outboxCounts();
    return NextResponse.json({ ok: true, before, dispatched, after, time: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const summary = logServerError("cron.email-outbox", err);
    return NextResponse.json({ ok: false, error: summary.code ?? summary.name ?? "failed" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
