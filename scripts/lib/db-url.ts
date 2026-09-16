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
    const host = u.hostname;
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
