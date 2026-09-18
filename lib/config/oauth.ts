/**
 * Google sign-in configuration. Pure (no I/O) so it is unit-tested and safe to
 * import from the edge-compatible auth config. Values are never returned to
 * callers other than the Auth.js provider factory; error messages name the
 * variables only.
 *
 *   GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET   (AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET accepted as aliases)
 *
 * When neither is set, Google sign-in is simply not offered — the button is
 * hidden and the provider is not registered.
 */

export type GoogleOAuthConfig = { clientId: string; clientSecret: string };

function pick(env: NodeJS.ProcessEnv, ...names: string[]): string | undefined {
  for (const name of names) {
    const value = env[name]?.trim();
    if (value) return value;
  }
  return undefined;
}

export function googleOAuthConfig(env: NodeJS.ProcessEnv = process.env): GoogleOAuthConfig | null {
  const clientId = pick(env, "GOOGLE_CLIENT_ID", "AUTH_GOOGLE_ID");
  const clientSecret = pick(env, "GOOGLE_CLIENT_SECRET", "AUTH_GOOGLE_SECRET");
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function googleOAuthEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return googleOAuthConfig(env) !== null;
}

/**
 * Start-up rule: both halves or neither. A half-configured provider is a boot
 * error; leaving both unset is a normal, silent "feature off".
 */
export function validateGoogleOAuthEnv(env: NodeJS.ProcessEnv = process.env): string | null {
  const clientId = pick(env, "GOOGLE_CLIENT_ID", "AUTH_GOOGLE_ID");
  const clientSecret = pick(env, "GOOGLE_CLIENT_SECRET", "AUTH_GOOGLE_SECRET");
  if (!!clientId !== !!clientSecret) {
    return "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set together (or both left unset to disable Google sign-in).";
  }
  return null;
}
