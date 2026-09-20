/**
 * Canonical host. Once a custom domain is live, the platform's *.vercel.app
 * production alias must not serve the app as a second origin: sessions are
 * per host, so a user who logs in on the old host is bounced to the canonical
 * one without a cookie. Production deployments only — preview deployments
 * keep their own *.vercel.app URLs.
 */
export function canonicalRedirect(req: { host: string | null; protocol: string; pathname: string; search: string }, env: NodeJS.ProcessEnv = process.env): string | null {
  if (env.VERCEL_ENV !== "production") return null;
  const canonical = env.NEXT_PUBLIC_APP_URL?.trim();
  if (!canonical || !req.host) return null;
  let target: URL;
  try {
    target = new URL(canonical);
  } catch {
    return null;
  }
  if (req.host.toLowerCase() === target.host.toLowerCase()) return null;
  if (!req.host.endsWith(".vercel.app")) return null; // only the platform alias is redirected, never other domains you may map
  return `${target.origin}${req.pathname}${req.search}`;
}
