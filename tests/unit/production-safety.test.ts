import { afterEach, describe, expect, it } from "vitest";
import { ConfigurationError, isLocalDatabaseUrl, requireAuthSecret, requireEnv } from "@/lib/config/env";
import { hashValue } from "@/lib/services/tracking";
import { showDemoLogins } from "@/lib/utils/demo";
import { contentSecurityPolicy, securityHeaders } from "@/lib/config/security-headers";

const ORIGINAL_SECRET = process.env.AUTH_SECRET;

afterEach(() => {
  if (ORIGINAL_SECRET === undefined) delete process.env.AUTH_SECRET;
  else process.env.AUTH_SECRET = ORIGINAL_SECRET;
});

describe("AUTH_SECRET is required", () => {
  it("hashValue throws a ConfigurationError when AUTH_SECRET is missing or blank", () => {
    delete process.env.AUTH_SECRET;
    expect(() => hashValue("user@example.com")).toThrow(ConfigurationError);
    process.env.AUTH_SECRET = "   ";
    expect(() => hashValue("user@example.com")).toThrow(/AUTH_SECRET is not configured/);
  });

  it("the error names the variable but never leaks a value", () => {
    delete process.env.AUTH_SECRET;
    let message = "";
    try {
      requireAuthSecret();
    } catch (err) {
      message = (err as Error).message;
    }
    expect(message).toContain("AUTH_SECRET");
    expect(message).not.toMatch(/localgrowth|test-secret/);
  });

  it("with a secret set, hashValue is deterministic, salted and never echoes the input or secret", () => {
    process.env.AUTH_SECRET = "secret-one";
    const a = hashValue(" User@Example.com ");
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).toBe(hashValue("user@example.com")); // normalised
    expect(a).not.toContain("secret-one");
    process.env.AUTH_SECRET = "secret-two";
    expect(hashValue("user@example.com")).not.toBe(a); // salt matters
  });

  it("requireEnv reports other missing variables the same way", () => {
    delete process.env.__REFNIVO_TEST_VAR__;
    expect(() => requireEnv("__REFNIVO_TEST_VAR__")).toThrow(ConfigurationError);
  });
});

describe("demo logins are disabled in production", () => {
  it("never shows in production, even when the public flag says true", () => {
    expect(showDemoLogins({ NODE_ENV: "production", NEXT_PUBLIC_SHOW_DEMO_LOGINS: "true" })).toBe(false);
    expect(showDemoLogins({ NODE_ENV: "production" })).toBe(false);
  });
  it("shows in development unless explicitly disabled", () => {
    expect(showDemoLogins({ NODE_ENV: "development" })).toBe(true);
    expect(showDemoLogins({ NODE_ENV: "test", NEXT_PUBLIC_SHOW_DEMO_LOGINS: "false" })).toBe(false);
  });
});

describe("database migration safety", () => {
  it("recognises only local database hosts as safe for seeding/resetting", () => {
    expect(isLocalDatabaseUrl("postgresql://postgres:postgres@localhost:5433/localgrowth")).toBe(true);
    expect(isLocalDatabaseUrl("postgresql://postgres:postgres@127.0.0.1:5433/localgrowth")).toBe(true);
    expect(isLocalDatabaseUrl("postgresql://postgres.ref:pw@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres")).toBe(false);
    expect(isLocalDatabaseUrl("postgresql://user:pw@db.example.supabase.co:5432/postgres")).toBe(false);
    expect(isLocalDatabaseUrl(undefined)).toBe(false);
    expect(isLocalDatabaseUrl("not a url")).toBe(false);
  });
});

describe("security headers", () => {
  const prod = Object.fromEntries(securityHeaders(true).map((h) => [h.key, h.value]));
  const dev = Object.fromEntries(securityHeaders(false).map((h) => [h.key, h.value]));

  it("sets the required headers in production", () => {
    expect(prod["Strict-Transport-Security"]).toMatch(/max-age=\d+; includeSubDomains/);
    expect(prod["X-Content-Type-Options"]).toBe("nosniff");
    expect(prod["X-Frame-Options"]).toBe("DENY");
    expect(prod["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(prod["Permissions-Policy"]).toContain("camera=()");
    expect(prod["Content-Security-Policy"]).toBeTruthy();
  });

  it("production CSP is strict where it can be and permits what the app actually needs", () => {
    const csp = contentSecurityPolicy(true);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("upgrade-insecure-requests");
    expect(csp).not.toContain("unsafe-eval");
    // user-supplied product/brand images + data: QR codes
    expect(csp).toMatch(/img-src [^;]*https:/);
    expect(csp).toMatch(/img-src [^;]*data:/);
    expect(csp).toMatch(/connect-src 'self'(;|$)/);
    expect(csp).not.toMatch(/\*/);
  });

  it("development relaxes only what HMR needs and skips HSTS", () => {
    expect(dev["Strict-Transport-Security"]).toBeUndefined();
    expect(dev["Content-Security-Policy"]).toContain("unsafe-eval");
    expect(dev["Content-Security-Policy"]).toContain("ws:");
  });
});
