import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * RazorpayX Payouts adapter: contacts, fund accounts, payouts, webhooks.
 *
 * It only translates RazorpayX's API — it never touches the database and never
 * decides what a payout means for the ledger (lib/services/auto-payouts.ts does).
 * Docs: https://razorpay.com/docs/api/x/
 */
type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export type ProviderPayoutStatus = "queued" | "pending" | "rejected" | "processing" | "processed" | "cancelled" | "reversed" | "failed" | "scheduled";

export type ProviderPayout = {
  id: string;
  status: ProviderPayoutStatus;
  /** Integer paise. */
  amount: number;
  /** Bank / UPI reference once processed. */
  utr: string | null;
  referenceId: string | null;
  failureReason: string | null;
};

/** Outcome unknown (network / 5xx): the payout may or may not exist — retry with the same idempotency key. */
export class PayoutProviderUnavailable extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PayoutProviderUnavailable";
  }
}

/** RazorpayX refused the request (4xx): nothing was created by this call. */
export class PayoutProviderRejected extends Error {
  constructor(
    message: string,
    readonly publicMessage: string,
  ) {
    super(message);
    this.name = "PayoutProviderRejected";
  }
}

export const FINAL_FAILED: ProviderPayoutStatus[] = ["rejected", "cancelled", "reversed", "failed"];

export class RazorpayXProvider {
  readonly key = "RAZORPAYX";
  private readonly base = "https://api.razorpay.com/v1";

  constructor(
    private readonly keyId: string,
    private readonly keySecret: string,
    private readonly accountNumber: string,
    private readonly webhookSecret: string,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  private async call<T>(path: string, init: { method: "GET" | "POST"; body?: unknown; idempotencyKey?: string }): Promise<T> {
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.base}${path}`, {
        method: init.method,
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.keyId}:${this.keySecret}`).toString("base64")}`,
          "Content-Type": "application/json",
          ...(init.idempotencyKey ? { "X-Payout-Idempotency": init.idempotencyKey } : {}),
        },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        signal: AbortSignal.timeout(20_000),
      });
    } catch (err) {
      throw new PayoutProviderUnavailable(`razorpayx ${path}: ${err instanceof Error ? err.message : String(err)}`);
    }
    const text = await res.text();
    const json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    if (res.status >= 500 || res.status === 429) throw new PayoutProviderUnavailable(`razorpayx ${path}: HTTP ${res.status}`);
    if (!res.ok) {
      const error = (json.error ?? {}) as { description?: string; code?: string };
      // The description is RazorpayX's own validation text (e.g. "Invalid IFSC") — safe and useful to show an admin.
      throw new PayoutProviderRejected(`razorpayx ${path}: HTTP ${res.status} ${error.code ?? ""}`, error.description ?? "RazorpayX rejected the request.");
    }
    return json as T;
  }

  async createContact(input: { name: string; email?: string | null; referenceId: string }): Promise<string> {
    const body = await this.call<{ id: string }>("/contacts", {
      method: "POST",
      body: { name: input.name, email: input.email ?? undefined, type: "vendor", reference_id: input.referenceId.slice(0, 40) },
    });
    return body.id;
  }

  async createFundAccount(contactId: string, details: { vpa: string } | { name: string; accountNumber: string; ifsc: string }): Promise<string> {
    const body = await this.call<{ id: string }>("/fund_accounts", {
      method: "POST",
      body:
        "vpa" in details
          ? { contact_id: contactId, account_type: "vpa", vpa: { address: details.vpa } }
          : { contact_id: contactId, account_type: "bank_account", bank_account: { name: details.name, ifsc: details.ifsc, account_number: details.accountNumber } },
    });
    return body.id;
  }

  async createPayout(input: { fundAccountId: string; amount: number; mode: "UPI" | "IMPS"; referenceId: string; idempotencyKey: string }): Promise<ProviderPayout> {
    const body = await this.call<Record<string, unknown>>("/payouts", {
      method: "POST",
      idempotencyKey: input.idempotencyKey,
      body: {
        account_number: this.accountNumber,
        fund_account_id: input.fundAccountId,
        amount: input.amount,
        currency: "INR",
        mode: input.mode,
        purpose: "payout",
        queue_if_low_balance: true,
        reference_id: input.referenceId.slice(0, 40),
        narration: "Refnivo payout",
      },
    });
    return toPayout(body);
  }

  async getPayout(id: string): Promise<ProviderPayout> {
    return toPayout(await this.call<Record<string, unknown>>(`/payouts/${encodeURIComponent(id)}`, { method: "GET" }));
  }

  /** X-Razorpay-Signature is HMAC-SHA256 of the raw body with the webhook secret, hex encoded. */
  verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
    if (!signature) return false;
    const expected = createHmac("sha256", this.webhookSecret).update(rawBody).digest("hex");
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  parseWebhook(rawBody: string): { event: string; payout: ProviderPayout | null } {
    const json = JSON.parse(rawBody) as { event?: string; payload?: { payout?: { entity?: Record<string, unknown> } } };
    const entity = json.payload?.payout?.entity;
    return { event: json.event ?? "", payout: entity ? toPayout(entity) : null };
  }
}

function toPayout(body: Record<string, unknown>): ProviderPayout {
  const details = (body.status_details ?? {}) as { description?: string };
  return {
    id: String(body.id),
    status: String(body.status) as ProviderPayoutStatus,
    amount: Number(body.amount),
    utr: typeof body.utr === "string" && body.utr ? body.utr : null,
    referenceId: typeof body.reference_id === "string" ? body.reference_id : null,
    failureReason: (typeof body.failure_reason === "string" && body.failure_reason) || details.description || null,
  };
}
