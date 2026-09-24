/**
 * Structured security logging. Pure (no Next imports) so it works in Server
 * Actions, route handlers, scripts and tests alike.
 *
 * Every event is one JSON line on stderr prefixed `[security]`, and every value
 * passes through `redact()` first: secret-looking keys are dropped, e-mails are
 * masked, and credentials are stripped from anything that looks like a URL.
 * Never pass raw passwords, tokens, cookies or authorization headers — but if
 * one slips through under a recognisable key it is removed, not printed.
 */

const SECRET_KEY = /pass(word|wd)?|secret|token|authorization|cookie|api[-_]?key|private|credential|session|jwt|salt|otp/i;
const HASH_KEY = /hash$/i;
const URL_WITH_CREDENTIALS = /\b([a-z][a-z0-9+.-]*):\/\/([^/\s@:]+)(:[^/\s@]*)?@/gi;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const REDACTED = "[redacted]";

export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return REDACTED;
  return `${email[0]}***@${email.slice(at + 1)}`;
}

export function stripUrlCredentials(value: string): string {
  return value.replace(URL_WITH_CREDENTIALS, (_m, scheme: string) => `${scheme}://${REDACTED}@`);
}

export type Loggable = string | number | boolean | null | undefined | Loggable[] | { [key: string]: Loggable };

/** Returns a copy safe to print. Keys matching secret patterns are removed entirely. */
export function redact(value: Loggable, key = ""): Loggable {
  if (SECRET_KEY.test(key)) return REDACTED;
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, key));
  if (typeof value === "object") {
    const out: { [k: string]: Loggable } = {};
    for (const [k, v] of Object.entries(value)) out[k] = redact(v, k);
    return out;
  }
  if (typeof value === "string") {
    if (HASH_KEY.test(key)) return value.length > 12 ? `${value.slice(0, 12)}…` : value;
    if (EMAIL.test(value.trim())) return maskEmail(value.trim());
    return stripUrlCredentials(value);
  }
  return value;
}

export type SecurityEventName =
  | "RATE_LIMITED"
  | "ORDER_CLAIM_HONEYPOT"
  | "CONTACT_HONEYPOT"
  | "RATE_LIMIT_STORE_ERROR"
  | "LOGIN_FAILED"
  | "SESSION_REVOKED"
  | "SESSION_STALE"
  | "PASSWORD_ROTATION_REQUIRED"
  | "UPLOAD_REJECTED"
  | "ADMIN_BOOTSTRAP_REFUSED"
  | "ENV_VALIDATION_WARNING"
  | "ENV_VALIDATION_FAILED";

export function formatSecurityEvent(name: SecurityEventName, fields: { [key: string]: Loggable } = {}, at = new Date()): string {
  const safe = redact(fields) as { [key: string]: Loggable };
  return JSON.stringify({ at: at.toISOString(), event: name, ...safe });
}

/** Writes one redacted JSON line. Never throws. */
export function securityEvent(name: SecurityEventName, fields: { [key: string]: Loggable } = {}): void {
  try {
    console.warn(`[security] ${formatSecurityEvent(name, fields)}`);
  } catch {
    /* logging must never break a request */
  }
}
