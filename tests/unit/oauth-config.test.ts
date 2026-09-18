import { describe, expect, it } from "vitest";
import { googleOAuthConfig, googleOAuthEnabled, validateGoogleOAuthEnv } from "@/lib/config/oauth";
import { validateProductionEnv } from "@/lib/config/env";

const env = (vars: Record<string, string>) => ({ NODE_ENV: "test", ...vars }) as NodeJS.ProcessEnv;

describe("google OAuth config", () => {
  it("is disabled when nothing is set, and never half-enabled", () => {
    expect(googleOAuthEnabled(env({}))).toBe(false);
    expect(googleOAuthConfig(env({ GOOGLE_CLIENT_ID: "id" }))).toBeNull();
    expect(googleOAuthConfig(env({ GOOGLE_CLIENT_SECRET: "s" }))).toBeNull();
    expect(googleOAuthConfig(env({ GOOGLE_CLIENT_ID: "  ", GOOGLE_CLIENT_SECRET: "s" }))).toBeNull();
  });

  it("reads GOOGLE_CLIENT_ID/SECRET, with the Auth.js AUTH_GOOGLE_* names as aliases", () => {
    expect(googleOAuthConfig(env({ GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "sec" }))).toEqual({ clientId: "id", clientSecret: "sec" });
    expect(googleOAuthConfig(env({ AUTH_GOOGLE_ID: "id2", AUTH_GOOGLE_SECRET: "sec2" }))).toEqual({ clientId: "id2", clientSecret: "sec2" });
  });

  it("validation: both-or-neither (unset is a silent feature-off); messages name variables only", () => {
    expect(validateGoogleOAuthEnv(env({}))).toBeNull();
    const half = validateGoogleOAuthEnv(env({ GOOGLE_CLIENT_ID: "abc-secret-id" }));
    expect(half).toContain("GOOGLE_CLIENT_SECRET");
    expect(half).not.toContain("abc-secret-id");
    expect(validateGoogleOAuthEnv(env({ GOOGLE_CLIENT_ID: "a", GOOGLE_CLIENT_SECRET: "b" }))).toBeNull();
  });

  it("production boot refuses a half-configured provider", () => {
    const base = {
      NODE_ENV: "production",
      AUTH_SECRET: "x".repeat(40),
      DATABASE_URL: "postgresql://u:p@db.example.net:6543/app?pgbouncer=true",
      NEXT_PUBLIC_APP_URL: "https://app.example.com",
      NEXTAUTH_URL: "https://app.example.com",
    } as NodeJS.ProcessEnv;
    expect(validateProductionEnv({ ...base, GOOGLE_CLIENT_SECRET: "only-secret" }).errors.join(" ")).toContain("GOOGLE_CLIENT_ID");
    expect(validateProductionEnv({ ...base, GOOGLE_CLIENT_ID: "a", GOOGLE_CLIENT_SECRET: "b" }).errors).toEqual([]);
  });
});
