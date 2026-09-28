import { createHmac, timingSafeEqual } from "node:crypto";
import type { PaymentStatus } from "@prisma/client";
import {
  PaymentProviderError,
  type CheckoutResult,
  type CreateOrderInput,
  type CreatedOrder,
  type PaymentProvider,
  type ProviderPayment,
  type RefundResult,
  type WebhookEvent,
} from "./provider";

/**
 * Razorpay adapter — plain REST over fetch, like the Resend and Upstash drivers.
 * No SDK, so there is no vendored code to audit and the surface stays small.
 *
 * Signatures (both HMAC-SHA256 with the relevant secret):
 *   checkout  — hex over `${order_id}|${payment_id}`, compared in constant time
 *   webhook   — hex over the RAW request body, with the webhook secret
 *
 * Amounts are integer paise on both sides, so no conversion is needed.
 * The secret never leaves the server: only `key_id` is published to the browser.
 */
const API = "https://api.razorpay.com/v1";

export type FetchLike = (input: string, init: { method: string; headers: Record<string, string>; body?: string }) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

/** Razorpay payment states → our lifecycle. `authorized` is money held, not captured: still PROCESSING. */
export function mapRazorpayStatus(status: string, amountRefunded = 0, amount = 0): PaymentStatus {
  switch (status) {
    case "captured":
      if (amountRefunded > 0 && amountRefunded >= amount) return "REFUNDED";
      if (amountRefunded > 0) return "PARTIALLY_REFUNDED";
      return "PAID";
    case "authorized":
    case "created":
      return "PROCESSING";
    case "failed":
      return "FAILED";
    case "refunded":
      return "REFUNDED";
    default:
      return "PROCESSING";
  }
}

/** Constant-time hex compare that never throws on malformed input. */
export function safeEqualHex(a: string, b: string): boolean {
  const x = Buffer.from(a ?? "", "utf8");
  const y = Buffer.from(b ?? "", "utf8");
  if (x.length !== y.length || x.length === 0) return false;
  return timingSafeEqual(x, y);
}

export function razorpaySignature(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

type RazorpayPayment = {
  id: string;
  order_id: string | null;
  status: string;
  amount: number;
  currency: string;
  method?: string | null;
  error_code?: string | null;
  error_description?: string | null;
  amount_refunded?: number;
};

function toProviderPayment(p: RazorpayPayment): ProviderPayment {
  return {
    providerPaymentId: p.id,
    providerOrderId: p.order_id ?? null,
    status: mapRazorpayStatus(p.status, p.amount_refunded ?? 0, p.amount),
    amount: p.amount,
    currency: p.currency,
    method: p.method ?? null,
    failureCode: p.error_code ?? null,
    // Razorpay's description is written for payers and carries no internals; still capped.
    failureReason: p.error_description ? p.error_description.slice(0, 200) : null,
    refundedAmount: p.amount_refunded ?? 0,
  };
}

export class RazorpayProvider implements PaymentProvider {
  readonly key = "RAZORPAY";

  constructor(
    private readonly keyId: string,
    private readonly keySecret: string,
    private readonly webhookSecret: string,
    private readonly fetchImpl: FetchLike = fetch as unknown as FetchLike,
    private readonly timeoutMs = 10_000,
  ) {}

  publicKey(): string {
    return this.keyId;
  }

  private async call<T>(path: string, method: "GET" | "POST", body?: unknown): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.fetchImpl(`${API}${path}`, {
        method,
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.keyId}:${this.keySecret}`).toString("base64")}`,
          "Content-Type": "application/json",
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const text = await res.text();
      if (!res.ok) {
        // The provider's message goes to the server log only.
        throw new PaymentProviderError(`razorpay ${method} ${path} -> ${res.status}: ${text.slice(0, 300)}`);
      }
      return JSON.parse(text) as T;
    } catch (err) {
      if (err instanceof PaymentProviderError) throw err;
      throw new PaymentProviderError(`razorpay ${method} ${path} failed: ${err instanceof Error ? err.message : "unknown error"}`);
    } finally {
      clearTimeout(timer);
    }
  }

  async createOrder(input: CreateOrderInput): Promise<CreatedOrder> {
    const order = await this.call<{ id: string; amount: number; currency: string }>("/orders", "POST", {
      amount: input.amount,
      currency: input.currency,
      receipt: input.reference,
      notes: input.notes ?? {},
    });
    return { providerOrderId: order.id, publicKey: this.keyId, amount: order.amount, currency: order.currency };
  }

  verifyCheckoutSignature(result: CheckoutResult): boolean {
    if (!result.providerOrderId || !result.providerPaymentId || !result.signature) return false;
    const expected = razorpaySignature(`${result.providerOrderId}|${result.providerPaymentId}`, this.keySecret);
    return safeEqualHex(expected, result.signature);
  }

  async getPayment(providerPaymentId: string): Promise<ProviderPayment> {
    return toProviderPayment(await this.call<RazorpayPayment>(`/payments/${encodeURIComponent(providerPaymentId)}`, "GET"));
  }

  parseWebhook(rawBody: string, signature: string | null): WebhookEvent | null {
    if (!signature) return null;
    if (!safeEqualHex(razorpaySignature(rawBody, this.webhookSecret), signature)) return null;

    let body: { event?: string; payload?: { payment?: { entity?: RazorpayPayment }; order?: { entity?: { id?: string } } } };
    try {
      body = JSON.parse(rawBody);
    } catch {
      return null;
    }
    const type = body.event ?? "unknown";
    const entity = body.payload?.payment?.entity;
    const payment = entity?.id ? toProviderPayment(entity) : null;
    return {
      // Razorpay sends x-razorpay-event-id; the digest of the verified body is an
      // equally unique fallback, so idempotency never depends on an optional header.
      id: `razorpay:${razorpaySignature(rawBody, this.webhookSecret).slice(0, 32)}`,
      type,
      payment,
      providerOrderId: payment?.providerOrderId ?? body.payload?.order?.entity?.id ?? null,
    };
  }

  async refund(input: { providerPaymentId: string; amount: number; reference: string }): Promise<RefundResult> {
    const refund = await this.call<{ id: string; amount: number; status: string }>(`/payments/${encodeURIComponent(input.providerPaymentId)}/refund`, "POST", {
      amount: input.amount,
      speed: "normal",
      notes: { reference: input.reference },
    });
    const state = refund.status === "processed" ? "done" : refund.status === "failed" ? "failed" : refund.status === "pending" ? "pending" : "processing";
    return { providerRefundId: refund.id, amount: refund.amount, state };
  }
}
