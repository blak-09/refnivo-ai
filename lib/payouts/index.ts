import { RazorpayXProvider } from "./razorpayx";

/**
 * Automatic payouts are OFF unless fully configured:
 *
 *   PAYOUT_PROVIDER=RAZORPAYX
 *   RAZORPAYX_KEY_ID / RAZORPAYX_KEY_SECRET   (API keys of the Razorpay account that has RazorpayX)
 *   RAZORPAYX_ACCOUNT_NUMBER                  (the RazorpayX account money is paid from)
 *   RAZORPAYX_WEBHOOK_SECRET                  (webhook → /api/payouts/webhook)
 *
 * Saved payout accounts (PAYOUT_ACCOUNT_ENCRYPTION_KEY) are required too, since
 * that is where the money goes. Without all of this, payouts stay manual.
 */
const set = (v: string | undefined) => !!v?.trim();

export function payoutProviderConfig(env: NodeJS.ProcessEnv = process.env): { enabled: true; provider: RazorpayXProvider; mode: "test" | "live" } | { enabled: false; reason: string } {
  const name = (env.PAYOUT_PROVIDER ?? "").trim().toUpperCase();
  if (!name || name === "NONE" || name === "MANUAL") return { enabled: false, reason: "PAYOUT_PROVIDER is not set (payouts are manual)" };
  if (name !== "RAZORPAYX") return { enabled: false, reason: `PAYOUT_PROVIDER "${name}" is not supported (only RAZORPAYX)` };
  const required = ["RAZORPAYX_KEY_ID", "RAZORPAYX_KEY_SECRET", "RAZORPAYX_ACCOUNT_NUMBER", "RAZORPAYX_WEBHOOK_SECRET"] as const;
  const missing = required.filter((k) => !set(env[k]));
  if (missing.length) return { enabled: false, reason: `missing ${missing.join(", ")}` };
  const keyId = (env.RAZORPAYX_KEY_ID as string).trim();
  return {
    enabled: true,
    provider: new RazorpayXProvider(keyId, (env.RAZORPAYX_KEY_SECRET as string).trim(), (env.RAZORPAYX_ACCOUNT_NUMBER as string).trim(), (env.RAZORPAYX_WEBHOOK_SECRET as string).trim()),
    mode: keyId.startsWith("rzp_live") ? "live" : "test",
  };
}

export function getPayoutProvider(env: NodeJS.ProcessEnv = process.env): RazorpayXProvider | null {
  const c = payoutProviderConfig(env);
  return c.enabled ? c.provider : null;
}

export * from "./razorpayx";
