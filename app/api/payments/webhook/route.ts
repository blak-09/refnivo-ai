import { NextResponse, type NextRequest } from "next/server";
import { getPaymentProvider } from "@/lib/payments";
import { handleWebhookEvent } from "@/lib/services/payments";
import { securityEvent } from "@/lib/utils/security-log";

/**
 * Provider webhook — the authoritative path for payment outcomes.
 *
 *   provider → verify signature over the RAW body → record the event
 *            → find the transaction → update it (idempotently)
 *
 * Notes:
 *  - the raw text is read before any parsing, because the signature covers the
 *    exact bytes sent;
 *  - an unsigned or badly signed request is rejected with 401 and never parsed
 *    into anything that could change state;
 *  - a replayed event is accepted with 200 (so the provider stops retrying) but
 *    changes nothing — the unique event id short-circuits it;
 *  - unknown event types are acknowledged, not treated as failures.
 */
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const provider = getPaymentProvider();
  if (!provider) return NextResponse.json({ ok: false, error: "payments disabled" }, { status: 503 });

  const raw = await req.text();
  const signature = req.headers.get("x-razorpay-signature");
  const event = provider.parseWebhook(raw, signature);
  if (!event) {
    securityEvent("PAYMENT_WEBHOOK_REJECTED", { reason: signature ? "bad signature" : "missing signature" });
    return NextResponse.json({ ok: false, error: "invalid signature" }, { status: 401 });
  }

  try {
    const result = await handleWebhookEvent(event, provider.key, JSON.parse(raw));
    return NextResponse.json({ ok: true, applied: result.applied });
  } catch (err) {
    // 500 asks the provider to retry; the event id keeps that retry idempotent.
    console.error("[payments] webhook failed", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
