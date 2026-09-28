import { createHmac, timingSafeEqual, randomBytes, createHash } from "node:crypto";
import type { SocialPlatform } from "@prisma/client";
import { requireAuthSecret } from "@/lib/config/env";
import { encryptionConfigured } from "@/lib/security/secret-box";
import { FacebookProvider, InstagramProvider, LinkedInProvider, XProvider, YouTubeProvider } from "./adapters";
import type { SocialProvider } from "./provider";

/**
 * Which platforms this deployment can actually connect.
 *
 * Each platform needs its own developer app, so they are configured — and
 * therefore enabled — independently: YouTube being set up says nothing about
 * Instagram. A platform without credentials is reported as unconfigured and its
 * Connect button is never offered, rather than failing at the redirect.
 *
 *   SOCIAL_TOKEN_ENCRYPTION_KEY   required for any platform (tokens at rest)
 *   YOUTUBE_CLIENT_ID / _SECRET   (Google Cloud, YouTube Data API v3)
 *   META_APP_ID / META_APP_SECRET (one Meta app serves Instagram and Facebook)
 *   LINKEDIN_CLIENT_ID / _SECRET
 *   X_CLIENT_ID / X_CLIENT_SECRET
 */
export const SOCIAL_PLATFORMS: SocialPlatform[] = ["INSTAGRAM", "YOUTUBE", "FACEBOOK", "LINKEDIN", "X"];

export type PlatformConfig = { platform: SocialPlatform; label: string; configured: boolean; reason: string | null };

const set = (v: string | undefined) => !!v?.trim();

export function getSocialProvider(platform: SocialPlatform, env: NodeJS.ProcessEnv = process.env): SocialProvider | null {
  if (!encryptionConfigured(env)) return null; // never store tokens in the clear
  const fetchImpl = fetch as never;
  switch (platform) {
    case "YOUTUBE":
      return set(env.YOUTUBE_CLIENT_ID) && set(env.YOUTUBE_CLIENT_SECRET)
        ? new YouTubeProvider(env.YOUTUBE_CLIENT_ID as string, env.YOUTUBE_CLIENT_SECRET as string, fetchImpl)
        : null;
    case "INSTAGRAM":
      return set(env.META_APP_ID) && set(env.META_APP_SECRET) ? new InstagramProvider(env.META_APP_ID as string, env.META_APP_SECRET as string, fetchImpl) : null;
    case "FACEBOOK":
      return set(env.META_APP_ID) && set(env.META_APP_SECRET) ? new FacebookProvider(env.META_APP_ID as string, env.META_APP_SECRET as string, fetchImpl) : null;
    case "LINKEDIN":
      return set(env.LINKEDIN_CLIENT_ID) && set(env.LINKEDIN_CLIENT_SECRET)
        ? new LinkedInProvider(env.LINKEDIN_CLIENT_ID as string, env.LINKEDIN_CLIENT_SECRET as string, fetchImpl)
        : null;
    case "X":
      return set(env.X_CLIENT_ID) && set(env.X_CLIENT_SECRET) ? new XProvider(env.X_CLIENT_ID as string, env.X_CLIENT_SECRET as string, fetchImpl) : null;
    default:
      return null;
  }
}

/** Why a platform is unavailable, in words a creator can act on. */
export function platformConfig(platform: SocialPlatform, env: NodeJS.ProcessEnv = process.env): PlatformConfig {
  const label = PLATFORM_LABEL[platform];
  if (!encryptionConfigured(env)) return { platform, label, configured: false, reason: "SOCIAL_TOKEN_ENCRYPTION_KEY is not set on this deployment." };
  const provider = getSocialProvider(platform, env);
  if (provider) return { platform, label, configured: true, reason: null };
  const needed: Record<SocialPlatform, string> = {
    YOUTUBE: "YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET",
    INSTAGRAM: "META_APP_ID and META_APP_SECRET",
    FACEBOOK: "META_APP_ID and META_APP_SECRET",
    LINKEDIN: "LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET",
    X: "X_CLIENT_ID and X_CLIENT_SECRET",
  };
  return { platform, label, configured: false, reason: `${needed[platform]} are not set on this deployment.` };
}

export const PLATFORM_LABEL: Record<SocialPlatform, string> = {
  INSTAGRAM: "Instagram",
  YOUTUBE: "YouTube",
  FACEBOOK: "Facebook",
  LINKEDIN: "LinkedIn",
  X: "X",
};

export function isSocialPlatform(value: unknown): value is SocialPlatform {
  return typeof value === "string" && (SOCIAL_PLATFORMS as string[]).includes(value);
}

/** Callback URL for a platform — must match the developer app exactly. */
export function socialRedirectUri(platform: SocialPlatform, origin: string): string {
  return `${origin.replace(/\/$/, "")}/api/social/${platform.toLowerCase()}/callback`;
}

// ─── OAuth state ──────────────────────────────────────────────────────────────

/**
 * The `state` parameter is signed rather than stored: it carries who started the
 * flow, which platform, a nonce and a timestamp, with an HMAC over all of it. A
 * callback that was not started by us — or was replayed later — fails to verify,
 * which is what stops one person's authorisation being attached to another's
 * account (CSRF).
 */
export type OAuthState = { userId: string; platform: SocialPlatform; nonce: string; issuedAt: number };

export const STATE_TTL_MS = 10 * 60 * 1000;

function stateKey(): string {
  return requireAuthSecret();
}

export function signState(input: Omit<OAuthState, "nonce" | "issuedAt">, now = Date.now()): string {
  const state: OAuthState = { ...input, nonce: randomBytes(8).toString("base64url"), issuedAt: now };
  const payload = Buffer.from(JSON.stringify(state)).toString("base64url");
  const mac = createHmac("sha256", stateKey()).update(payload).digest("base64url");
  return `${payload}.${mac}`;
}

export function verifyState(raw: string | null, now = Date.now()): OAuthState | null {
  if (!raw) return null;
  const [payload, mac] = raw.split(".");
  if (!payload || !mac) return null;
  const expected = createHmac("sha256", stateKey()).update(payload).digest("base64url");
  const a = Buffer.from(expected);
  const b = Buffer.from(mac);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const state = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as OAuthState;
    if (!state.userId || !isSocialPlatform(state.platform)) return null;
    if (now - state.issuedAt > STATE_TTL_MS) return null; // an old link cannot be replayed
    return state;
  } catch {
    return null;
  }
}

// ─── PKCE (X) ────────────────────────────────────────────────────────────────

export function createPkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  return { verifier, challenge: createHash("sha256").update(verifier).digest("base64url") };
}

export * from "./provider";
