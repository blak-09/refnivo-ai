/**
 * Normalises DATABASE_URL before Prisma sees it. Pure (no Next imports).
 *
 * Supabase's transaction pooler (port 6543, PgBouncer in transaction mode)
 * does not support prepared statements; Prisma needs `pgbouncer=true` on the
 * URL to cope. Operators copy the URI from the Supabase dashboard, which does
 * NOT include that flag — so instead of refusing to start, the app appends it.
 * Any other URL is returned unchanged. Never logs or returns credentials to
 * callers other than the Prisma client.
 */
export function normalizeDatabaseUrl(url: string | undefined): string | undefined {
  if (!url || !url.trim()) return url;
  const trimmed = url.trim().replace(/^["']|["']$/g, ""); // stray quotes from copy/paste
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return trimmed;
  }
  if (parsed.port === "6543" && !parsed.searchParams.has("pgbouncer")) {
    parsed.searchParams.set("pgbouncer", "true");
    return parsed.toString();
  }
  return trimmed;
}

/** True when normalisation would change the value (used for a start-up notice). */
export function databaseUrlNeedsPgbouncerFlag(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const p = new URL(url.trim().replace(/^["']|["']$/g, ""));
    return p.port === "6543" && !p.searchParams.has("pgbouncer");
  } catch {
    return false;
  }
}
