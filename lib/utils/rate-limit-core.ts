/**
 * Rate-limit core: fixed-window counters behind a tiny store interface.
 * Pure (no Next imports) so it can be unit-tested and reused by scripts.
 *
 * Stores:
 *  - MemoryStore     — per-process Map; identical to the original limiter.
 *                      Fine for `next dev` and single-instance hosts only.
 *  - FailOpenStore   — wraps any store; if the store throws (network outage,
 *                      timeout) the request is ALLOWED and one security event is
 *                      logged per minute. Security implication: during an
 *                      outage of the shared store, brute-force protection is
 *                      reduced to whatever the platform provides. Fail-closed
 *                      would instead lock every user out — a self-inflicted
 *                      denial of service — so fail-open is the chosen default.
 */

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number };

export type Hit = { count: number; resetAt: number };

export interface RateLimitStore {
  /** Increments the counter for `key` inside the current window and returns the new count + window end. */
  hit(key: string, windowMs: number, now: number): Promise<Hit>;
}

export function evaluate(hit: Hit, limit: number, now: number): RateLimitResult {
  if (hit.count <= limit) return { ok: true };
  return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((hit.resetAt - now) / 1000)) };
}

export class MemoryStore implements RateLimitStore {
  private readonly buckets = new Map<string, Hit>();

  async hit(key: string, windowMs: number, now: number): Promise<Hit> {
    const existing = this.buckets.get(key);
    if (!existing || existing.resetAt <= now) {
      const fresh = { count: 1, resetAt: now + windowMs };
      this.buckets.set(key, fresh);
      return { ...fresh };
    }
    existing.count += 1;
    return { ...existing };
  }

  /** Drops expired buckets so the map cannot grow unbounded over a long uptime. */
  sweep(now: number): void {
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
  }

  get size(): number {
    return this.buckets.size;
  }
}

export class FailOpenStore implements RateLimitStore {
  private lastReportedAt: number | null = null;

  constructor(
    private readonly inner: RateLimitStore,
    private readonly onError: (err: unknown) => void,
    private readonly reportEveryMs = 60_000,
  ) {}

  async hit(key: string, windowMs: number, now: number): Promise<Hit> {
    try {
      return await this.inner.hit(key, windowMs, now);
    } catch (err) {
      if (this.lastReportedAt === null || now - this.lastReportedAt >= this.reportEveryMs) {
        this.lastReportedAt = now;
        this.onError(err);
      }
      // Allow: count 0 can never exceed a positive limit.
      return { count: 0, resetAt: now + windowMs };
    }
  }
}

/** Shared entry point used by the server wrapper and tests. */
export async function checkRateLimit(store: RateLimitStore, key: string, limit: number, windowMs: number, now = Date.now()): Promise<RateLimitResult> {
  const hit = await store.hit(key, windowMs, now);
  return evaluate(hit, limit, now);
}
