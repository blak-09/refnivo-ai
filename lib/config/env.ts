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
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}
