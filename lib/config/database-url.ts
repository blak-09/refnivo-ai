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
  // Tolerate copy/paste artefacts: a `DATABASE_URL=` prefix (dotenv / Vercel export format),
  // surrounding quotes, and a trailing semicolon.
  let trimmed = url.trim().replace(/^(?:export\s+)?DATABASE_URL\s*=\s*/i, "").replace(/;$/, "").trim().replace(/^["']|["']$/g, "");
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

/**
 * Credential-free description of the configured database target, for health
 * output. The username is masked to its last 4 characters (enough to tell two
 * Supabase projects apart); the password is never read.
 */
export function describeDatabaseTarget(url: string | undefined): { host: string; port: string; database: string; user: string } | null {
  const normalized = normalizeDatabaseUrl(url);
  if (!normalized) return null;
  try {
    const u = new URL(normalized);
    const user = decodeURIComponent(u.username);
    const masked = user.length > 4 ? `${"*".repeat(Math.min(8, user.length - 4))}${user.slice(-4)}` : "****";
    return { host: u.hostname, port: u.port || "5432", database: u.pathname.replace(/^\//, "") || "(default)", user: masked };
  } catch {
    return null;
  }
}
