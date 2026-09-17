import type { Hit, RateLimitStore } from "./rate-limit-core";

/**
 * Upstash Redis REST driver — one pipelined request per hit, no SDK dependency:
 *   INCR key · PEXPIRE key windowMs NX · PTTL key
 * The token is read once from the environment and only ever sent as a bearer
 * header; it is never logged. Any HTTP/network failure throws, and the
 * FailOpenStore wrapper decides what happens next.
 */
export type FetchLike = (input: string, init: { method: string; headers: Record<string, string>; body: string; signal: AbortSignal }) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

export class UpstashRestStore implements RateLimitStore {
  constructor(
    private readonly url: string,
    private readonly token: string,
    private readonly fetchImpl: FetchLike = fetch as unknown as FetchLike,
    private readonly timeoutMs = 1500,
  ) {}

  async hit(key: string, windowMs: number, now: number): Promise<Hit> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.fetchImpl(`${this.url.replace(/\/+$/, "")}/pipeline`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
        body: JSON.stringify([
          ["INCR", key],
          ["PEXPIRE", key, String(windowMs), "NX"],
          ["PTTL", key],
        ]),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`upstash responded with HTTP ${res.status}`);
      const rows = (await res.json()) as Array<{ result?: unknown; error?: string }>;
      if (!Array.isArray(rows) || rows.length < 3) throw new Error("upstash returned an unexpected pipeline response");
      const failed = rows.find((r) => r && typeof r === "object" && "error" in r && r.error);
      if (failed) throw new Error("upstash pipeline command failed");
      const count = Number(rows[0].result);
      const ttl = Number(rows[2].result);
      if (!Number.isFinite(count)) throw new Error("upstash returned a non-numeric counter");
      const resetAt = ttl > 0 ? now + ttl : now + windowMs;
      return { count, resetAt };
    } finally {
      clearTimeout(timer);
    }
  }
}
