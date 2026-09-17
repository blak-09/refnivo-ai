/**
 * Server configuration guards. Missing critical secrets must fail loudly and
 * early, never fall back to a guessable default. Error messages name the
 * variable but NEVER include its value.
 */

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new ConfigurationError(`${name} is not configured. Set it in the environment (see .env.example).`);
  }
  return value;
}

/** Auth.js signing secret — also salts hashed IPs and customer contacts. */
export function requireAuthSecret(): string {
  return requireEnv("AUTH_SECRET");
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/** True for the embedded/local Postgres used in development and tests. */
export function isLocalDatabaseUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.replace(/^\[|\]$/g, ""); // "[::1]" → "::1"
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Production start-up validation. Pure: takes an env object, returns variable
// NAMES and rule text only — never a value. Called once at boot from
// `instrumentation.ts`; errors abort start-up, warnings are logged.
// ---------------------------------------------------------------------------

export type EnvReport = { errors: string[]; warnings: string[] };

export const AUTH_SECRET_MIN_LENGTH = 32;
const PLACEHOLDER_SECRET = /replace-with|test-secret|localgrowth|changeme|example/i;
const PAYMENT_KEY_VARS = [
  "PHONEPE_MERCHANT_ID",
  "PHONEPE_SALT_KEY",
  "PHONEPE_SALT_INDEX",
  "PAYTM_MID",
  "PAYTM_MERCHANT_KEY",
  "PAYTM_WEBSITE",
  "UPI_MANUAL_VPA",
  "PAYMENT_WEBHOOK_SECRET",
  "PAYOUT_ACCOUNT_ENCRYPTION_KEY",
] as const;
const DEV_ESCAPE_HATCHES = ["SEED_ALLOW_REMOTE", "ADMIN_ALLOW_LOCAL", "STORAGE_ALLOW_LOCAL", "RATE_LIMIT_ALLOW_MEMORY"] as const;

function isHttps(value: string | undefined): boolean {
  try {
    return !!value && new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function set(v: string | undefined): boolean {
  return !!v && v.trim().length > 0;
}

/**
 * Validates the environment for a production deployment. Development and test
 * environments are never blocked: outside NODE_ENV=production the report is
 * always empty.
 */
export function validateProductionEnv(env: NodeJS.ProcessEnv = process.env): EnvReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (env.NODE_ENV !== "production") return { errors, warnings };

  // Auth secret
  const secret = env.AUTH_SECRET ?? "";
  if (!set(secret)) errors.push("AUTH_SECRET is not set.");
  else if (secret.trim().length < AUTH_SECRET_MIN_LENGTH) errors.push(`AUTH_SECRET must be at least ${AUTH_SECRET_MIN_LENGTH} characters.`);
  else if (PLACEHOLDER_SECRET.test(secret)) errors.push("AUTH_SECRET looks like a placeholder value.");

  // Database
  const dbUrl = env.DATABASE_URL;
  if (!set(dbUrl)) errors.push("DATABASE_URL is not set.");
  else {
    let parsed: URL | null = null;
    try {
      parsed = new URL(dbUrl as string);
    } catch {
      errors.push("DATABASE_URL could not be parsed.");
    }
    if (parsed) {
      if (isLocalDatabaseUrl(dbUrl)) errors.push("DATABASE_URL points at a local database; production requires a hosted, pooled database.");
      if (parsed.port === "6543" && parsed.searchParams.get("pgbouncer") !== "true") {
        errors.push("DATABASE_URL uses the transaction pooler port (6543) without pgbouncer=true.");
      }
    }
  }

  // Public origin + Auth.js canonical URL (trustHost is enabled, so this must be pinned).
  if (!set(env.NEXT_PUBLIC_APP_URL)) errors.push("NEXT_PUBLIC_APP_URL is not set.");
  else if (!isHttps(env.NEXT_PUBLIC_APP_URL)) errors.push("NEXT_PUBLIC_APP_URL must be an https:// URL in production.");
  const authUrl = set(env.NEXTAUTH_URL) ? env.NEXTAUTH_URL : env.AUTH_URL;
  if (!set(authUrl)) errors.push("NEXTAUTH_URL (or AUTH_URL) is not set.");
  else if (!isHttps(authUrl)) errors.push("NEXTAUTH_URL / AUTH_URL must be an https:// URL in production.");

  // Rate limiting
  const rl = (env.RATE_LIMIT_PROVIDER ?? "memory").trim().toLowerCase();
  if (rl === "upstash") {
    if (!set(env.UPSTASH_REDIS_REST_URL) || !set(env.UPSTASH_REDIS_REST_TOKEN)) {
      errors.push("RATE_LIMIT_PROVIDER=upstash requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.");
    }
  } else if (rl === "memory") {
    if (env.RATE_LIMIT_ALLOW_MEMORY !== "1") {
      warnings.push("RATE_LIMIT_PROVIDER is memory (per-instance only). Configure upstash for a multi-instance deployment.");
    }
  } else {
    errors.push("RATE_LIMIT_PROVIDER must be one of: memory, upstash.");
  }

  // E-mail
  const email = (env.EMAIL_PROVIDER ?? "console").trim().toLowerCase();
  if (email === "resend") {
    if (!set(env.RESEND_API_KEY) || !set(env.EMAIL_FROM)) errors.push("EMAIL_PROVIDER=resend requires RESEND_API_KEY and EMAIL_FROM.");
  } else if (email === "console") {
    warnings.push("EMAIL_PROVIDER is console: no e-mails are sent (password reset by e-mail is unavailable; notifications stay in-app).");
  } else {
    errors.push("EMAIL_PROVIDER must be one of: console, resend.");
  }

  // Storage
  if ((env.STORAGE_PROVIDER ?? "local").trim().toLowerCase() === "local" && env.STORAGE_ALLOW_LOCAL !== "1") {
    warnings.push("STORAGE_PROVIDER is local; uploaded files do not survive redeploys on serverless hosts.");
  }

  // Payments are disabled in this release — refuse to start if anything tries to enable them.
  if ((env.PAYMENTS_ENABLED ?? "").trim().toLowerCase() === "true") errors.push("PAYMENTS_ENABLED=true is not supported in this release.");
  const provider = ((env.PAYMENT_PROVIDER ?? "").trim() || "NONE").toUpperCase(); // blank == NONE
  if (provider !== "NONE") errors.push("PAYMENT_PROVIDER must be NONE in this release.");
  const keysPresent = PAYMENT_KEY_VARS.filter((name) => set(env[name]));
  if (keysPresent.length) warnings.push(`Payment credentials are set but payments are disabled: ${keysPresent.join(", ")}.`);

  // Development escape hatches must not leak into production.
  for (const name of DEV_ESCAPE_HATCHES) {
    if (set(env[name]) && name !== "STORAGE_ALLOW_LOCAL" && name !== "RATE_LIMIT_ALLOW_MEMORY") warnings.push(`${name} is set in production.`);
  }

  return { errors, warnings };
}
