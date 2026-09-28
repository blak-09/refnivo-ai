import { RazorpayProvider } from "./razorpay";
import type { PaymentProvider } from "./provider";

/**
 * Provider selection from the environment. Payments are OFF unless a provider
 * is fully configured — a half-configured deployment gets no checkout at all
 * rather than a broken one.
 *
 *   PAYMENTS_ENABLED=true
 *   PAYMENT_PROVIDER=RAZORPAY
 *   RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET / RAZORPAY_WEBHOOK_SECRET
 *
 * Test and live credentials are the same variables in different environments:
 * Razorpay keys are self-identifying (rzp_test_… vs rzp_live_…), and
 * `paymentsMode()` reports which one a deployment is using.
 */
export type PaymentsConfig =
  | { enabled: false; reason: string; provider: null; mode: "off" }
  | { enabled: true; reason: null; provider: PaymentProvider; mode: "test" | "live" };

const set = (v: string | undefined) => !!v?.trim();

export function paymentsConfig(env: NodeJS.ProcessEnv = process.env): PaymentsConfig {
  const off = (reason: string): PaymentsConfig => ({ enabled: false, reason, provider: null, mode: "off" });

  if ((env.PAYMENTS_ENABLED ?? "").trim().toLowerCase() !== "true") return off("PAYMENTS_ENABLED is not true");
  const name = (env.PAYMENT_PROVIDER ?? "").trim().toUpperCase();
  if (!name || name === "NONE") return off("PAYMENT_PROVIDER is not set");
  if (name !== "RAZORPAY") return off(`PAYMENT_PROVIDER "${name}" is not supported (only RAZORPAY)`);

  const keyId = env.RAZORPAY_KEY_ID?.trim();
  const keySecret = env.RAZORPAY_KEY_SECRET?.trim();
  const webhookSecret = env.RAZORPAY_WEBHOOK_SECRET?.trim();
  const missing = [
    !set(keyId) && "RAZORPAY_KEY_ID",
    !set(keySecret) && "RAZORPAY_KEY_SECRET",
    !set(webhookSecret) && "RAZORPAY_WEBHOOK_SECRET",
  ].filter(Boolean);
  if (missing.length) return off(`missing ${missing.join(", ")}`);

  return {
    enabled: true,
    reason: null,
    provider: new RazorpayProvider(keyId as string, keySecret as string, webhookSecret as string),
    mode: (keyId as string).startsWith("rzp_live") ? "live" : "test",
  };
}

/** The configured provider, or null when payments are off. */
export function getPaymentProvider(env: NodeJS.ProcessEnv = process.env): PaymentProvider | null {
  const config = paymentsConfig(env);
  return config.enabled ? config.provider : null;
}

export function paymentsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return paymentsConfig(env).enabled;
}

export * from "./provider";
