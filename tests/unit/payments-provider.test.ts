import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { mapRazorpayStatus, razorpaySignature, RazorpayProvider, safeEqualHex } from "@/lib/payments/razorpay";
import { paymentsConfig } from "@/lib/payments";

const KEY_ID = "rzp_test_key";
const KEY_SECRET = "key-secret";
const WEBHOOK_SECRET = "webhook-secret";

const provider = new RazorpayProvider(KEY_ID, KEY_SECRET, WEBHOOK_SECRET);
const env = (v: Record<string, string>) => v as unknown as NodeJS.ProcessEnv;

describe("provider selection", () => {
  const full = { PAYMENTS_ENABLED: "true", PAYMENT_PROVIDER: "RAZORPAY", RAZORPAY_KEY_ID: "rzp_test_x", RAZORPAY_KEY_SECRET: "s", RAZORPAY_WEBHOOK_SECRET: "w" };

  it("is off unless every credential is present", () => {
    expect(paymentsConfig(env({})).enabled).toBe(false);
    expect(paymentsConfig(env({ PAYMENTS_ENABLED: "true" })).enabled).toBe(false);
    expect(paymentsConfig(env({ ...full, RAZORPAY_KEY_SECRET: "" })).enabled).toBe(false);
    expect(paymentsConfig(env({ ...full, PAYMENTS_ENABLED: "false" })).enabled).toBe(false);
    expect(paymentsConfig(env({ ...full, PAYMENT_PROVIDER: "PHONEPE" })).reason).toMatch(/not supported/);
  });

  it("reports test vs live mode from the key itself", () => {
    expect(paymentsConfig(env(full))).toMatchObject({ enabled: true, mode: "test" });
    expect(paymentsConfig(env({ ...full, RAZORPAY_KEY_ID: "rzp_live_x" }))).toMatchObject({ enabled: true, mode: "live" });
  });
});

describe("status mapping", () => {
  it("only a captured payment is PAID; authorized money is still in flight", () => {
    expect(mapRazorpayStatus("captured")).toBe("PAID");
    expect(mapRazorpayStatus("authorized")).toBe("PROCESSING");
    expect(mapRazorpayStatus("created")).toBe("PROCESSING");
    expect(mapRazorpayStatus("failed")).toBe("FAILED");
    // Anything unrecognised stays in flight — never PAID.
    expect(mapRazorpayStatus("something_new")).toBe("PROCESSING");
  });

  it("reflects refunds", () => {
    expect(mapRazorpayStatus("captured", 50_000, 100_000)).toBe("PARTIALLY_REFUNDED");
    expect(mapRazorpayStatus("captured", 100_000, 100_000)).toBe("REFUNDED");
  });
});

describe("checkout signature", () => {
  const orderId = "order_ABC";
  const paymentId = "pay_XYZ";
  const good = razorpaySignature(`${orderId}|${paymentId}`, KEY_SECRET);

  it("accepts the provider's signature", () => {
    expect(provider.verifyCheckoutSignature({ providerOrderId: orderId, providerPaymentId: paymentId, signature: good })).toBe(true);
  });

  it("rejects a forged, empty, truncated or wrong-secret signature", () => {
    expect(provider.verifyCheckoutSignature({ providerOrderId: orderId, providerPaymentId: paymentId, signature: "deadbeef" })).toBe(false);
    expect(provider.verifyCheckoutSignature({ providerOrderId: orderId, providerPaymentId: paymentId, signature: "" })).toBe(false);
    expect(provider.verifyCheckoutSignature({ providerOrderId: orderId, providerPaymentId: paymentId, signature: good.slice(0, -2) })).toBe(false);
    expect(provider.verifyCheckoutSignature({ providerOrderId: orderId, providerPaymentId: paymentId, signature: razorpaySignature(`${orderId}|${paymentId}`, "other") })).toBe(false);
    // A signature for a different order must not authorise this one.
    expect(provider.verifyCheckoutSignature({ providerOrderId: "order_OTHER", providerPaymentId: paymentId, signature: good })).toBe(false);
  });

  it("compares in constant time without throwing on odd input", () => {
    expect(safeEqualHex("", "")).toBe(false);
    expect(safeEqualHex("abc", "abcd")).toBe(false);
    expect(safeEqualHex("abcd", "abcd")).toBe(true);
  });
});

describe("webhook parsing", () => {
  const body = JSON.stringify({
    event: "payment.captured",
    payload: { payment: { entity: { id: "pay_1", order_id: "order_1", status: "captured", amount: 99_900, currency: "INR", method: "upi" } } },
  });
  const sign = (b: string, secret = WEBHOOK_SECRET) => createHmac("sha256", secret).update(b).digest("hex");

  it("parses a correctly signed event", () => {
    const event = provider.parseWebhook(body, sign(body));
    expect(event).not.toBeNull();
    expect(event).toMatchObject({ type: "payment.captured", providerOrderId: "order_1" });
    expect(event!.payment).toMatchObject({ providerPaymentId: "pay_1", status: "PAID", amount: 99_900, currency: "INR", method: "upi" });
  });

  it("refuses an unsigned body, a wrong signature, a body signed with the API key, and tampered bytes", () => {
    expect(provider.parseWebhook(body, null)).toBeNull();
    expect(provider.parseWebhook(body, "00")).toBeNull();
    expect(provider.parseWebhook(body, sign(body, KEY_SECRET))).toBeNull();
    const tampered = body.replace("99900", "1");
    expect(provider.parseWebhook(tampered, sign(body))).toBeNull();
    expect(provider.parseWebhook("not json", sign("not json"))).toBeNull();
  });

  it("derives a stable event id from the verified body, so replays collide", () => {
    const a = provider.parseWebhook(body, sign(body))!;
    const b = provider.parseWebhook(body, sign(body))!;
    expect(a.id).toBe(b.id);
    const other = JSON.stringify({ event: "payment.failed", payload: { payment: { entity: { id: "pay_2", order_id: "order_2", status: "failed", amount: 1, currency: "INR" } } } });
    expect(provider.parseWebhook(other, sign(other))!.id).not.toBe(a.id);
  });
});

describe("order creation", () => {
  it("sends the server-resolved amount and never leaks the secret to the caller", async () => {
    const calls: { url: string; body?: string; headers: Record<string, string> }[] = [];
    const stub = new RazorpayProvider(KEY_ID, KEY_SECRET, WEBHOOK_SECRET, async (url, init) => {
      calls.push({ url, body: init.body, headers: init.headers });
      return { ok: true, status: 200, text: async () => JSON.stringify({ id: "order_1", amount: 99_900, currency: "INR" }) };
    });
    const order = await stub.createOrder({ reference: "RFN-1", amount: 99_900, currency: "INR", notes: { planKey: "starter" } });
    expect(order).toMatchObject({ providerOrderId: "order_1", publicKey: KEY_ID, amount: 99_900 });
    expect(JSON.parse(calls[0].body!)).toMatchObject({ amount: 99_900, currency: "INR", receipt: "RFN-1" });
    // The secret travels only in the Authorization header, never in the response we hand upwards.
    expect(JSON.stringify(order)).not.toContain(KEY_SECRET);
  });

  it("raises a provider error with a safe public message when the API fails", async () => {
    const stub = new RazorpayProvider(KEY_ID, KEY_SECRET, WEBHOOK_SECRET, async () => ({ ok: false, status: 500, text: async () => "internal detail" }));
    await expect(stub.createOrder({ reference: "RFN-2", amount: 1, currency: "INR" })).rejects.toMatchObject({
      name: "PaymentProviderError",
      publicMessage: "The payment provider could not be reached. Please try again.",
    });
  });
});
