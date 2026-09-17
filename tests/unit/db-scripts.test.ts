import { describe, expect, it } from "vitest";
import { assertLocalTarget, describeDatabaseUrl, formatTarget } from "../../scripts/lib/db-url";
import { decideDeploy, needsBaseline } from "../../scripts/lib/deploy-guard";
import { LOCAL_ONLY_COMMANDS } from "../../scripts/lib/local-only-commands";

const LOCAL = "postgresql://postgres:postgres@localhost:5433/localgrowth?schema=public";
const LOCAL_TEST = "postgresql://postgres:postgres@127.0.0.1:5433/localgrowth_test?schema=public";
const SUPABASE_POOLER = "postgresql://postgres.abcdefghijklmnop:SuperSecretPw1@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true";
const SUPABASE_DIRECT = "postgresql://postgres:SuperSecretPw1@db.abcdefghijklmnop.supabase.co:5432/postgres";
const NEON = "postgresql://user:SuperSecretPw1@ep-cool-name-123456-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";

describe("local-only guard (db:push:local / db:reset:local / db:migrate)", () => {
  it("allows localhost, 127.0.0.1 and ::1 outside production", () => {
    expect(assertLocalTarget(LOCAL, "development").ok).toBe(true);
    expect(assertLocalTarget(LOCAL_TEST, "test").ok).toBe(true);
    expect(assertLocalTarget("postgresql://u:p@[::1]:5433/db", undefined).ok).toBe(true);
  });

  it("refuses Supabase, Neon and any other remote host", () => {
    for (const url of [SUPABASE_POOLER, SUPABASE_DIRECT, NEON, "postgresql://u:p@db.internal:5432/app"]) {
      const v = assertLocalTarget(url, "development");
      expect(v.ok).toBe(false);
      if (!v.ok) expect(v.reason).toMatch(/REMOTE/);
    }
  });

  it("refuses when NODE_ENV is production even for a local host", () => {
    const v = assertLocalTarget(LOCAL, "production");
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toMatch(/production/);
  });

  it("refuses a missing or unparseable DATABASE_URL", () => {
    expect(assertLocalTarget(undefined, "development").ok).toBe(false);
    expect(assertLocalTarget("", "development").ok).toBe(false);
    expect(assertLocalTarget("not a url", "development").ok).toBe(false);
  });

  it("never includes the username or password in reasons or target descriptions", () => {
    for (const url of [SUPABASE_POOLER, SUPABASE_DIRECT, NEON]) {
      const v = assertLocalTarget(url, "development");
      const text = `${v.ok ? "" : v.reason} ${formatTarget(v.target)}`;
      expect(text).not.toContain("SuperSecretPw1");
      expect(text).not.toMatch(/postgres\.abcdefghijklmnop|:user@/);
    }
  });

  it("only exposes a fixed allow-list of sub-commands", () => {
    expect(Object.keys(LOCAL_ONLY_COMMANDS).sort()).toEqual(["migrate-dev", "push", "reset"]);
    for (const cmd of Object.values(LOCAL_ONLY_COMMANDS)) expect(cmd).toMatch(/^npx prisma (db push|migrate reset --force|migrate dev)$/);
    expect(LOCAL_ONLY_COMMANDS["rm -rf"]).toBeUndefined();
  });
});

describe("db:deploy guard", () => {
  it("runs against a local target without confirmation", () => {
    expect(decideDeploy({ url: LOCAL, confirmHost: undefined }).ok).toBe(true);
  });

  it("refuses a remote target without DB_DEPLOY_CONFIRM_HOST", () => {
    const v = decideDeploy({ url: SUPABASE_POOLER, confirmHost: undefined });
    expect(v.ok).toBe(false);
    if (!v.ok) {
      expect(v.reason).toContain("DB_DEPLOY_CONFIRM_HOST");
      expect(v.reason).toContain("aws-0-ap-northeast-1.pooler.supabase.com");
      expect(v.reason).not.toContain("SuperSecretPw1");
    }
  });

  it("refuses when the confirmation does not match the hostname exactly", () => {
    expect(decideDeploy({ url: SUPABASE_POOLER, confirmHost: "pooler.supabase.com" }).ok).toBe(false);
    expect(decideDeploy({ url: SUPABASE_POOLER, confirmHost: "db.abcdefghijklmnop.supabase.co" }).ok).toBe(false);
    expect(decideDeploy({ url: SUPABASE_POOLER, confirmHost: "AWS-0-AP-NORTHEAST-1.POOLER.SUPABASE.COM" }).ok).toBe(false);
  });

  it("allows a remote target when the confirmation matches", () => {
    const v = decideDeploy({ url: SUPABASE_POOLER, confirmHost: " aws-0-ap-northeast-1.pooler.supabase.com " });
    expect(v.ok).toBe(true);
  });

  it("refuses missing/unparseable URLs", () => {
    expect(decideDeploy({ url: undefined, confirmHost: "x" }).ok).toBe(false);
    expect(decideDeploy({ url: "nope", confirmHost: "x" }).ok).toBe(false);
  });

  it("detects a database that must be baselined first (P3005)", () => {
    expect(needsBaseline("Error: P3005\n\nThe database schema is not empty.")).toBe(true);
    expect(needsBaseline('relation "_prisma_migrations" does not exist')).toBe(true);
    expect(needsBaseline("4 migrations found in prisma/migrations\n\nDatabase schema is up to date!")).toBe(false);
    expect(needsBaseline("Following migrations have not yet been applied:\n20260917100000_user_session_security")).toBe(false);
  });
});

describe("describeDatabaseUrl", () => {
  it("reports pooler flags and locality without credentials", () => {
    const t = describeDatabaseUrl(SUPABASE_POOLER);
    expect(t).toMatchObject({ ok: true, host: "aws-0-ap-northeast-1.pooler.supabase.com", port: "6543", database: "postgres", pgbouncer: true, local: false });
    expect(JSON.stringify(t)).not.toContain("SuperSecretPw1");
    expect(describeDatabaseUrl(LOCAL)).toMatchObject({ local: true, port: "5433" });
  });
});
