import "server-only";

/**
 * Minimal in-memory, fixed-window rate limiter for auth endpoints.
 *
 * This is deliberately simple: it protects a single running instance against
 * brute-force / abuse without adding infrastructure. On a multi-instance or
 * serverless deployment, swap this for a shared store (Redis / Upstash) behind
 * the same `rateLimit()` signature — no callers change.
 */

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number };

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }

  if (existing.count >= limit) {
    return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)) };
  }

  existing.count += 1;
  return { ok: true };
}

// Opportunistic cleanup so the map cannot grow unbounded over a long uptime.
function sweep() {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}
setInterval(sweep, 10 * 60 * 1000).unref?.();
