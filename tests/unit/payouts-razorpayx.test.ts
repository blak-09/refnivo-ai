import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { payoutProviderConfig, PayoutProviderRejected, PayoutProviderUnavailable, RazorpayXProvider } from "@/lib/payouts";
import { maskBank, maskVpa, payoutAccountSchema } from "@/lib/validation/payout-account";
import { validateProductionEnv } from "@/lib/config/env";

type Call = { url: string; init: RequestInit };

function fakeFetch(responses: { status: number; body: unknown }[]) {
  const calls: Call[] = [];
  const impl = async (url: string, init?: RequestInit) => {
    calls.push({ url, init: init ?? {} });
    const next = responses.shift() ?? { status: 200, body: {} };
    return new Response(JSON.stringify(next.body), { status: next.status });
  };
  return { calls, impl };
}

describe("payout account validation", () => {
  it("accepts a UPI ID and normalises it", () => {
    const r = payoutAccountSchema.safeParse({ type: "UPI", holderName: "Arjun K", vpa: "  Arjun.K@OkIcici " });
    expect(r.success && r.data.type === "UPI" && r.data.vpa).toBe("arjun.k@okicici");
  });

  it("rejects malformed UPI IDs, IFSC codes and account numbers", () => {
    expect(payoutAccountSchema.safeParse({ type: "UPI", holderName: "Arjun", vpa: "not-a-vpa" }).success).toBe(false);
    const bank = { type: "BANK", holderName: "Arjun", accountNumber: "123456789012", confirmAccountNumber: "123456789012", ifsc: "HDFC0001234" };
    expect(payoutAccountSchema.safeParse(bank).success).toBe(true);
    expect(payoutAccountSchema.safeParse({ ...bank, ifsc: "HDFC1001234" }).success).toBe(false); // 5th char must be 0
    expect(payoutAccountSchema.safeParse({ ...bank, accountNumber: "12345", confirmAccountNumber: "12345" }).success).toBe(false);
  });

  it("requires the account number to be typed twice identically", () => {
    const r = payoutAccountSchema.safeParse({ type: "BANK", holderName: "Arjun", accountNumber: "123456789012", confirmAccountNumber: "123456789013", ifsc: "hdfc0001234" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toMatch(/do not match/);
  });

  it("masks details so pages never see them in full", () => {
    expect(maskVpa("arjun.k@okicici")).toBe("ar•••@okicici");
    expect(maskBank("123456789012", "HDFC0001234")).toBe("HDFC0001234 · ••••9012");
  });
});

describe("RazorpayX adapter", () => {
  it("creates a payout with the account number, an idempotency header and amount in paise", async () => {
    const { calls, impl } = fakeFetch([{ status: 200, body: { id: "pout_1", status: "processing", amount: 60_000, utr: null, reference_id: "req_1" } }]);
    const x = new RazorpayXProvider("rzp_test_k", "secret", "2323230000000000", "whsec", impl);
    const payout = await x.createPayout({ fundAccountId: "fa_1", amount: 60_000, mode: "UPI", referenceId: "req_1", idempotencyKey: "payout-req_1-1" });

    expect(payout).toMatchObject({ id: "pout_1", status: "processing", amount: 60_000, referenceId: "req_1" });
    expect(calls[0].url).toBe("https://api.razorpay.com/v1/payouts");
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers["X-Payout-Idempotency"]).toBe("payout-req_1-1");
    expect(headers.Authorization).toBe(`Basic ${Buffer.from("rzp_test_k:secret").toString("base64")}`);
    expect(JSON.parse(String(calls[0].init.body))).toMatchObject({ account_number: "2323230000000000", fund_account_id: "fa_1", amount: 60_000, currency: "INR", mode: "UPI", purpose: "payout" });
  });

  it("separates a refusal (4xx: nothing created) from an unknown outcome (5xx / network)", async () => {
    const rejected = new RazorpayXProvider("k", "s", "a", "w", fakeFetch([{ status: 400, body: { error: { code: "BAD_REQUEST_ERROR", description: "Invalid IFSC" } } }]).impl);
    await expect(rejected.createPayout({ fundAccountId: "fa", amount: 100, mode: "IMPS", referenceId: "r", idempotencyKey: "k" })).rejects.toMatchObject({
      name: "PayoutProviderRejected",
      publicMessage: "Invalid IFSC",
    });

    const down = new RazorpayXProvider("k", "s", "a", "w", fakeFetch([{ status: 502, body: {} }]).impl);
    await expect(down.getPayout("pout_1")).rejects.toBeInstanceOf(PayoutProviderUnavailable);

    const offline = new RazorpayXProvider("k", "s", "a", "w", async () => {
      throw new TypeError("fetch failed");
    });
    await expect(offline.getPayout("pout_1")).rejects.toBeInstanceOf(PayoutProviderUnavailable);
    expect(new PayoutProviderRejected("x", "y")).toBeInstanceOf(Error);
  });

  it("verifies webhook signatures over the raw body and parses the payout", () => {
    const x = new RazorpayXProvider("k", "s", "a", "whsec");
    const raw = JSON.stringify({ event: "payout.processed", payload: { payout: { entity: { id: "pout_9", status: "processed", amount: 5000, utr: "UTR123", reference_id: "req_9" } } } });
    const good = createHmac("sha256", "whsec").update(raw).digest("hex");
    expect(x.verifyWebhookSignature(raw, good)).toBe(true);
    expect(x.verifyWebhookSignature(raw + " ", good)).toBe(false);
    expect(x.verifyWebhookSignature(raw, null)).toBe(false);
    expect(x.verifyWebhookSignature(raw, "00")).toBe(false);
    expect(x.parseWebhook(raw)).toEqual({ event: "payout.processed", payout: { id: "pout_9", status: "processed", amount: 5000, utr: "UTR123", referenceId: "req_9", failureReason: null } });
  });
});

describe("payout provider config", () => {
  const full = { PAYOUT_PROVIDER: "RAZORPAYX", RAZORPAYX_KEY_ID: "rzp_test_x", RAZORPAYX_KEY_SECRET: "s", RAZORPAYX_ACCOUNT_NUMBER: "232323", RAZORPAYX_WEBHOOK_SECRET: "w" };
  const cfg = (env: Record<string, string>) => payoutProviderConfig(env as unknown as NodeJS.ProcessEnv);

  it("is off unless every value is present", () => {
    expect(cfg({}).enabled).toBe(false);
    expect(cfg({ ...full, RAZORPAYX_ACCOUNT_NUMBER: "" })).toMatchObject({ enabled: false, reason: expect.stringContaining("RAZORPAYX_ACCOUNT_NUMBER") });
    expect(cfg({ ...full, PAYOUT_PROVIDER: "CASHFREE" }).enabled).toBe(false);
    expect(cfg(full)).toMatchObject({ enabled: true, mode: "test" });
    expect(cfg({ ...full, RAZORPAYX_KEY_ID: "rzp_live_x" })).toMatchObject({ enabled: true, mode: "live" });
  });

  it("production env check warns about half-configured payouts and wallet without payments", () => {
    const base = {
      NODE_ENV: "production",
      AUTH_SECRET: "a".repeat(40).replace(/a/g, "q"),
      DATABASE_URL: "postgresql://u:p@db.example.com:5432/app",
      NEXT_PUBLIC_APP_URL: "https://app.example.com",
      NEXTAUTH_URL: "https://app.example.com",
    } as NodeJS.ProcessEnv;
    const report = validateProductionEnv({ ...base, PAYOUT_PROVIDER: "RAZORPAYX", RAZORPAYX_KEY_ID: "k", BRAND_WALLET_ENABLED: "true" });
    expect(report.warnings.join("\n")).toMatch(/PAYOUT_PROVIDER=RAZORPAYX needs .*RAZORPAYX_KEY_SECRET/);
    expect(report.warnings.join("\n")).toMatch(/PAYOUT_ACCOUNT_ENCRYPTION_KEY/);
    expect(report.warnings.join("\n")).toMatch(/BRAND_WALLET_ENABLED=true but payments are off/);
    // The encryption key alone is not a "payment credential set while payments are off".
    const keyOnly = validateProductionEnv({ ...base, PAYOUT_ACCOUNT_ENCRYPTION_KEY: "x".repeat(44) });
    expect(keyOnly.warnings.join("\n")).not.toMatch(/Payment credentials are set/);
    expect(validateProductionEnv({ ...base, PAYOUT_ACCOUNT_ENCRYPTION_KEY: "short" }).errors.join("\n")).toMatch(/PAYOUT_ACCOUNT_ENCRYPTION_KEY is too short/);
  });
});
