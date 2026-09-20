/**
 * HTTP security headers applied to every response (see next.config.ts).
 *
 * CSP notes (verified against the app):
 *  - No third-party scripts or analytics are loaded; Next.js itself needs
 *    inline scripts/styles, hence 'unsafe-inline' (no nonce pipeline yet).
 *  - Fonts are self-hosted by next/font (Geist) -> font-src 'self' data:.
 *  - Product/brand/creator images are user-supplied URLs on arbitrary hosts and
 *    QR codes are data: URLs -> img-src allows https: and data:.
 *  - Auth.js and server actions are same-origin -> connect-src 'self'.
 *  - In development, HMR needs eval + websockets, so CSP is relaxed there.
 */
export type Header = { key: string; value: string };

export function contentSecurityPolicy(production: boolean): string {
  const directives = [
    "default-src 'self'",
    production ? "script-src 'self' 'unsafe-inline'" : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    production ? "connect-src 'self'" : "connect-src 'self' ws: wss:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ];
  if (production) directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}

/** Dashboards, auth pages and APIs must never be indexed (they render shells / redirects for anonymous crawlers). */
export const NOINDEX_HEADER = { key: "X-Robots-Tag", value: "noindex, nofollow" };

export function securityHeaders(production = process.env.NODE_ENV === "production"): Header[] {
  const headers: Header[] = [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
    { key: "X-DNS-Prefetch-Control", value: "on" },
    { key: "Content-Security-Policy", value: contentSecurityPolicy(production) },
  ];
  if (production) {
    // 2 years, include subdomains, preload-eligible. Only meaningful over HTTPS.
    headers.unshift({ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" });
  }
  return headers;
}
