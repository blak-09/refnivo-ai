import type { SocialPlatform } from "@prisma/client";

/**
 * Social platform port.
 *
 * One adapter per platform, so a limitation or an outage on one never affects
 * the others: each declares its own endpoints, scopes and — importantly — what
 * it can actually tell us. Nothing above this interface knows a platform's
 * specifics, and no adapter touches the database.
 */

/** What a platform can report under the scopes we ask for. */
export type MetricAvailability =
  | { available: true }
  /** Officially unavailable (or needs a partnership we do not have): the UI says so instead of showing a number. */
  | { available: false; reason: string };

export type SocialProfile = {
  /** The platform's stable id for the account. */
  providerAccountId: string;
  handle: string | null;
  profileUrl: string | null;
  avatarUrl: string | null;
  /** Null when the platform does not expose it — never a guess. */
  followers: number | null;
};

export type TokenSet = {
  accessToken: string;
  refreshToken: string | null;
  /** Absolute expiry, when the platform tells us one. */
  expiresAt: Date | null;
  /** Scopes the user actually granted (may be fewer than requested). */
  scopes: string[];
};

export class SocialProviderError extends Error {
  constructor(
    message: string,
    readonly publicMessage = "That platform could not be reached. Please try again.",
  ) {
    super(message);
    this.name = "SocialProviderError";
  }
}

export interface SocialProvider {
  readonly platform: SocialPlatform;
  readonly label: string;
  /** Exactly the permissions we request, shown to the creator before they connect. */
  readonly scopes: string[];
  /** Plain-English description of what Refnivo does with the connection. */
  readonly purpose: string;
  /** Whether this platform reports a follower count to us. */
  readonly followerMetric: MetricAvailability;
  /** Where to send the creator to authorise. `state` is signed by the caller. */
  authorizeUrl(input: { redirectUri: string; state: string; codeChallenge?: string }): string;
  /** Whether this adapter uses PKCE (X requires it). */
  readonly usesPkce: boolean;
  exchangeCode(input: { code: string; redirectUri: string; codeVerifier?: string }): Promise<TokenSet>;
  fetchProfile(accessToken: string): Promise<SocialProfile>;
  /** Long-lived platforms return null; the others exchange a refresh token. */
  refresh?(refreshToken: string): Promise<TokenSet>;
}

export type FetchLike = (
  input: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

/** Shared JSON call with a timeout; provider detail stays in the thrown message, never in the UI. */
export async function callJson<T>(
  fetchImpl: FetchLike,
  url: string,
  init: { method?: string; headers?: Record<string, string>; body?: string },
  label: string,
): Promise<T> {
  let res: { ok: boolean; status: number; text(): Promise<string> };
  try {
    res = await fetchImpl(url, init);
  } catch (err) {
    throw new SocialProviderError(`${label} request failed: ${err instanceof Error ? err.message : "unknown error"}`);
  }
  const text = await res.text();
  if (!res.ok) throw new SocialProviderError(`${label} responded ${res.status}: ${text.slice(0, 300)}`);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new SocialProviderError(`${label} returned a non-JSON body`);
  }
}
