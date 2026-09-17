import { afterEach, describe, expect, it } from "vitest";
import { buildRequestContext, getRequestContext, USER_AGENT_MAX } from "@/lib/utils/request-context";
import { hashValue } from "@/lib/services/tracking";

const ORIGINAL_SECRET = process.env.AUTH_SECRET;
afterEach(() => {
  if (ORIGINAL_SECRET === undefined) delete process.env.AUTH_SECRET;
  else process.env.AUTH_SECRET = ORIGINAL_SECRET;
});

const headers = (map: Record<string, string>) => (name: string) => map[name.toLowerCase()] ?? null;

describe("request context for audit logs", () => {
  it("hashes the first forwarded IP with the AUTH_SECRET salt and never keeps the raw address", () => {
    process.env.AUTH_SECRET = "ctx-secret";
    const ctx = buildRequestContext(headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1", "user-agent": "UA/2.0", "x-request-id": "req-123" }));
    expect(ctx.ipHash).toBe(hashValue("203.0.113.7"));
    expect(ctx.ipHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(ctx)).not.toContain("203.0.113.7");
    expect(ctx.userAgent).toBe("UA/2.0");
    expect(ctx.requestId).toBe("req-123");
  });

  it("prefers the platform request id, falls back to x-request-id, then a generated UUID", () => {
    expect(buildRequestContext(headers({ "x-vercel-id": "iad1::abc", "x-request-id": "r2" })).requestId).toBe("iad1::abc");
    expect(buildRequestContext(headers({ "x-request-id": "r2" })).requestId).toBe("r2");
    expect(buildRequestContext(headers({})).requestId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("uses x-real-ip when x-forwarded-for is absent and yields null without any IP header", () => {
    process.env.AUTH_SECRET = "ctx-secret";
    expect(buildRequestContext(headers({ "x-real-ip": "198.51.100.2" })).ipHash).toBe(hashValue("198.51.100.2"));
    expect(buildRequestContext(headers({})).ipHash).toBeNull();
  });

  it("never falls back to a raw IP when AUTH_SECRET is missing", () => {
    delete process.env.AUTH_SECRET;
    const ctx = buildRequestContext(headers({ "x-forwarded-for": "203.0.113.7" }));
    expect(ctx.ipHash).toBeNull();
  });

  it("truncates the user agent and request id", () => {
    const ctx = buildRequestContext(headers({ "user-agent": "x".repeat(1000), "x-request-id": "y".repeat(500) }));
    expect(ctx.userAgent).toHaveLength(USER_AGENT_MAX);
    expect(ctx.requestId).toHaveLength(120);
  });

  it("getRequestContext returns null outside a request scope instead of throwing (scripts, seeds, tests)", async () => {
    await expect(getRequestContext()).resolves.toBeNull();
  });
});
