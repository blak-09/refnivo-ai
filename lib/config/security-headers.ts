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
 *  - Razorpay's hosted checkout (script + iframe + its API) is allowed ONLY when
 *    payments are configured, so the default policy stays tight.
 *  - The product-launch video on the home page is a YouTube embed
 *    (components/marketing/launch-video.tsx) -> frame-src allows YouTube only.
 *  - In development, HMR needs eval + websockets, so CSP is relaxed there.
 */
export type Header = { key: string; value: string };

/** Origins the Razorpay hosted checkout needs. Added only when payments are on. */
const RAZORPAY_SCRIPT = "https://checkout.razorpay.com";
const RAZORPAY_FRAMES = "https://api.razorpay.com https://checkout.razorpay.com";

export function contentSecurityPolicy(production: boolean, payments = false): string {
  const directives = [
    "default-src 'self'",
    `${production ? "script-src 'self' 'unsafe-inline'" : "script-src 'self' 'unsafe-inline' 'unsafe-eval'"}${payments ? ` ${RAZORPAY_SCRIPT}` : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `frame-src https://www.youtube.com https://www.youtube-nocookie.com${payments ? ` ${RAZORPAY_FRAMES}` : ""}`,
    `${production ? "connect-src 'self'" : "connect-src 'self' ws: wss:"}${payments ? " https://api.razorpay.com https://lumberjack.razorpay.com" : ""}`,
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

/**
 * Whether the Razorpay checkout may be framed. Read from the environment inline
 * rather than importing lib/payments: next.config.ts loads this module without
 * the "@/" path alias, so it must stay dependency-free.
 */
function paymentsConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return (
    (env.PAYMENTS_ENABLED ?? "").trim().toLowerCase() === "true" &&
    (env.PAYMENT_PROVIDER ?? "").trim().toUpperCase() === "RAZORPAY" &&
    !!env.RAZORPAY_KEY_ID?.trim()
  );
}

export function securityHeaders(production = process.env.NODE_ENV === "production", payments = paymentsConfigured()): Header[] {
  const headers: Header[] = [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
    { key: "X-DNS-Prefetch-Control", value: "on" },
    { key: "Content-Security-Policy", value: contentSecurityPolicy(production, payments) },
  ];
  if (production) {
    // 2 years, include subdomains, preload-eligible. Only meaningful over HTTPS.
    headers.unshift({ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" });
  }
  return headers;
}
