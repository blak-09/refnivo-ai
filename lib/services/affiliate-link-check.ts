/**
 * Checks that an external programme's official URL is still up.
 *
 * Used before a listing may be (or stay) marked verified: a programme whose
 * official page is gone must not keep showing "Active · Verified". Outcomes:
 *  - ok:         2xx/3xx.
 *  - restricted: 401/403/405/406/429/432 — the site answered but refuses
 *                automated requests. Many official pages do this; the server
 *                exists, so it counts as reachable.
 *  - broken:     404/410 or 5xx — the page is gone or failing.
 *  - unreachable: DNS failure, refused connection or timeout.
 *
 * Only public http(s) hosts are fetched (no localhost or private ranges), so an
 * admin-supplied URL cannot be used to probe internal services.
 */
export type LinkCheckResult = { reachable: boolean; status: string; checkedAt: Date };
export type LinkChecker = (url: string) => Promise<LinkCheckResult>;

const RESTRICTED = new Set([401, 403, 405, 406, 429, 432, 451]);
const PRIVATE_HOST = /^(localhost|0\.0\.0\.0|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$|\[?f[cd][0-9a-f]{2}:)/i;

export function isPublicHttpUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    const host = url.hostname.toLowerCase();
    return host.includes(".") && !PRIVATE_HOST.test(host) && !host.endsWith(".local") && !host.endsWith(".internal");
  } catch {
    return false;
  }
}

/** Maps an HTTP status to the stored outcome. Pure; unit-tested. */
export function classifyStatus(code: number): { reachable: boolean; status: string } {
  if (code >= 200 && code < 400) return { reachable: true, status: `ok ${code}` };
  if (RESTRICTED.has(code)) return { reachable: true, status: `restricted ${code}` };
  return { reachable: false, status: `broken ${code}` };
}

export const checkProgramUrl: LinkChecker = async (url) => {
  const checkedAt = new Date();
  if (!isPublicHttpUrl(url)) return { reachable: false, status: "invalid url", checkedAt };
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(12_000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; RefnivoLinkCheck/1.0; +https://www.refnivo.com)", Accept: "text/html,*/*" },
    });
    // The body is not needed; release the connection.
    res.body?.cancel().catch(() => {});
    return { ...classifyStatus(res.status), checkedAt };
  } catch {
    return { reachable: false, status: "unreachable", checkedAt };
  }
};
