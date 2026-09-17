/**
 * Session versioning helpers. Pure (no Next/DB imports) so they are unit-tested
 * and safe to use from the edge-compatible auth config.
 *
 * The JWT carries `sv` (session version) and `mcp` (must change password).
 * `users.sessionVersion` is bumped on password change/revocation; a token whose
 * `sv` no longer matches is rejected by `getCurrentUser()`. Tokens issued before
 * this claim existed have no `sv` — they are treated as LEGACY_SESSION_VERSION
 * (1), which is what every existing user was migrated with, so the deploy that
 * introduces versioning logs nobody out.
 */
export const LEGACY_SESSION_VERSION = 1;

export function tokenSessionVersion(sv: unknown): number {
  return typeof sv === "number" && Number.isInteger(sv) && sv > 0 ? sv : LEGACY_SESSION_VERSION;
}

export function isSessionCurrent(tokenSv: unknown, dbSessionVersion: number): boolean {
  return tokenSessionVersion(tokenSv) === dbSessionVersion;
}

/**
 * Whether a dashboard request must be redirected to the settings page to rotate
 * the password. The settings page itself (and everything outside /dashboard) is
 * always allowed so the rotation can actually happen.
 */
export function rotationRedirect(input: { mustChangePassword: boolean; pathname: string; roleHome: string }): string | null {
  if (!input.mustChangePassword) return null;
  if (!input.pathname.startsWith("/dashboard")) return null;
  const settings = `${input.roleHome}/settings`;
  if (input.pathname === settings || input.pathname.startsWith(`${settings}/`)) return null;
  return `${settings}?rotate=1`;
}

/**
 * Auth.js session-cookie options, made explicit: httpOnly + SameSite=Lax always;
 * Secure + `__Secure-` prefix whenever the canonical URL is https.
 */
export function sessionCookieOptions(authUrl: string | undefined) {
  let secure = false;
  try {
    secure = !!authUrl && new URL(authUrl).protocol === "https:";
  } catch {
    secure = false;
  }
  return {
    name: `${secure ? "__Secure-" : ""}authjs.session-token`,
    options: { httpOnly: true, sameSite: "lax" as const, path: "/", secure },
  };
}
