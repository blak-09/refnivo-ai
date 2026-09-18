import "server-only";
import { cookies } from "next/headers";
import { isRegistrableRole } from "@/lib/services/oauth";
import type { RegistrableRole } from "@/lib/validation/auth";

/**
 * Carries the account type chosen on the register page across the Google
 * round-trip. Short-lived, httpOnly, and cleared as soon as it is consumed, so
 * a stale choice from an abandoned attempt can never create the wrong kind of
 * account later.
 */
const NAME = "refnivo.oauth-role";
const MAX_AGE_SECONDS = 10 * 60;

function cookieOptions(maxAge: number) {
  const url = process.env.NEXTAUTH_URL || process.env.AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "";
  return { httpOnly: true, sameSite: "lax" as const, secure: url.startsWith("https://"), path: "/", maxAge };
}

export async function setOAuthRoleCookie(role: RegistrableRole | null): Promise<void> {
  const jar = await cookies();
  jar.set(NAME, role ?? "", cookieOptions(role ? MAX_AGE_SECONDS : 0));
}

/** Reads and clears the chosen role. Returns null when absent or invalid. */
export async function consumeOAuthRoleCookie(): Promise<RegistrableRole | null> {
  try {
    const jar = await cookies();
    const value = jar.get(NAME)?.value ?? null;
    try {
      jar.set(NAME, "", cookieOptions(0));
    } catch {
      // Read-only context — the cookie expires on its own within minutes.
    }
    return isRegistrableRole(value) ? value : null;
  } catch {
    return null;
  }
}
