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
/**
 * Percent-encodes the password segment of `scheme://user:password@host…` when
 * it contains characters that are illegal in a URL (`#`, `/`, `?`, `@`, `[`,
 * `]`, `^`, `|`, `<`, `>`, `"`, `\`, `{`, `}`, space …). Database dashboards
 * generate such passwords; pasted raw they make the URL unparseable. Only the
 * password is touched, and only when the URL does not already parse.
 */
export function encodeDatabasePassword(url: string): string {
  const m = /^([a-z][a-z0-9+.-]*:\/\/)([^:\/@]+):(.*)@([^@]*)$/i.exec(url);
  if (!m) return url;
  const [, scheme, user, password, rest] = m;
  const alreadyValid = /^[A-Za-z0-9\-._~!$&'()*+,;=%]*$/.test(password) && !/%(?![0-9A-Fa-f]{2})/.test(password);
  if (alreadyValid) return url;
  return `${scheme}${user}:${encodeURIComponent(password)}@${rest}`;
}

export function normalizeDatabaseUrl(url: string | undefined): string | undefined {
  if (!url || !url.trim()) return url;
  let trimmed = url.trim().replace(/^["']|["']$/g, ""); // stray quotes from copy/paste
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    trimmed = encodeDatabasePassword(trimmed);
    try {
      parsed = new URL(trimmed);
    } catch {
      return trimmed;
    }
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
