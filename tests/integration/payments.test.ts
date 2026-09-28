import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { PLANS } from "@/lib/config/plans";
import type { CheckoutResult, CreateOrderInput, CreatedOrder, PaymentProvider, ProviderPayment, RefundResult, WebhookEvent } from "@/lib/payments";
import {
  applyProviderPayment,
  handleWebhookEvent,
  markCheckoutCancelled,
  PaymentError,
  refundPayment,
  startPlanCheckout,
  subscriptionIsCurrent,
  verifyCheckout,
} from "@/lib/services/payments";
import { makeOwnerWithBrand, uniq } from "../helpers";

/**
 * The money rules, against the real database with a stub provider standing in
 * for Razorpay. What is proven here: the amount comes from the server, only a
 * provider-confirmed payment grants a plan, and a replayed webhook grants once.
 */
let orderSeq = 0;

class StubProvider implements PaymentProvider {
  readonly key = "STUB";
  payments = new Map<string, ProviderPayment>();
  failCreate = false;
  /** Lets a test pretend the provider charged something different. */
  createdAmount: number | null = null;

  publicKey() {
    return "stub_public_key";
  }
  async createOrder(input: CreateOrderInput): Promise<CreatedOrder> {
    if (this.failCreate) throw new Error("provider down");
    return { providerOrderId: `order_${++orderSeq}`, publicKey: this.publicKey(), amount: this.createdAmount ?? input.amount, currency: input.currency };
  }
  verifyCheckoutSignature(r: CheckoutResult) {
    return r.signature === `sig:${r.providerOrderId}|${r.providerPaymentId}`;
  }
  async getPayment(id: string): Promise<ProviderPayment> {
    const p = this.payments.get(id);
    if (!p) throw new Error("unknown payment");
    return p;
  }
  parseWebhook(): WebhookEvent | null {
    return null; // webhook parsing is covered by the provider unit tests
  }
  async refund(input: { providerPaymentId: string; amount: number }): Promise<RefundResult> {
    return { providerRefundId: `rfnd_${input.providerPaymentId}`, amount: input.amount, state: this.refundState };
  }
  refundState: RefundResult["state"] = "done";
}

const provider = new StubProvider();

function capturedPayment(orderId: string, paymentId: string, amount: number, over: Partial<ProviderPayment> = {}): ProviderPayment {
  return {
    providerPaymentId: paymentId,
    providerOrderId: orderId,
    status: "PAID",
    amount,
    currency: "INR",
    method: "upi",
    failureCode: null,
    failureReason: null,
    refundedAmount: 0,
    ...over,
  };
}

async function brandOwner() {
  const owner = await makeOwnerWithBrand(`Pay ${uniq("b")}`);
  return { userId: owner.user.id, brandId: owner.brand.id, brandName: owner.brand.name };
}

afterAll(() => prisma.$disconnect());

describe("checkout creation", () => {
  it("prices the plan on the server and ignores anything the client might send", async () => {
    const o = await brandOwner();
    const { transaction: row } = await startPlanCheckout(provider, { ...o, planKey: "growth" });
    expect(row.amount).toBe(PLANS.growth.amount);
    expect(row.currency).toBe("INR");
    expect(row.status).toBe("PENDING");
    expect(row.providerOrderId).toBeTruthy();
    expect(row.reference).toMatch(/^RFN-[0-9A-F]{8}$/);
  });

  it("refuses an unknown plan key", async () => {
    const o = await brandOwner();
    await expect(startPlanCheckout(provider, { ...o, planKey: "free-for-me" })).rejects.toBeInstanceOf(PaymentError);
    await expect(startPlanCheckout(provider, { ...o, planKey: { amount: 1 } })).rejects.toBeInstanceOf(PaymentError);
  });

  it("fails the transaction, and grants nothing, when the provider order does not match the plan price", async () => {
    const o = await brandOwner();
    provider.createdAmount = 100; // provider says ₹1
    try {
      await expect(startPlanCheckout(provider, { ...o, planKey: "starter" })).rejects.toBeInstanceOf(PaymentError);
    } finally {
      provider.createdAmount = null;
    }
    const row = await prisma.paymentTransaction.findFirstOrThrow({ where: { userId: o.userId }, orderBy: { createdAt: "desc" } });
    expect(row).toMatchObject({ status: "FAILED", failureCode: "AMOUNT_MISMATCH" });
    expect(await prisma.brandSubscription.findUnique({ where: { brandId: o.brandId } })).toBeNull();
  });

  it("records a provider outage as FAILED rather than leaving a phantom pending row", async () => {
    const o = await brandOwner();
    provider.failCreate = true;
    try {
      await expect(startPlanCheckout(provider, { ...o, planKey: "starter" })).rejects.toBeInstanceOf(PaymentError);
    } finally {
      provider.failCreate = false;
    }
    const row = await prisma.paymentTransaction.findFirstOrThrow({ where: { userId: o.userId }, orderBy: { createdAt: "desc" } });
    expect(row).toMatchObject({ status: "FAILED", failureCode: "PROVIDER_UNAVAILABLE" });
  });
});

describe("verification", () => {
  it("grants the plan only after the provider confirms the payment", async () => {
    const o = await brandOwner();
    const { transaction: row } = await startPlanCheckout(provider, { ...o, planKey: "starter" });
    const paymentId = `pay_${uniq("p")}`;
    provider.payments.set(paymentId, capturedPayment(row.providerOrderId!, paymentId, PLANS.starter.amount));

    // Nothing granted before verification.
    expect(await prisma.brandSubscription.findUnique({ where: { brandId: o.brandId } })).toBeNull();

    const verified = await verifyCheckout(provider, {
      transactionId: row.id,
      userId: o.userId,
      providerOrderId: row.providerOrderId!,
      providerPaymentId: paymentId,
      signature: `sig:${row.providerOrderId}|${paymentId}`,
    });
    expect(verified.status).toBe("PAID");
    expect(verified.paidAt).toBeTruthy();

    const sub = await prisma.brandSubscription.findUnique({ where: { brandId: o.brandId } });
    expect(sub).toMatchObject({ planKey: "starter", status: "ACTIVE" });
    expect(subscriptionIsCurrent(sub)).toBe(true);
    // Exactly one receipt notification.
    expect(await prisma.notification.count({ where: { userId: o.userId, title: { contains: "Payment received" } } })).toBe(1);
  });

  it("rejects a forged signature and never grants anything", async () => {
    const o = await brandOwner();
    const { transaction: row } = await startPlanCheckout(provider, { ...o, planKey: "starter" });
    await expect(
      verifyCheckout(provider, {
        transactionId: row.id,
        userId: o.userId,
        providerOrderId: row.providerOrderId!,
        providerPaymentId: "pay_forged",
        signature: "totally-made-up",
      }),
    ).rejects.toBeInstanceOf(PaymentError);
    expect((await prisma.paymentTransaction.findUniqueOrThrow({ where: { id: row.id } })).status).toBe("FAILED");
    expect(await prisma.brandSubscription.findUnique({ where: { brandId: o.brandId } })).toBeNull();
  });

  it("refuses to confirm another user's transaction", async () => {
    const owner = await brandOwner();
    const other = await brandOwner();
    const { transaction: row } = await startPlanCheckout(provider, { ...owner, planKey: "starter" });
    const paymentId = `pay_${uniq("p")}`;
    provider.payments.set(paymentId, capturedPayment(row.providerOrderId!, paymentId, PLANS.starter.amount));
    await expect(
      verifyCheckout(provider, {
        transactionId: row.id,
        userId: other.userId, // different signed-in user
        providerOrderId: row.providerOrderId!,
        providerPaymentId: paymentId,
        signature: `sig:${row.providerOrderId}|${paymentId}`,
      }),
    ).rejects.toThrow(/not found/i);
    expect(await prisma.brandSubscription.findUnique({ where: { brandId: owner.brandId } })).toBeNull();
  });

  it("refuses a payment whose charged amount differs from the order", async () => {
    const o = await brandOwner();
    const { transaction: row } = await startPlanCheckout(provider, { ...o, planKey: "growth" });
    const paymentId = `pay_${uniq("p")}`;
    provider.payments.set(paymentId, capturedPayment(row.providerOrderId!, paymentId, 100)); // ₹1 instead of the plan price
    await expect(
      verifyCheckout(provider, {
        transactionId: row.id,
        userId: o.userId,
        providerOrderId: row.providerOrderId!,
        providerPaymentId: paymentId,
        signature: `sig:${row.providerOrderId}|${paymentId}`,
      }),
    ).rejects.toThrow(/did not match/i);
    expect((await prisma.paymentTransaction.findUniqueOrThrow({ where: { id: row.id } })).status).toBe("FAILED");
    expect(await prisma.brandSubscription.findUnique({ where: { brandId: o.brandId } })).toBeNull();
  });
});

describe("webhooks and idempotency", () => {
  it("applies a captured event once, however many times it is delivered", async () => {
    const o = await brandOwner();
    const { transaction: row } = await startPlanCheckout(provider, { ...o, planKey: "starter" });
    const paymentId = `pay_${uniq("p")}`;
    const payment = capturedPayment(row.providerOrderId!, paymentId, PLANS.starter.amount);
    const event = { id: `evt_${uniq("e")}`, type: "payment.captured", payment, providerOrderId: row.providerOrderId };

    const first = await handleWebhookEvent(event, "STUB", { replay: 1 });
    expect(first.applied).toBe(true);

    const sub = await prisma.brandSubscription.findUniqueOrThrow({ where: { brandId: o.brandId } });
    const firstEnd = sub.currentPeriodEnd;

    // Same event id again (provider retry) and a fresh event id carrying the same payment.
    expect(await handleWebhookEvent(event, "STUB", { replay: 2 })).toMatchObject({ applied: false, reason: "duplicate" });
    expect(await handleWebhookEvent({ ...event, id: `evt_${uniq("e")}` }, "STUB", { replay: 3 })).toMatchObject({ applied: false });

    const after = await prisma.brandSubscription.findUniqueOrThrow({ where: { brandId: o.brandId } });
    expect(after.currentPeriodEnd.getTime()).toBe(firstEnd.getTime()); // the period was not extended twice
    expect(await prisma.notification.count({ where: { userId: o.userId, title: { contains: "Payment received" } } })).toBe(1);
    expect(await prisma.paymentEvent.count({ where: { transactionId: row.id, applied: true } })).toBe(1);
  });

  it("records a payment that arrives while the payer's browser is gone", async () => {
    const o = await brandOwner();
    const { transaction: row } = await startPlanCheckout(provider, { ...o, planKey: "growth" });
    const paymentId = `pay_${uniq("p")}`;
    // No verify call at all — only the webhook, as when the payer closes the tab.
    await handleWebhookEvent(
      { id: `evt_${uniq("e")}`, type: "payment.captured", payment: capturedPayment(row.providerOrderId!, paymentId, PLANS.growth.amount), providerOrderId: row.providerOrderId },
      "STUB",
      {},
    );
    expect((await prisma.paymentTransaction.findUniqueOrThrow({ where: { id: row.id } })).status).toBe("PAID");
    expect(subscriptionIsCurrent(await prisma.brandSubscription.findUnique({ where: { brandId: o.brandId } }))).toBe(true);
  });

  it("never downgrades a settled payment on a late or out-of-order event", async () => {
    const o = await brandOwner();
    const { transaction: row } = await startPlanCheckout(provider, { ...o, planKey: "starter" });
    const paymentId = `pay_${uniq("p")}`;
    const paid = capturedPayment(row.providerOrderId!, paymentId, PLANS.starter.amount);
    await handleWebhookEvent({ id: `evt_${uniq("e")}`, type: "payment.captured", payment: paid, providerOrderId: row.providerOrderId }, "STUB", {});

    const late = { ...paid, status: "FAILED" as const, failureCode: "late", failureReason: "arrived out of order" };
    await handleWebhookEvent({ id: `evt_${uniq("e")}`, type: "payment.failed", payment: late, providerOrderId: row.providerOrderId }, "STUB", {});
    expect((await prisma.paymentTransaction.findUniqueOrThrow({ where: { id: row.id } })).status).toBe("PAID");
  });

  it("acknowledges an event for an unknown order without creating anything", async () => {
    const before = await prisma.paymentTransaction.count();
    const result = await handleWebhookEvent(
      { id: `evt_${uniq("e")}`, type: "payment.captured", payment: capturedPayment("order_does_not_exist", "pay_x", 1), providerOrderId: "order_does_not_exist" },
      "STUB",
      {},
    );
    expect(result.applied).toBe(false);
    expect(await prisma.paymentTransaction.count()).toBe(before);
  });
});

describe("cancellation and refunds", () => {
  it("marks an abandoned checkout CANCELLED, and leaves a started payment alone", async () => {
    const o = await brandOwner();
    const { transaction: row } = await startPlanCheckout(provider, { ...o, planKey: "starter" });
    expect((await markCheckoutCancelled(row.id, o.userId))!.status).toBe("CANCELLED");
    expect(await prisma.brandSubscription.findUnique({ where: { brandId: o.brandId } })).toBeNull();

    // A transaction that already has a provider payment is not cancellable locally.
    const paid = await startPlanCheckout(provider, { ...o, planKey: "starter" });
    const paymentId = `pay_${uniq("p")}`;
    await applyProviderPayment(capturedPayment(paid.transaction.providerOrderId!, paymentId, PLANS.starter.amount), { source: "webhook" });
    expect((await markCheckoutCancelled(paid.transaction.id, o.userId))!.status).toBe("PAID");
  });

  it("only marks a refund when the provider confirms it", async () => {
    const o = await brandOwner();
    const admin = await prisma.user.create({ data: { name: "Admin", email: `${uniq("admin")}@test.local`, role: "ADMIN", status: "APPROVED" } });
    const { transaction: row } = await startPlanCheckout(provider, { ...o, planKey: "starter" });
    const paymentId = `pay_${uniq("p")}`;
    await applyProviderPayment(capturedPayment(row.providerOrderId!, paymentId, PLANS.starter.amount), { source: "webhook" });

    // Provider says "processing": the transaction stays PAID.
    provider.refundState = "processing";
    const pending = await refundPayment(provider, { transactionId: row.id, adminId: admin.id });
    expect(pending.state).toBe("processing");
    expect((await prisma.paymentTransaction.findUniqueOrThrow({ where: { id: row.id } })).status).toBe("PAID");

    // Confirmed partial, then the rest.
    provider.refundState = "done";
    await refundPayment(provider, { transactionId: row.id, adminId: admin.id, amount: 50_000 });
    expect(await prisma.paymentTransaction.findUniqueOrThrow({ where: { id: row.id } })).toMatchObject({ status: "PARTIALLY_REFUNDED", refundedAmount: 50_000 });
    await refundPayment(provider, { transactionId: row.id, adminId: admin.id });
    expect(await prisma.paymentTransaction.findUniqueOrThrow({ where: { id: row.id } })).toMatchObject({ status: "REFUNDED", refundedAmount: PLANS.starter.amount });
    // Nothing left to refund.
    await expect(refundPayment(provider, { transactionId: row.id, adminId: admin.id })).rejects.toThrow(/more than the remaining/i);
  });
});
