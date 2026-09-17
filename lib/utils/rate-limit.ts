import "server-only";
import { headers } from "next/headers";
import { checkRateLimit, FailOpenStore, MemoryStore, type RateLimitResult, type RateLimitStore } from "./rate-limit-core";
import { securityEvent } from "./security-log";

export type { RateLimitResult } from "./rate-limit-core";

/** Best-effort client IP for rate-limit keys (respects proxies; falls back to "local"). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}

/**
 * Server wrapper around the rate-limit core. The store is chosen once from
 * RATE_LIMIT_PROVIDER:
 *   memory  (default) — per-instance Map; correct for `next dev` / single node.
 *   upstash           — shared Redis via REST; needs UPSTASH_REDIS_REST_URL + TOKEN.
 * Every store is wrapped in FailOpenStore: an outage logs a security event and
 * allows the request rather than locking everyone out (see rate-limit-core.ts).
 */
let store: RateLimitStore | null = null;
let memory: MemoryStore | null = null;

async function getStore(): Promise<RateLimitStore> {
  if (store) return store;
  const provider = (process.env.RATE_LIMIT_PROVIDER ?? "memory").trim().toLowerCase();
  const onError = (err: unknown) =>
    securityEvent("RATE_LIMIT_STORE_ERROR", { provider, message: err instanceof Error ? err.message : "unknown error" });

  if (provider === "upstash" && process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    const { UpstashRestStore } = await import("./rate-limit-upstash");
    store = new FailOpenStore(new UpstashRestStore(process.env.UPSTASH_REDIS_REST_URL, process.env.UPSTASH_REDIS_REST_TOKEN), onError);
    return store;
  }
  if (provider !== "memory") {
    securityEvent("RATE_LIMIT_STORE_ERROR", { provider, message: "provider unavailable or misconfigured — falling back to memory" });
  }
  memory = new MemoryStore();
  const m = memory;
  setInterval(() => m.sweep(Date.now()), 10 * 60 * 1000).unref?.();
  store = new FailOpenStore(memory, onError);
  return store;
}

/**
 * Fixed-window limiter: at most `limit` hits per `windowMs` for `key`.
 * Blocked calls are logged as RATE_LIMITED (key prefix only — never the e-mail).
 */
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const result = await checkRateLimit(await getStore(), key, limit, windowMs);
  if (!result.ok) securityEvent("RATE_LIMITED", { scope: key.split(":")[0], retryAfterSeconds: result.retryAfterSeconds });
  return result;
}
