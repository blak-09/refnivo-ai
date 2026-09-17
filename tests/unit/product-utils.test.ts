import { describe, expect, it, vi } from "vitest";
import { csvCell, toCsv } from "@/lib/utils/csv";
import { ConsoleEmailDriver, emailProviderName, isEmailConfigured, ResendEmailDriver, type FetchLike } from "@/lib/email";
import { canReviewPayout, payoutMinimumMinor } from "@/lib/services/payouts";

const env = (v: Record<string, string | undefined>) => v as unknown as NodeJS.ProcessEnv;

describe("csv export", () => {
  it("quotes delimiters/quotes/newlines and neutralises spreadsheet formulas", () => {
    expect(csvCell("plain")).toBe("plain");
    expect(csvCell('say "hi", now')).toBe('"say ""hi"", now"');
    expect(csvCell("line\nbreak")).toBe('"line\nbreak"');
    expect(csvCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(csvCell("+1")).toBe("'+1");
    expect(csvCell("-5")).toBe("'-5");
    expect(csvCell("@cmd")).toBe("'@cmd");
    expect(csvCell(null)).toBe("");
    expect(csvCell(42)).toBe("42");
  });

  it("writes a header from the union of keys and CRLF rows", () => {
    const out = toCsv([
      { a: 1, b: "x" },
      { a: 2, c: true },
    ]);
    expect(out.split("\r\n")).toEqual(["a,b,c", "1,x,", "2,,true"]);
    expect(toCsv([])).toBe("");
  });
});

describe("email abstraction", () => {
  it("defaults to console and reports 'configured' only when resend has a key and sender", () => {
    expect(emailProviderName(env({}))).toBe("console");
    expect(isEmailConfigured(env({ EMAIL_PROVIDER: "resend" }))).toBe(false);
    expect(isEmailConfigured(env({ EMAIL_PROVIDER: "resend", RESEND_API_KEY: "k", EMAIL_FROM: "" }))).toBe(false);
    expect(isEmailConfigured(env({ EMAIL_PROVIDER: "resend", RESEND_API_KEY: "k", EMAIL_FROM: "Refnivo <no-reply@x.io>" }))).toBe(true);
    expect(isEmailConfigured(env({ EMAIL_PROVIDER: "console", RESEND_API_KEY: "k", EMAIL_FROM: "a@b" }))).toBe(false);
  });

  it("console driver never sends and masks the recipient in its log line", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const r = await new ConsoleEmailDriver().send({ to: "priya@example.com", subject: "Hi", text: "secret body" });
    expect(r).toEqual({ ok: true, provider: "console" });
    const line = String(info.mock.calls[0][0]);
    expect(line).toContain("p***@example.com");
    expect(line).not.toContain("priya@");
    expect(line).not.toContain("secret body");
    info.mockRestore();
  });

  it("resend driver posts to the API with a bearer key and surfaces HTTP failures without throwing", async () => {
    const calls: Array<{ url: string; init: Parameters<FetchLike>[1] }> = [];
    const okFetch: FetchLike = async (url, init) => {
      calls.push({ url, init });
      return { ok: true, status: 200, json: async () => ({ id: "em_1" }) };
    };
    const driver = new ResendEmailDriver("re_key", "Refnivo <no-reply@x.io>", okFetch);
    const r = await driver.send({ to: "a@b.co", subject: "S", text: "T" });
    expect(r).toEqual({ ok: true, provider: "resend", id: "em_1" });
    expect(calls[0].url).toBe("https://api.resend.com/emails");
    expect(calls[0].init.headers.Authorization).toBe("Bearer re_key");
    expect(JSON.parse(calls[0].init.body)).toMatchObject({ from: "Refnivo <no-reply@x.io>", to: ["a@b.co"], subject: "S", text: "T" });

    const failFetch: FetchLike = async () => ({ ok: false, status: 401, json: async () => ({}) });
    const bad = await new ResendEmailDriver("re_key", "x@y", failFetch).send({ to: "a@b.co", subject: "S", text: "T" });
    expect(bad).toEqual({ ok: false, provider: "resend", reason: "HTTP 401" });
  });
});

describe("payout review rules", () => {
  it("only allows the documented transitions and PAID/REJECTED are terminal", () => {
    expect(canReviewPayout("REQUESTED", "UNDER_REVIEW")).toBe(true);
    expect(canReviewPayout("REQUESTED", "APPROVE")).toBe(true);
    expect(canReviewPayout("REQUESTED", "MARK_PAID")).toBe(false); // must be approved first
    expect(canReviewPayout("APPROVED", "MARK_PAID")).toBe(true);
    expect(canReviewPayout("APPROVED", "FAIL")).toBe(true);
    expect(canReviewPayout("FAILED", "APPROVE")).toBe(true);
    expect(canReviewPayout("PAID", "REJECT")).toBe(false);
    expect(canReviewPayout("PAID", "APPROVE")).toBe(false);
    expect(canReviewPayout("REJECTED", "APPROVE")).toBe(false);
  });

  it("reads the payout minimum from the environment with a safe default", () => {
    expect(payoutMinimumMinor(env({}))).toBe(50_000);
    expect(payoutMinimumMinor(env({ PAYOUT_MINIMUM_AMOUNT: "100000" }))).toBe(100_000);
    expect(payoutMinimumMinor(env({ PAYOUT_MINIMUM_AMOUNT: "abc" }))).toBe(50_000);
    expect(payoutMinimumMinor(env({ PAYOUT_MINIMUM_AMOUNT: "-5" }))).toBe(50_000);
  });
});

describe("referral links and QR codes", () => {
  it("builds the public /r/CODE URL from NEXT_PUBLIC_APP_URL and renders a PNG QR that encodes it", async () => {
    const { referralQrDataUrl, referralUrl } = await import("@/lib/services/links");
    expect(referralUrl("ARJUN-BOAT-4K7Q")).toBe("http://localhost:3000/r/ARJUN-BOAT-4K7Q");
    expect(referralUrl("ARJUN-BOAT-4K7Q", { qr: true })).toBe("http://localhost:3000/r/ARJUN-BOAT-4K7Q?src=qr");
    const qr = await referralQrDataUrl("ARJUN-BOAT-4K7Q");
    expect(qr.startsWith("data:image/png;base64,")).toBe(true);
    expect(qr.length).toBeGreaterThan(1000);
    // Two codes never share a QR image.
    expect(await referralQrDataUrl("SANA-GLOW-9XYZ")).not.toBe(qr);
  });
});
