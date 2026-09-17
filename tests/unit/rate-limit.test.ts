import { describe, expect, it, vi } from "vitest";
import { checkRateLimit, evaluate, FailOpenStore, MemoryStore, type Hit, type RateLimitStore } from "@/lib/utils/rate-limit-core";
import { UpstashRestStore, type FetchLike } from "@/lib/utils/rate-limit-upstash";

const WINDOW = 10 * 60 * 1000;

describe("rate-limit core — memory store (deterministic clock)", () => {
  it("allows up to the limit and blocks the next request with a retry-after", async () => {
    const store = new MemoryStore();
    const t0 = 1_000_000;
    for (let i = 0; i < 5; i++) expect((await checkRateLimit(store, "login:1.2.3.4:a@x.com", 5, WINDOW, t0 + i)).ok).toBe(true);
    const blocked = await checkRateLimit(store, "login:1.2.3.4:a@x.com", 5, WINDOW, t0 + 5_000);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.retryAfterSeconds).toBe(Math.ceil((WINDOW - 5_000) / 1000));
  });

  it("resets after the window expires", async () => {
    const store = new MemoryStore();
    const t0 = 50_000;
    for (let i = 0; i < 3; i++) await checkRateLimit(store, "k", 3, WINDOW, t0);
    expect((await checkRateLimit(store, "k", 3, WINDOW, t0 + 1)).ok).toBe(false);
    expect((await checkRateLimit(store, "k", 3, WINDOW, t0 + WINDOW)).ok).toBe(true); // resetAt <= now → fresh window
  });

  it("isolates keys — one client's abuse never affects another", async () => {
    const store = new MemoryStore();
    for (let i = 0; i < 10; i++) await checkRateLimit(store, "login:10.0.0.1:victim@x.com", 10, WINDOW, 1);
    expect((await checkRateLimit(store, "login:10.0.0.1:victim@x.com", 10, WINDOW, 2)).ok).toBe(false);
    expect((await checkRateLimit(store, "login:10.0.0.2:victim@x.com", 10, WINDOW, 2)).ok).toBe(true);
    expect((await checkRateLimit(store, "login:10.0.0.1:other@x.com", 10, WINDOW, 2)).ok).toBe(true);
    expect((await checkRateLimit(store, "register:10.0.0.1", 5, WINDOW, 2)).ok).toBe(true);
  });

  it("sweeps expired buckets", async () => {
    const store = new MemoryStore();
    await checkRateLimit(store, "a", 1, 1000, 0);
    await checkRateLimit(store, "b", 1, 5000, 0);
    store.sweep(2000);
    expect(store.size).toBe(1);
  });

  it("evaluate never returns a retry-after below 1 second", () => {
    const hit: Hit = { count: 99, resetAt: 1_000_100 };
    const r = evaluate(hit, 1, 1_000_000);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.retryAfterSeconds).toBe(1);
  });

  it("applies the same limits the auth actions use (login 10/10min, register 5/10min, check 10/10min)", async () => {
    const store = new MemoryStore();
    const ip = "203.0.113.9";
    let allowed = 0;
    for (let i = 0; i < 12; i++) if ((await checkRateLimit(store, `login:${ip}:admin@x.com`, 10, WINDOW, i)).ok) allowed++;
    expect(allowed).toBe(10);
    allowed = 0;
    for (let i = 0; i < 8; i++) if ((await checkRateLimit(store, `register:${ip}`, 5, WINDOW, i)).ok) allowed++;
    expect(allowed).toBe(5);
    // Upload limit used by the product-image route.
    allowed = 0;
    for (let i = 0; i < 31; i++) if ((await checkRateLimit(store, "upload:user_1", 30, WINDOW, i)).ok) allowed++;
    expect(allowed).toBe(30);
  });
});

describe("rate-limit core — fail-open on store outage", () => {
  it("allows the request and reports the error at most once per report interval", async () => {
    const failing: RateLimitStore = { hit: async () => { throw new Error("connection refused"); } };
    const onError = vi.fn();
    const store = new FailOpenStore(failing, onError, 60_000);
    expect((await checkRateLimit(store, "login:x:y", 10, WINDOW, 0)).ok).toBe(true);
    expect((await checkRateLimit(store, "login:x:y", 10, WINDOW, 1_000)).ok).toBe(true);
    expect(onError).toHaveBeenCalledTimes(1);
    expect((await checkRateLimit(store, "login:x:y", 10, WINDOW, 61_000)).ok).toBe(true);
    expect(onError).toHaveBeenCalledTimes(2);
  });

  it("passes through a healthy store unchanged", async () => {
    const store = new FailOpenStore(new MemoryStore(), vi.fn());
    for (let i = 0; i < 2; i++) await checkRateLimit(store, "k", 2, WINDOW, 0);
    expect((await checkRateLimit(store, "k", 2, WINDOW, 1)).ok).toBe(false);
  });
});

describe("rate-limit — Upstash REST driver (stubbed fetch)", () => {
  function fakeFetch(rows: unknown, status = 200): { fetch: FetchLike; calls: Array<{ url: string; init: Parameters<FetchLike>[1] }> } {
    const calls: Array<{ url: string; init: Parameters<FetchLike>[1] }> = [];
    const fetch: FetchLike = async (url, init) => {
      calls.push({ url, init });
      return { ok: status >= 200 && status < 300, status, json: async () => rows };
    };
    return { fetch, calls };
  }

  it("sends one pipelined INCR/PEXPIRE/PTTL request with a bearer token and parses the counter", async () => {
    const { fetch, calls } = fakeFetch([{ result: 3 }, { result: 1 }, { result: 599_000 }]);
    const store = new UpstashRestStore("https://example.upstash.io/", "secret-token", fetch);
    const hit = await store.hit("login:ip:mail", WINDOW, 1_000);
    expect(hit).toEqual({ count: 3, resetAt: 1_000 + 599_000 });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://example.upstash.io/pipeline");
    expect(calls[0].init.headers.Authorization).toBe("Bearer secret-token");
    expect(JSON.parse(calls[0].init.body)).toEqual([
      ["INCR", "login:ip:mail"],
      ["PEXPIRE", "login:ip:mail", String(WINDOW), "NX"],
      ["PTTL", "login:ip:mail"],
    ]);
  });

  it("falls back to now + window when the key has no TTL yet", async () => {
    const { fetch } = fakeFetch([{ result: 1 }, { result: 1 }, { result: -1 }]);
    const store = new UpstashRestStore("https://example.upstash.io", "t", fetch);
    expect((await store.hit("k", WINDOW, 5)).resetAt).toBe(5 + WINDOW);
  });

  it("throws on HTTP errors, malformed responses and command errors — so FailOpenStore can allow + log", async () => {
    await expect(new UpstashRestStore("https://u", "t", fakeFetch([], 500).fetch).hit("k", WINDOW, 0)).rejects.toThrow(/HTTP 500/);
    await expect(new UpstashRestStore("https://u", "t", fakeFetch({ nope: true }).fetch).hit("k", WINDOW, 0)).rejects.toThrow(/unexpected/);
    await expect(new UpstashRestStore("https://u", "t", fakeFetch([{ error: "WRONGTYPE" }, {}, {}]).fetch).hit("k", WINDOW, 0)).rejects.toThrow(/failed/);
    await expect(new UpstashRestStore("https://u", "t", fakeFetch([{ result: "abc" }, {}, {}]).fetch).hit("k", WINDOW, 0)).rejects.toThrow(/non-numeric/);

    const onError = vi.fn();
    const wrapped = new FailOpenStore(new UpstashRestStore("https://u", "tok-SECRET-9", fakeFetch([], 503).fetch), onError);
    expect((await checkRateLimit(wrapped, "login:a:b", 10, WINDOW, 0)).ok).toBe(true);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(String(onError.mock.calls[0][0])).not.toContain("tok-SECRET-9"); // the token is never part of the error
  });
});
