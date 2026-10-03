import { NextResponse, type NextRequest } from "next/server";
import { getPayoutProvider } from "@/lib/payouts";
import { handlePayoutWebhook } from "@/lib/services/auto-payouts";
import { securityEvent } from "@/lib/utils/security-log";

/**
 * RazorpayX payout webhook (payout.processed / failed / reversed / rejected …).
 *
 * The signature covers the raw bytes, so the body is read as text first. A bad
 * or missing signature is rejected without parsing. Outcomes are applied
 * through the payout state machine, which only moves PROCESSING requests — a
 * replayed event changes nothing.
 */
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const provider = getPayoutProvider();
  if (!provider) return NextResponse.json({ ok: false, error: "automatic payouts disabled" }, { status: 503 });

  const raw = await req.text();
  const signature = req.headers.get("x-razorpay-signature");
  if (!provider.verifyWebhookSignature(raw, signature)) {
    securityEvent("PAYOUT_WEBHOOK_REJECTED", { reason: signature ? "bad signature" : "missing signature" });
    return NextResponse.json({ ok: false, error: "invalid signature" }, { status: 401 });
  }

  try {
    const { event, payout } = provider.parseWebhook(raw);
    const result = await handlePayoutWebhook(event, payout);
    return NextResponse.json({ ok: true, applied: result.applied });
  } catch (err) {
    console.error("[payouts] webhook failed", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
