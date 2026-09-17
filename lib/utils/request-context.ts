import { randomUUID } from "node:crypto";
import { hashValue } from "@/lib/services/tracking";

/**
 * Privacy-preserving request context for audit rows and security logs.
 *
 * - `ipHash`  — salted SHA-256 of the client IP (never the raw address).
 * - `userAgent` — truncated to 200 chars.
 * - `requestId` — the platform's request id when present (`x-vercel-id`,
 *   `x-request-id`), otherwise a fresh UUID so log lines can still be correlated.
 *
 * Reads `next/headers` lazily and swallows the "outside a request scope" error,
 * so services called from scripts, seeds and tests simply get `null`.
 */
export type RequestContext = { ipHash: string | null; userAgent: string | null; requestId: string };

export const USER_AGENT_MAX = 200;

/** Pure builder — used by the server wrapper below and by tests. */
export function buildRequestContext(get: (name: string) => string | null | undefined): RequestContext {
  const forwarded = get("x-forwarded-for");
  const ip = (forwarded ? forwarded.split(",")[0]?.trim() : null) || get("x-real-ip") || null;
  let ipHash: string | null = null;
  if (ip) {
    try {
      ipHash = hashValue(ip);
    } catch {
      ipHash = null; // AUTH_SECRET missing — never fall back to a raw IP
    }
  }
  const ua = get("user-agent");
  const requestId = get("x-vercel-id") || get("x-request-id") || randomUUID();
  return { ipHash, userAgent: ua ? ua.slice(0, USER_AGENT_MAX) : null, requestId: requestId.slice(0, 120) };
}

export async function getRequestContext(): Promise<RequestContext | null> {
  try {
    const { headers } = await import("next/headers");
    const h = await headers();
    return buildRequestContext((name) => h.get(name));
  } catch {
    return null;
  }
}
