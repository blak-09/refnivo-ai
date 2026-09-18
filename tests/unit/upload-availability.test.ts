import { describe, expect, it } from "vitest";
import { uploadsAvailable } from "@/lib/storage/availability";
import { validateProductionEnv } from "@/lib/config/env";

const env = (vars: Record<string, string>) => vars as NodeJS.ProcessEnv;

describe("uploadsAvailable (STOR-01: never attempt writes the host will refuse)", () => {
  it("unknown providers are not writable", () => {
    expect(uploadsAvailable(env({ NODE_ENV: "production", STORAGE_PROVIDER: "s3" }))).toBe(false);
  });
  it("local storage works outside production", () => {
    expect(uploadsAvailable(env({ NODE_ENV: "development" }))).toBe(true);
    expect(uploadsAvailable(env({ NODE_ENV: "test", STORAGE_PROVIDER: "local" }))).toBe(true);
  });
  it("local storage in production needs an explicit opt-in", () => {
    expect(uploadsAvailable(env({ NODE_ENV: "production" }))).toBe(false);
    expect(uploadsAvailable(env({ NODE_ENV: "production", STORAGE_PROVIDER: "local" }))).toBe(false);
    expect(uploadsAvailable(env({ NODE_ENV: "production", STORAGE_PROVIDER: "local", STORAGE_ALLOW_LOCAL: "1" }))).toBe(true);
  });
  it("a configured supabase provider is writable", () => {
    expect(uploadsAvailable(env({ NODE_ENV: "production", STORAGE_PROVIDER: "supabase", SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "k" }))).toBe(true);
  });
});

describe("production warnings surfaced on /api/health", () => {
  const base = {
    NODE_ENV: "production",
    AUTH_SECRET: "x".repeat(40),
    DATABASE_URL: "postgresql://u:p@db.example.net:6543/app?pgbouncer=true",
    NEXT_PUBLIC_APP_URL: "https://app.example.com",
    NEXTAUTH_URL: "https://app.example.com",
  } as NodeJS.ProcessEnv;
  it("names the missing cron secret and disabled uploads without printing values", () => {
    const { warnings, errors } = validateProductionEnv(base);
    expect(errors).toEqual([]);
    expect(warnings.join("\n")).toContain("CRON_SECRET");
    expect(warnings.join("\n")).toContain("image uploads are disabled");
    expect(validateProductionEnv({ ...base, CRON_SECRET: "topsecret" }).warnings.join("\n")).not.toContain("topsecret");
  });
});

describe("unknown STORAGE_PROVIDER never blocks boot", () => {
  it("is a warning, and uploads are unavailable", () => {
    const base = {
      NODE_ENV: "production",
      AUTH_SECRET: "x".repeat(40),
      DATABASE_URL: "postgresql://u:p@db.example.net:6543/app?pgbouncer=true",
      NEXT_PUBLIC_APP_URL: "https://app.example.com",
      NEXTAUTH_URL: "https://app.example.com",
      STORAGE_PROVIDER: "vercel-blob",
    } as NodeJS.ProcessEnv;
    const report = validateProductionEnv(base);
    expect(report.errors).toEqual([]);
    expect(report.warnings.join(" ")).toContain("STORAGE_PROVIDER");
    expect(uploadsAvailable(base)).toBe(false);
  });
});
