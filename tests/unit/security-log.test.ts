import { afterEach, describe, expect, it, vi } from "vitest";
import { formatSecurityEvent, maskEmail, redact, REDACTED, securityEvent, stripUrlCredentials } from "@/lib/utils/security-log";
import { describeError, errorHint, logServerError } from "@/lib/utils/server-log";

const PASSWORD = "Hunter2-Very-Secret-42";
const TOKEN = "eyJhbGciOiJIUzI1NiJ9.super.secret";
const DB_URL = "postgresql://postgres.ref:DbPassw0rd!@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true";

afterEach(() => vi.restoreAllMocks());

describe("security log redaction", () => {
  it("drops secret-looking keys entirely (password, token, cookie, authorization, api keys, session, otp)", () => {
    const out = redact({
      password: PASSWORD,
      newPassword: PASSWORD,
      passwd: PASSWORD,
      token: TOKEN,
      accessToken: TOKEN,
      cookie: "authjs.session-token=abc",
      authorization: `Bearer ${TOKEN}`,
      apiKey: "sk-live-123",
      API_KEY: "sk-live-123",
      PHONEPE_SALT_KEY: "salt-value",
      clientSecret: "s3cr3t",
      sessionToken: "x",
      otp: "123456",
      keep: "visible",
    }) as Record<string, unknown>;
    for (const k of ["password", "newPassword", "passwd", "token", "accessToken", "cookie", "authorization", "apiKey", "API_KEY", "PHONEPE_SALT_KEY", "clientSecret", "sessionToken", "otp"]) {
      expect(out[k]).toBe(REDACTED);
    }
    expect(out.keep).toBe("visible");
    const json = JSON.stringify(out);
    expect(json).not.toContain(PASSWORD);
    expect(json).not.toContain(TOKEN);
    expect(json).not.toContain("sk-live-123");
    expect(json).not.toContain("salt-value");
  });

  it("redacts nested objects and arrays", () => {
    const out = redact({ ctx: { headers: { authorization: TOKEN, "user-agent": "UA/1" } }, list: [{ password: PASSWORD }, "plain"] });
    const json = JSON.stringify(out);
    expect(json).not.toContain(TOKEN);
    expect(json).not.toContain(PASSWORD);
    expect(json).toContain("UA/1");
    expect(json).toContain("plain");
  });

  it("masks e-mail addresses and strips credentials from URLs", () => {
    expect(maskEmail("arjun@example.com")).toBe("a***@example.com");
    expect(redact({ email: "Ops@Company.com" })).toEqual({ email: "O***@Company.com" });
    expect(redact({ reason: "user@x.io" })).toEqual({ reason: "u***@x.io" });
    expect(stripUrlCredentials(DB_URL)).toBe("postgresql://[redacted]@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true");
    expect(stripUrlCredentials("https://user:pw@host/path and https://host/no-creds")).toBe("https://[redacted]@host/path and https://host/no-creds");
    const out = JSON.stringify(redact({ message: `failed to connect to ${DB_URL}` }));
    expect(out).not.toContain("DbPassw0rd!");
    expect(out).toContain("pooler.supabase.com");
  });

  it("truncates hashes so a full hash is never logged, but keeps non-secret fields intact", () => {
    const hash = "a".repeat(64);
    const out = redact({ ipHash: hash, count: 3, ok: true, nothing: null }) as Record<string, unknown>;
    expect(out.ipHash).toBe(`${"a".repeat(12)}…`);
    expect(out.count).toBe(3);
    expect(out.ok).toBe(true);
    expect(out.nothing).toBeNull();
  });

  it("formats a single valid JSON line with timestamp and event name", () => {
    const line = formatSecurityEvent("LOGIN_FAILED", { reason: "BAD_PASSWORD", email: "a@b.co", password: PASSWORD }, new Date("2026-09-16T10:00:00Z"));
    const parsed = JSON.parse(line);
    expect(parsed).toMatchObject({ at: "2026-09-16T10:00:00.000Z", event: "LOGIN_FAILED", reason: "BAD_PASSWORD", email: "a***@b.co", password: REDACTED });
    expect(line).not.toContain(PASSWORD);
  });

  it("securityEvent writes one redacted warn line and never throws", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    securityEvent("RATE_LIMITED", { scope: "login", token: TOKEN, url: DB_URL });
    expect(warn).toHaveBeenCalledTimes(1);
    const line = String(warn.mock.calls[0][0]);
    expect(line.startsWith("[security] {")).toBe(true);
    expect(line).not.toContain(TOKEN);
    expect(line).not.toContain("DbPassw0rd!");
    // A circular structure would make JSON.stringify throw — the logger must swallow it.
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() => securityEvent("RATE_LIMITED", circular as never)).not.toThrow();
  });
});

describe("server error logging", () => {
  it("summarises Prisma-style errors with code and target but strips credentials and never logs secrets", () => {
    const prismaLike = Object.assign(new Error(`Can't reach database server at postgresql://user:${DB_URL.split(":")[2].split("@")[0]}@db.example.com:5432`), {
      name: "PrismaClientInitializationError",
      code: "P1001",
    });
    const s = describeError(prismaLike);
    expect(s.code).toBe("P1001");
    expect(errorHint(s)).toMatch(/unreachable/);

    const missingColumn = Object.assign(new Error("The column `users.sessionVersion` does not exist in the current database."), {
      name: "PrismaClientKnownRequestError",
      code: "P2022",
      meta: { modelName: "User", column: "users.sessionVersion" },
    });
    expect(describeError(missingColumn)).toMatchObject({ code: "P2022", target: "User users.sessionVersion" });
    expect(errorHint(describeError(missingColumn))).toMatch(/db:deploy/);
    expect(errorHint(describeError(new Error("prepared statement \"s0\" already exists")))).toMatch(/pgbouncer=true/);
    expect(errorHint(describeError(new Error("something else")))).toBeNull();

    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    logServerError("register", Object.assign(new Error(`connect to ${DB_URL} failed`), { code: "P1001" }), { password: PASSWORD, token: TOKEN, role: "CUSTOMER" });
    const line = String(error.mock.calls[0][0]);
    expect(line.startsWith("[register] {")).toBe(true);
    expect(line).toContain('"code":"P1001"');
    expect(line).toContain('"role":"CUSTOMER"');
    expect(line).not.toContain(PASSWORD);
    expect(line).not.toContain(TOKEN);
    expect(line).not.toContain("DbPassw0rd!");
    error.mockRestore();
  });

  it("handles non-Error values", () => {
    expect(describeError("boom")).toMatchObject({ name: "UnknownError", message: "boom", code: null });
    expect(describeError(null)).toMatchObject({ name: "UnknownError" });
  });
});
