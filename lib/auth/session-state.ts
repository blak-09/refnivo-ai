import type { UserStatus } from "@prisma/client";
import { isSessionCurrent } from "./session-version";

/**
 * Why a request that carries a session cookie must NOT be treated as signed
 * in. Pure (no I/O) so it is unit-tested; `getSessionState()` in guards.ts
 * applies it to the JWT + the fresh database row.
 *
 *   no-session  — no cookie / no id in the token
 *   not-found   — the account no longer exists
 *   stale       — sessionVersion mismatch (password changed, sessions revoked)
 *   suspended / pending / rejected — account status
 *
 * A stale or blocked session is sent to /auth/signed-out, which CLEARS the
 * cookie before redirecting to the login page — otherwise proxy.ts (which
 * only sees the JWT) would bounce the user straight back to the dashboard
 * and the two redirects would loop forever.
 */
export type SessionProblem = "no-session" | "not-found" | "stale" | "suspended" | "pending" | "rejected";

export function classifySession(
  token: { id?: string | null; sessionVersion?: unknown } | null | undefined,
  dbUser: { status: UserStatus; sessionVersion: number; deletedAt?: Date | null } | null,
): SessionProblem | null {
  if (!token?.id) return "no-session";
  if (!dbUser || dbUser.deletedAt) return "not-found";
  if (!isSessionCurrent(token.sessionVersion, dbUser.sessionVersion)) return "stale";
  if (dbUser.status === "SUSPENDED") return "suspended";
  if (dbUser.status === "PENDING") return "pending";
  if (dbUser.status === "REJECTED") return "rejected";
  return null;
}

/** Login-page error code shown after the cookie has been cleared. */
export function signedOutErrorCode(problem: Exclude<SessionProblem, "no-session">): string {
  switch (problem) {
    case "suspended":
      return "account-suspended";
    case "pending":
      return "account-pending";
    case "rejected":
      return "account-rejected";
    case "not-found":
      return "account-missing";
    case "stale":
      return "session-expired";
  }
}

/** Where a request with an unusable session cookie is sent. */
export function signedOutPath(problem: Exclude<SessionProblem, "no-session">): string {
  return `/auth/signed-out?reason=${signedOutErrorCode(problem)}`;
}

export const SIGNED_OUT_REASONS = ["account-suspended", "account-pending", "account-rejected", "account-missing", "session-expired"] as const;
export type SignedOutReason = (typeof SIGNED_OUT_REASONS)[number];

export function isSignedOutReason(value: unknown): value is SignedOutReason {
  return typeof value === "string" && (SIGNED_OUT_REASONS as readonly string[]).includes(value);
}
