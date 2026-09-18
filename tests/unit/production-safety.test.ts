import { afterEach, describe, expect, it } from "vitest";
import { getBootState, isMisconfigured, resetBootState } from "@/lib/config/boot-state";
import { databaseUrlNeedsPgbouncerFlag, normalizeDatabaseUrl } from "@/lib/config/database-url";
import { AUTH_SECRET_MIN_LENGTH, authSecretAtBoot, ConfigurationError, isBuildPhase, isLocalDatabaseUrl, requireAuthSecret, requireEnv, validateProductionEnv } from "@/lib/config/env";
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

describe("validateProductionEnv", () => {
  const SECRET = "x".repeat(AUTH_SECRET_MIN_LENGTH) + "Kq9";
  const DB_PASSWORD = "ProdDbPw-8f3a";
  const valid: NodeJS.ProcessEnv = {
    NODE_ENV: "production",
    AUTH_SECRET: SECRET,
    DATABASE_URL: `postgresql://postgres.ref:${DB_PASSWORD}@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true`,
    NEXT_PUBLIC_APP_URL: "https://app.refnivo.example",
    NEXTAUTH_URL: "https://app.refnivo.example",
    RATE_LIMIT_PROVIDER: "memory",
    RATE_LIMIT_ALLOW_MEMORY: "1",
    STORAGE_PROVIDER: "local",
    STORAGE_ALLOW_LOCAL: "1",
    PAYMENT_PROVIDER: "NONE",
    PAYMENTS_ENABLED: "false",
    EMAIL_PROVIDER: "resend",
    RESEND_API_KEY: "re_test_key_value",
    EMAIL_FROM: "Refnivo AI <no-reply@refnivo.example>",
  };

  it("never blocks development or test environments", () => {
    expect(validateProductionEnv({ NODE_ENV: "development" })).toEqual({ errors: [], warnings: [] });
    expect(validateProductionEnv({ NODE_ENV: "test", AUTH_SECRET: "short" })).toEqual({ errors: [], warnings: [] });
    expect(validateProductionEnv({} as unknown as NodeJS.ProcessEnv)).toEqual({ errors: [], warnings: [] });
  });

  it("accepts a complete production configuration", () => {
    expect(validateProductionEnv(valid)).toEqual({ errors: [], warnings: [] });
    expect(validateProductionEnv({ ...valid, NEXTAUTH_URL: undefined, AUTH_URL: "https://app.refnivo.example" }).errors).toEqual([]);
  });

  it("reports every missing required variable by name", () => {
    const { errors } = validateProductionEnv({ NODE_ENV: "production" });
    expect(errors.join(" ")).toContain("AUTH_SECRET");
    expect(errors.join(" ")).toContain("DATABASE_URL");
    expect(errors.join(" ")).toContain("NEXT_PUBLIC_APP_URL");
    expect(errors.join(" ")).toContain("NEXTAUTH_URL");
  });

  it("requires AUTH_SECRET to be long and not a placeholder", () => {
    expect(validateProductionEnv({ ...valid, AUTH_SECRET: "tooshort" }).errors.join(" ")).toMatch(/AUTH_SECRET must be at least/);
    expect(validateProductionEnv({ ...valid, AUTH_SECRET: "replace-with-a-long-random-secret-value-xx" }).errors.join(" ")).toMatch(/placeholder/);
  });

  it("refuses a local database, an unparseable URL, and a pooler port without pgbouncer=true", () => {
    expect(validateProductionEnv({ ...valid, DATABASE_URL: "postgresql://postgres:postgres@localhost:5433/localgrowth" }).errors.join(" ")).toMatch(/local database/);
    expect(validateProductionEnv({ ...valid, DATABASE_URL: "nope" }).errors.join(" ")).toMatch(/could not be parsed/);
    const pooler = validateProductionEnv({ ...valid, DATABASE_URL: "postgresql://u:p@aws-0-ap-south-1.pooler.supabase.com:6543/postgres" });
    expect(pooler.errors).toEqual([]); // the client adds pgbouncer=true itself
    expect(pooler.warnings.join(" ")).toMatch(/pgbouncer=true was added automatically/);
  });

  it("requires https public and canonical URLs", () => {
    expect(validateProductionEnv({ ...valid, NEXT_PUBLIC_APP_URL: "http://app.refnivo.example" }).errors.join(" ")).toMatch(/NEXT_PUBLIC_APP_URL must be an https/);
    expect(validateProductionEnv({ ...valid, NEXTAUTH_URL: "http://app.refnivo.example" }).errors.join(" ")).toMatch(/NEXTAUTH_URL \/ AUTH_URL must be an https/);
    expect(validateProductionEnv({ ...valid, NEXTAUTH_URL: "" }).errors.join(" ")).toMatch(/NEXTAUTH_URL \(or AUTH_URL\) is not set/);
  });

  it("refuses start-up when live payment flags are enabled", () => {
    expect(validateProductionEnv({ ...valid, PAYMENTS_ENABLED: "true" }).errors.join(" ")).toMatch(/PAYMENTS_ENABLED=true is not supported/);
    expect(validateProductionEnv({ ...valid, PAYMENT_PROVIDER: "PHONEPE" }).errors.join(" ")).toMatch(/PAYMENT_PROVIDER must be NONE/);
    expect(validateProductionEnv({ ...valid, PAYMENT_PROVIDER: "" }).errors).toEqual([]); // blank == NONE
  });

  it("warns (does not fail) about payment keys present while payments are disabled, naming variables only", () => {
    const r = validateProductionEnv({ ...valid, PHONEPE_SALT_KEY: "live-salt-value-123" });
    expect(r.errors).toEqual([]);
    expect(r.warnings.join(" ")).toContain("PHONEPE_SALT_KEY");
    expect(r.warnings.join(" ")).not.toContain("live-salt-value-123");
  });

  it("validates the e-mail provider configuration and warns when e-mail is console-only", () => {
    expect(validateProductionEnv({ ...valid, EMAIL_PROVIDER: "resend", RESEND_API_KEY: "" }).errors.join(" ")).toMatch(/RESEND_API_KEY and EMAIL_FROM/);
    expect(validateProductionEnv({ ...valid, EMAIL_PROVIDER: "sendgrid" }).errors.join(" ")).toMatch(/EMAIL_PROVIDER must be one of/);
    const console_ = validateProductionEnv({ ...valid, EMAIL_PROVIDER: "console", RESEND_API_KEY: undefined, EMAIL_FROM: undefined });
    expect(console_.errors).toEqual([]);
    expect(console_.warnings.join(" ")).toMatch(/EMAIL_PROVIDER is console/);
    expect(console_.warnings.join(" ")).not.toContain("re_test_key_value");
  });

  it("validates the rate-limit provider configuration", () => {
    expect(validateProductionEnv({ ...valid, RATE_LIMIT_PROVIDER: "upstash" }).errors.join(" ")).toMatch(/UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN/);
    expect(
      validateProductionEnv({ ...valid, RATE_LIMIT_PROVIDER: "upstash", UPSTASH_REDIS_REST_URL: "https://x.upstash.io", UPSTASH_REDIS_REST_TOKEN: "tok" }).errors,
    ).toEqual([]);
    expect(validateProductionEnv({ ...valid, RATE_LIMIT_PROVIDER: "redis" }).errors.join(" ")).toMatch(/must be one of/);
    const memory = validateProductionEnv({ ...valid, RATE_LIMIT_ALLOW_MEMORY: undefined });
    expect(memory.errors).toEqual([]);
    expect(memory.warnings.join(" ")).toMatch(/per-instance/);
  });

  it("warns about dev escape hatches and local storage in production", () => {
    const r = validateProductionEnv({ ...valid, SEED_ALLOW_REMOTE: "1", ADMIN_ALLOW_LOCAL: "1", STORAGE_ALLOW_LOCAL: undefined });
    expect(r.errors).toEqual([]);
    expect(r.warnings.join(" ")).toContain("SEED_ALLOW_REMOTE");
    expect(r.warnings.join(" ")).toContain("ADMIN_ALLOW_LOCAL");
    expect(r.warnings.join(" ")).toMatch(/STORAGE_PROVIDER is local/);
  });

  it("never includes secret values in any message", () => {
    const broken = { ...valid, NEXT_PUBLIC_APP_URL: "http://x", PAYMENTS_ENABLED: "true", RATE_LIMIT_PROVIDER: "upstash", UPSTASH_REDIS_REST_TOKEN: "tok-secret-1" };
    const r = validateProductionEnv(broken);
    const all = [...r.errors, ...r.warnings].join(" ");
    expect(all).not.toContain("re_test_key_value");
    expect(all).not.toContain(SECRET);
    expect(all).not.toContain(DB_PASSWORD);
    expect(all).not.toContain("tok-secret-1");
    expect(all).not.toContain("postgresql://");
  });
});

describe("AUTH_SECRET at boot vs at build", () => {
  const env = (v: Record<string, string | undefined>) => v as unknown as NodeJS.ProcessEnv;

  it("hard-fails at runtime when the secret is missing or blank", () => {
    expect(() => authSecretAtBoot(env({}))).toThrow(ConfigurationError);
    expect(() => authSecretAtBoot(env({ AUTH_SECRET: "   " }))).toThrow(/AUTH_SECRET is not configured/);
    expect(() => authSecretAtBoot(env({ NODE_ENV: "production" }))).toThrow(ConfigurationError);
  });

  it("returns the secret when present, in any phase", () => {
    expect(authSecretAtBoot(env({ AUTH_SECRET: "s".repeat(40) }))).toBe("s".repeat(40));
    expect(authSecretAtBoot(env({ AUTH_SECRET: "s".repeat(40), NEXT_PHASE: "phase-production-build" }))).toBe("s".repeat(40));
  });

  it("does not throw during `next build` (no secrets are needed to compile) — the runtime boot check still enforces it", () => {
    expect(isBuildPhase(env({ NEXT_PHASE: "phase-production-build" }))).toBe(true);
    expect(isBuildPhase(env({}))).toBe(false);
    expect(authSecretAtBoot(env({ NEXT_PHASE: "phase-production-build" }))).toBeUndefined();
    expect(validateProductionEnv(env({ NODE_ENV: "production", NEXT_PHASE: "phase-production-build" })).errors.join(" ")).toContain("AUTH_SECRET");
  });
});

describe("boot state (self-diagnosing misconfiguration)", () => {
  const env = (v: Record<string, string | undefined>) => v as unknown as NodeJS.ProcessEnv;
  afterEach(() => resetBootState());

  it("reports failing rules by name in production and caches the verdict", () => {
    resetBootState();
    const state = getBootState(env({ NODE_ENV: "production", AUTH_SECRET: "short" }));
    expect(state.ok).toBe(false);
    expect(state.errors.join(" ")).toContain("AUTH_SECRET");
    expect(state.errors.join(" ")).toContain("DATABASE_URL");
    expect(JSON.stringify(state)).not.toContain("short");
    // Cached: a later call (e.g. from a request) sees the same verdict without re-reading the environment.
    expect(getBootState(env({}))).toBe(state);
  });

  it("is ok outside production and during `next build` (never bakes the maintenance page into static HTML)", () => {
    resetBootState();
    expect(getBootState(env({ NODE_ENV: "development" })).ok).toBe(true);
    resetBootState();
    expect(getBootState(env({ NODE_ENV: "production", NEXT_PHASE: "phase-production-build" })).ok).toBe(true);
    resetBootState();
    // The test process itself is not production, so the app is never marked misconfigured here.
    expect(isMisconfigured()).toBe(false);
  });
});

describe("DATABASE_URL normalisation (Supabase transaction pooler)", () => {
  const POOLER = "postgresql://postgres.ref:Pass123@aws-0-ap-south-1.pooler.supabase.com:6543/postgres";

  it("appends pgbouncer=true to a bare 6543 pooler URL and leaves everything else intact", () => {
    expect(databaseUrlNeedsPgbouncerFlag(POOLER)).toBe(true);
    expect(normalizeDatabaseUrl(POOLER)).toBe(`${POOLER}?pgbouncer=true`);
    expect(normalizeDatabaseUrl(`${POOLER}?sslmode=require`)).toBe(`${POOLER}?sslmode=require&pgbouncer=true`);
  });

  it("does not touch URLs that already carry the flag, use other ports, or are local", () => {
    expect(normalizeDatabaseUrl(`${POOLER}?pgbouncer=true`)).toBe(`${POOLER}?pgbouncer=true`);
    const session = "postgresql://postgres.ref:Pass123@aws-0-ap-south-1.pooler.supabase.com:5432/postgres";
    expect(normalizeDatabaseUrl(session)).toBe(session);
    const local = "postgresql://postgres:postgres@localhost:5433/localgrowth?schema=public";
    expect(normalizeDatabaseUrl(local)).toBe(local);
  });

  it("strips stray copy-paste quotes and passes through unparseable or empty values", () => {
    expect(normalizeDatabaseUrl(`"${POOLER}"`)).toBe(`${POOLER}?pgbouncer=true`);
    expect(normalizeDatabaseUrl("not a url")).toBe("not a url");
    expect(normalizeDatabaseUrl(undefined)).toBeUndefined();
    expect(normalizeDatabaseUrl("")).toBe("");
  });
});
