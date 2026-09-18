import "server-only";
import { prisma } from "./prisma";
import { describeError, errorHint, logServerError } from "@/lib/utils/server-log";

/**
 * Coarse, operator-facing reason for a failed probe. Derived from the error
 * class/code only — never from the message, host or credentials.
 */
export type DatabaseFailureReason = "timeout" | "auth-failed" | "unreachable" | "database-not-found" | "pooler-misconfigured" | "invalid-url" | "tls" | "capacity" | "unknown";

export type DatabaseHealth =
  | { ok: true; latencyMs: number }
  | { ok: false; latencyMs: number; reason: DatabaseFailureReason; code: string | null; hint: string | null };

export function classifyDatabaseError(err: unknown): { reason: DatabaseFailureReason; code: string | null; hint: string | null } {
  const summary = describeError(err);
  const hint = errorHint(summary);
  if (summary.message === "timeout") return { reason: "timeout", code: null, hint: "no reply from the database within the time limit — wrong host/port, paused project, or an IPv6-only direct host from an IPv4 runtime; use the pooler URL" };
  switch (summary.code) {
    case "P1000":
      return { reason: "auth-failed", code: summary.code, hint };
    case "P1001":
    case "P1002":
    case "P1017":
    case "ECONNREFUSED":
    case "ENOTFOUND":
    case "ETIMEDOUT":
      return { reason: "unreachable", code: summary.code, hint };
    case "P1003":
      return { reason: "database-not-found", code: summary.code, hint: "the database name in DATABASE_URL does not exist" };
    case "42P05":
      return { reason: "pooler-misconfigured", code: summary.code, hint };
    default: {
      const m = summary.message;
      const code = summary.code ?? summary.name ?? null;
      if (/prepared statement/i.test(m)) return { reason: "pooler-misconfigured", code, hint };
      if (/Tenant or user not found/i.test(m)) return { reason: "auth-failed", code, hint: "the pooler rejected the user — on the Supabase pooler the username must be postgres.<project-ref>" };
      if (/password authentication failed|authentication failed/i.test(m)) return { reason: "auth-failed", code, hint: "wrong database password in DATABASE_URL" };
      if (/must start with the protocol|invalid port|Error parsing connection string|Error validating datasource|invalid connection string|the URL/i.test(m)) {
        return { reason: "invalid-url", code, hint: "DATABASE_URL is not a valid postgresql:// connection string — check for stray quotes, spaces, brackets or an unencoded password" };
      }
      if (/does not exist/i.test(m) && /database/i.test(m)) return { reason: "database-not-found", code, hint: "the database name in DATABASE_URL does not exist" };
      if (/SSL|TLS|certificate/i.test(m)) return { reason: "tls", code, hint: "TLS negotiation failed — add ?sslmode=require (Neon) or use the Supabase pooler URL" };
      if (/too many connections|MaxClients|remaining connection slots/i.test(m)) return { reason: "capacity", code, hint: "the database is out of connections — use the transaction pooler URL (port 6543, pgbouncer=true)" };
      if (/ECONNRESET|server closed the connection|Connection terminated|Closed|connection refused|getaddrinfo|ENOTFOUND|ETIMEDOUT|timed out|Can't reach/i.test(m)) {
        return { reason: "unreachable", code, hint: "the host did not answer — check the host/port, that the project is not paused, and use the pooler URL (direct Supabase hosts are IPv6-only)" };
      }
      if (/starting up|shutting down|recovery/i.test(m)) return { reason: "unreachable", code, hint: "the database is restarting — retry shortly" };
      return { reason: "unknown", code, hint };
    }
  }
}

/**
 * The newest migration the running code REQUIRES. Bump it whenever a migration
 * adds something the app reads. Lets /api/health say "schema behind" when a
 * deploy went out before `npm run db:deploy` — without exposing anything but
 * the migration's name.
 */
export const REQUIRED_MIGRATION = "20260918120000_google_oauth";

export type SchemaHealth = { ok: true; latest: string } | { ok: false; missing: string; hint: string } | { ok: false; missing: null; hint: string };

/** Is `REQUIRED_MIGRATION` recorded as applied in `_prisma_migrations`? Never throws. */
export async function checkSchema(): Promise<SchemaHealth> {
  try {
    const rows = await prisma.$queryRaw<{ n: bigint | number }[]>`
      SELECT COUNT(*)::int AS n FROM "_prisma_migrations"
      WHERE "migration_name" = ${REQUIRED_MIGRATION} AND "finished_at" IS NOT NULL AND "rolled_back_at" IS NULL`;
    const n = Number(rows[0]?.n ?? 0);
    if (n > 0) return { ok: true, latest: REQUIRED_MIGRATION };
    return { ok: false, missing: REQUIRED_MIGRATION, hint: "run `npm run db:deploy` against this database (docs/PRODUCTION.md §4)" };
  } catch (err) {
    logServerError("health.schema", err);
    return { ok: false, missing: null, hint: "could not read _prisma_migrations — the migration history baseline (docs/PRODUCTION.md §3) may be missing" };
  }
}

/**
 * Cheap liveness probe. Never throws and never returns connection details —
 * a failure carries only a coarse reason + error code (the redacted detail
 * goes to the server log).
 */
export async function checkDatabase(timeoutMs = 3000): Promise<DatabaseHealth> {
  const started = Date.now();
  const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), timeoutMs).unref?.());
  try {
    await Promise.race([prisma.$queryRaw`SELECT 1`, timeout]);
    return { ok: true, latencyMs: Date.now() - started };
  } catch (err) {
    logServerError("health", err);
    const c = classifyDatabaseError(err);
    return { ok: false, latencyMs: Date.now() - started, ...c };
  }
}
