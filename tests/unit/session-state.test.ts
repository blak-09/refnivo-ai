import { describe, expect, it } from "vitest";
import { classifySession, isSignedOutReason, signedOutErrorCode, signedOutPath } from "@/lib/auth/session-state";

const approved = { status: "APPROVED" as const, sessionVersion: 1 };

describe("classifySession (AUTH-01: stale cookies must be cleared, never bounced)", () => {
  it("no cookie / no id → no-session", () => {
    expect(classifySession(null, approved)).toBe("no-session");
    expect(classifySession({ id: null }, approved)).toBe("no-session");
  });

  it("a valid token for an approved, current account is fine", () => {
    expect(classifySession({ id: "u1", sessionVersion: 1 }, approved)).toBeNull();
    // Tokens issued before versioning carry no `sv` and count as version 1.
    expect(classifySession({ id: "u1" }, approved)).toBeNull();
  });

  it("deleted account → not-found", () => {
    expect(classifySession({ id: "u1", sessionVersion: 1 }, null)).toBe("not-found");
  });

  it("version mismatch wins over status (a revoked session is stale whatever the status)", () => {
    expect(classifySession({ id: "u1", sessionVersion: 1 }, { status: "APPROVED", sessionVersion: 2 })).toBe("stale");
    expect(classifySession({ id: "u1", sessionVersion: 1 }, { status: "SUSPENDED", sessionVersion: 2 })).toBe("stale");
  });

  it("blocked statuses", () => {
    expect(classifySession({ id: "u1", sessionVersion: 1 }, { status: "SUSPENDED", sessionVersion: 1 })).toBe("suspended");
    expect(classifySession({ id: "u1", sessionVersion: 1 }, { status: "PENDING", sessionVersion: 1 })).toBe("pending");
    expect(classifySession({ id: "u1", sessionVersion: 1 }, { status: "REJECTED", sessionVersion: 1 })).toBe("rejected");
  });

  it("maps every problem to a login-page code served through /auth/signed-out", () => {
    for (const p of ["not-found", "stale", "suspended", "pending", "rejected"] as const) {
      const code = signedOutErrorCode(p);
      expect(isSignedOutReason(code)).toBe(true);
      expect(signedOutPath(p)).toBe(`/auth/signed-out?reason=${code}`);
    }
    expect(isSignedOutReason("javascript:alert(1)")).toBe(false);
  });
});
