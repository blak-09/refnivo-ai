import { describe, expect, it } from "vitest";
import { decideBootstrap, isDeniedPassword, preflight, type BootstrapEnv } from "../../scripts/lib/admin-bootstrap";

const HOST = "aws-0-ap-northeast-1.pooler.supabase.com";
const REMOTE = `postgresql://postgres.ref:TopSecretPw9@${HOST}:6543/postgres?pgbouncer=true`;
const LOCAL = "postgresql://postgres:postgres@localhost:5433/localgrowth";
const GOOD_PASSWORD = "Correct-Horse-Battery-42";

const base: BootstrapEnv = {
  DATABASE_URL: REMOTE,
  ADMIN_BOOTSTRAP_CONFIRM: HOST,
  ADMIN_EMAIL: "Ops@Company.com",
  ADMIN_NAME: "Ops Admin",
  ADMIN_PASSWORD: GOOD_PASSWORD,
};

function refusal(env: BootstrapEnv) {
  const r = preflight(env);
  expect(r.ok).toBe(false);
  return r.ok ? null : r;
}

describe("admin bootstrap — preflight (no database)", () => {
  it("passes with a confirmed remote target, valid email and strong password (email normalised)", () => {
    const r = preflight(base);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.email).toBe("ops@company.com");
      expect(r.name).toBe("Ops Admin");
      expect(r.target.host).toBe(HOST);
    }
  });

  it("refuses a missing or unparseable DATABASE_URL", () => {
    expect(refusal({ ...base, DATABASE_URL: undefined })?.code).toBe("NO_DATABASE_URL");
    expect(refusal({ ...base, DATABASE_URL: "nope" })?.code).toBe("BAD_DATABASE_URL");
  });

  it("refuses a LOCAL target unless ADMIN_ALLOW_LOCAL=1", () => {
    expect(refusal({ ...base, DATABASE_URL: LOCAL, ADMIN_BOOTSTRAP_CONFIRM: "localhost" })?.code).toBe("LOCAL_TARGET");
    expect(preflight({ ...base, DATABASE_URL: LOCAL, ADMIN_BOOTSTRAP_CONFIRM: "localhost", ADMIN_ALLOW_LOCAL: "1" }).ok).toBe(true);
  });

  it("requires ADMIN_BOOTSTRAP_CONFIRM to equal the target hostname exactly", () => {
    expect(refusal({ ...base, ADMIN_BOOTSTRAP_CONFIRM: undefined })?.code).toBe("CONFIRM_MISSING");
    expect(refusal({ ...base, ADMIN_BOOTSTRAP_CONFIRM: "" })?.code).toBe("CONFIRM_MISSING");
    expect(refusal({ ...base, ADMIN_BOOTSTRAP_CONFIRM: "supabase.com" })?.code).toBe("CONFIRM_MISMATCH");
    expect(refusal({ ...base, ADMIN_BOOTSTRAP_CONFIRM: HOST.toUpperCase() })?.code).toBe("CONFIRM_MISMATCH");
    expect(refusal({ ...base, ADMIN_BOOTSTRAP_CONFIRM: "yes" })?.code).toBe("CONFIRM_MISMATCH");
  });

  it("refuses invalid and demo-domain emails", () => {
    expect(refusal({ ...base, ADMIN_EMAIL: "" })?.code).toBe("BAD_EMAIL");
    expect(refusal({ ...base, ADMIN_EMAIL: "not-an-email" })?.code).toBe("BAD_EMAIL");
    expect(refusal({ ...base, ADMIN_EMAIL: "admin@localgrowth.demo" })?.code).toBe("DEMO_EMAIL");
  });

  it("refuses weak passwords", () => {
    expect(refusal({ ...base, ADMIN_PASSWORD: "" })?.code).toBe("WEAK_PASSWORD");
    expect(refusal({ ...base, ADMIN_PASSWORD: "Short1" })?.code).toBe("WEAK_PASSWORD");
    expect(refusal({ ...base, ADMIN_PASSWORD: "onlylettersherexx" })?.code).toBe("WEAK_PASSWORD");
    expect(refusal({ ...base, ADMIN_PASSWORD: "1234567890123456" })?.code).toBe("WEAK_PASSWORD");
  });

  it("refuses known exposed/demo passwords by hash", () => {
    expect(isDeniedPassword("Demo@1234")).toBe(true);
    expect(isDeniedPassword(GOOD_PASSWORD)).toBe(false);
    // Short denied values fail the length rule first; long ones hit the deny-list.
    expect(refusal({ ...base, ADMIN_PASSWORD: "Demo@1234" })?.code).toBe("WEAK_PASSWORD");
    expect(refusal({ ...base, ADMIN_PASSWORD: "Password1234" })?.code).toBe("DENIED_PASSWORD");
    expect(refusal({ ...base, ADMIN_PASSWORD: "Admin@123456" })?.code).toBe("DENIED_PASSWORD");
  });

  it("never echoes the password or the connection string in messages", () => {
    for (const env of [
      { ...base, ADMIN_BOOTSTRAP_CONFIRM: "wrong" },
      { ...base, ADMIN_PASSWORD: "Short1" },
      { ...base, ADMIN_EMAIL: "bad" },
      { ...base, DATABASE_URL: LOCAL, ADMIN_BOOTSTRAP_CONFIRM: "localhost" },
    ]) {
      const r = preflight(env);
      const text = r.ok ? "" : r.message;
      expect(text).not.toContain(GOOD_PASSWORD);
      expect(text).not.toContain("Short1");
      expect(text).not.toContain("TopSecretPw9");
      expect(text).not.toContain("postgresql://");
    }
  });
});

describe("admin bootstrap — decision (after consulting the database)", () => {
  it("creates when the email is new and no admin exists", () => {
    expect(decideBootstrap({ existing: null, otherAdmins: 0, env: base })).toEqual({ action: "create" });
  });

  it("never overwrites or promotes an existing non-admin account", () => {
    const d = decideBootstrap({ existing: { id: "u1", role: "BRAND_OWNER", status: "APPROVED" }, otherAdmins: 0, env: base });
    expect(d.action).toBe("refuse");
    if (d.action === "refuse") expect(d.code).toBe("EMAIL_EXISTS_NOT_ADMIN");
    const d2 = decideBootstrap({ existing: { id: "u1", role: "CUSTOMER", status: "PENDING" }, otherAdmins: 0, env: { ...base, ADMIN_ROTATE_EXISTING: "1" } });
    expect(d2.action).toBe("refuse");
  });

  it("refuses an existing admin email by default and rotates only with ADMIN_ROTATE_EXISTING=1", () => {
    const existing = { id: "a1", role: "ADMIN", status: "APPROVED" };
    const d = decideBootstrap({ existing, otherAdmins: 0, env: base });
    expect(d.action).toBe("refuse");
    if (d.action === "refuse") expect(d.code).toBe("EMAIL_EXISTS");
    expect(decideBootstrap({ existing, otherAdmins: 0, env: { ...base, ADMIN_ROTATE_EXISTING: "1" } })).toEqual({ action: "rotate", userId: "a1" });
  });

  it("refuses a second admin by default and allows it only with ADMIN_ALLOW_ADDITIONAL=1", () => {
    const d = decideBootstrap({ existing: null, otherAdmins: 1, env: base });
    expect(d.action).toBe("refuse");
    if (d.action === "refuse") expect(d.code).toBe("ADMIN_EXISTS");
    expect(decideBootstrap({ existing: null, otherAdmins: 1, env: { ...base, ADMIN_ALLOW_ADDITIONAL: "1" } })).toEqual({ action: "create" });
  });
});
