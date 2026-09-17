/**
 * Safe description of a DATABASE_URL: host, port, database and flags only.
 * The username and password are never returned or printed.
 */
export type DatabaseTarget = {
  ok: boolean;
  scheme: string;
  host: string;
  port: string;
  database: string;
  pgbouncer: boolean;
  sslmode: string | null;
  local: boolean;
};

export function describeDatabaseUrl(url: string | undefined): DatabaseTarget | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    // WHATWG URL keeps IPv6 brackets in `hostname` ("[::1]"); strip them for comparisons.
    const host = u.hostname.replace(/^\[|\]$/g, "");
    return {
      ok: true,
      scheme: u.protocol.replace(":", ""),
      host,
      port: u.port || "5432",
      database: u.pathname.replace(/^\//, "") || "(default)",
      pgbouncer: u.searchParams.get("pgbouncer") === "true",
      sslmode: u.searchParams.get("sslmode"),
      local: host === "localhost" || host === "127.0.0.1" || host === "::1",
    };
  } catch {
    return { ok: false, scheme: "?", host: "(unparseable)", port: "?", database: "?", pgbouncer: false, sslmode: null, local: false };
  }
}

export function formatTarget(t: DatabaseTarget | null): string {
  if (!t) return "(not set)";
  if (!t.ok) return "(unparseable DATABASE_URL)";
  const flags = [t.pgbouncer ? "pgbouncer" : null, t.sslmode ? `sslmode=${t.sslmode}` : null].filter(Boolean).join(", ");
  return `${t.scheme}://${t.host}:${t.port}/${t.database}${flags ? ` [${flags}]` : ""}${t.local ? "  (LOCAL)" : "  (REMOTE)"}`;
}

// ---------------------------------------------------------------------------
// Local-only guard shared by every script that can rewrite a database
// (db:push:local, db:reset:local, db:migrate, seed). Pure: no I/O, no env
// reads except what is passed in, so it is unit-tested without a database.
// ---------------------------------------------------------------------------

export const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export type LocalGuardVerdict = { ok: true; target: DatabaseTarget } | { ok: false; reason: string; target: DatabaseTarget | null };

/**
 * Decides whether a destructive/local-only command may run. Refuses when the
 * URL is missing or unparseable, when the host is not local, or when NODE_ENV
 * is production — regardless of any override flag (there is none on purpose).
 * The reason names the host and port only; never the user or password.
 */
export function assertLocalTarget(url: string | undefined, nodeEnv: string | undefined): LocalGuardVerdict {
  const target = describeDatabaseUrl(url);
  if (!target) return { ok: false, reason: "DATABASE_URL is not set.", target: null };
  if (!target.ok) return { ok: false, reason: "DATABASE_URL could not be parsed.", target };
  if (nodeEnv === "production") {
    return { ok: false, reason: 'NODE_ENV is "production" — local-only database commands are disabled.', target };
  }
  if (!target.local || !LOCAL_HOSTS.has(target.host)) {
    return { ok: false, reason: `target ${target.host}:${target.port} is REMOTE — this command only runs against localhost.`, target };
  }
  return { ok: true, target };
}
