import { NextResponse, type NextRequest } from "next/server";
import { signOut } from "@/lib/auth";
import { isSignedOutReason } from "@/lib/auth/session-state";
import { sessionCookieOptions } from "@/lib/auth/session-version";
import { logServerError } from "@/lib/utils/server-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /auth/signed-out?reason=…
 *
 * Clears a session cookie that no longer maps to a usable account (suspended,
 * pending, rejected, deleted, or invalidated by a password change / admin
 * revocation) and lands on the login page with a matching message. Route
 * Handlers may modify cookies; Server Components may not — which is why the
 * page guards redirect here instead of signing out inline.
 */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("reason");
  const reason = isSignedOutReason(raw) ? raw : "session-expired";
  const login = new URL(`/auth/login?error=${reason}`, req.nextUrl.origin);
  try {
    await signOut({ redirect: false });
  } catch (err) {
    logServerError("auth.signed-out", err);
  }
  const res = NextResponse.redirect(login, { status: 303 });
  // Belt and braces: expire the session cookie (and chunked variants) ourselves too.
  const { name, options } = sessionCookieOptions(process.env.NEXTAUTH_URL || process.env.AUTH_URL);
  for (const cookieName of [name, `${name}.0`, `${name}.1`, `${name}.2`]) {
    res.cookies.set(cookieName, "", { ...options, maxAge: 0, expires: new Date(0) });
  }
  res.headers.set("Cache-Control", "no-store");
  return res;
}
