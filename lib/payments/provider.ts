import type { PaymentStatus } from "@prisma/client";

/**
 * Payment provider port.
 *
 * Everything above this interface (services, routes, UI) is provider-agnostic;
 * everything provider-specific lives in an adapter that implements it. Adapters
 * never touch the database and never decide business outcomes — they translate
 * one provider's API and signatures into these shapes, and the service layer
 * decides what that means for a transaction.
 */
export type CreateOrderInput = {
  /** Our transaction reference — passed to the provider so both sides can correlate. */
  reference: string;
  /** Integer minor units, already resolved server-side. */
  amount: number;
  currency: string;
  /** Non-sensitive context echoed back by the provider (plan key, brand id). */
  notes?: Record<string, string>;
};

export type CreatedOrder = {
  providerOrderId: string;
  /** Publishable key / client token the checkout widget needs. Never a secret. */
  publicKey: string;
  /** Amount and currency as the provider recorded them, for a post-create sanity check. */
  amount: number;
  currency: string;
};

/** What the browser hands back after the provider's checkout closes. */
export type CheckoutResult = {
  providerOrderId: string;
  providerPaymentId: string;
  signature: string;
};

/** A payment as the provider currently sees it — the authority for status. */
export type ProviderPayment = {
  providerPaymentId: string;
  providerOrderId: string | null;
  status: PaymentStatus;
  /** Integer minor units as charged by the provider. */
  amount: number;
  currency: string;
  method: string | null;
  failureCode: string | null;
  /** Short, safe description. Full provider detail belongs in the server log only. */
  failureReason: string | null;
  refundedAmount: number;
};

export type WebhookEvent = {
  /** Stable id used for idempotency; adapters that get none must derive a digest. */
  id: string;
  type: string;
  /** Present when the event concerns a specific payment. */
  payment: ProviderPayment | null;
  /** Provider order id when the event carries one but no payment. */
  providerOrderId: string | null;
};

export type RefundResult = {
  providerRefundId: string;
  /** Amount actually refunded, minor units. */
  amount: number;
  /** Provider-confirmed state; only "done" may mark a transaction refunded. */
  state: "pending" | "processing" | "done" | "failed";
};

export class PaymentProviderError extends Error {
  constructor(
    message: string,
    /** Safe, short reason for the payer; never provider internals. */
    readonly publicMessage = "The payment provider could not be reached. Please try again.",
    readonly code: string | null = null,
  ) {
    super(message);
    this.name = "PaymentProviderError";
  }
}

export interface PaymentProvider {
  /** Stable key stored on every transaction, e.g. "RAZORPAY". */
  readonly key: string;
  /** Publishable key for the checkout widget. */
  publicKey(): string;
  createOrder(input: CreateOrderInput): Promise<CreatedOrder>;
  /**
   * Verifies the signature the browser returned. Pure and synchronous: no
   * network, so a forged callback is rejected before anything else happens.
   */
  verifyCheckoutSignature(result: CheckoutResult): boolean;
  /** Authoritative read-back. Used after checkout and whenever a status is refreshed. */
  getPayment(providerPaymentId: string): Promise<ProviderPayment>;
  /** Verifies the webhook signature over the RAW body, then parses it. Returns null when the signature fails. */
  parseWebhook(rawBody: string, signature: string | null): WebhookEvent | null;
  refund(input: { providerPaymentId: string; amount: number; reference: string }): Promise<RefundResult>;
}
