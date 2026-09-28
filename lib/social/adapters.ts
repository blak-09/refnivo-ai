import type { SocialPlatform } from "@prisma/client";
import { callJson, SocialProviderError, type FetchLike, type MetricAvailability, type SocialProfile, type SocialProvider, type TokenSet } from "./provider";

/**
 * One adapter per platform. Endpoints, scopes and metric availability are
 * written down per platform because they genuinely differ — see each class.
 *
 * Every adapter takes its credentials by constructor and a `fetchImpl` so it can
 * be exercised without network access.
 */
const form = (data: Record<string, string>) => new URLSearchParams(data).toString();
const FORM_HEADERS = { "Content-Type": "application/x-www-form-urlencoded" };

function expiry(seconds: unknown): Date | null {
  const n = typeof seconds === "number" ? seconds : Number(seconds);
  return Number.isFinite(n) && n > 0 ? new Date(Date.now() + n * 1000) : null;
}

/**
 * YouTube — Google OAuth 2.0 + YouTube Data API v3.
 * Follower metric: available. `channels.list?part=statistics&mine=true` returns
 * subscriberCount, unless the channel owner has hidden it (then null).
 */
export class YouTubeProvider implements SocialProvider {
  readonly platform: SocialPlatform = "YOUTUBE";
  readonly label = "YouTube";
  readonly scopes = ["https://www.googleapis.com/auth/youtube.readonly"];
  readonly purpose = "Read your channel name, handle and subscriber count to show on your Refnivo profile.";
  readonly followerMetric: MetricAvailability = { available: true };
  readonly usesPkce = false;

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly fetchImpl: FetchLike = fetch as unknown as FetchLike,
  ) {}

  authorizeUrl({ redirectUri, state }: { redirectUri: string; state: string }): string {
    return `https://accounts.google.com/o/oauth2/v2/auth?${form({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: this.scopes.join(" "),
      access_type: "offline", // so we receive a refresh token
      prompt: "consent",
      include_granted_scopes: "true",
      state,
    })}`;
  }

  async exchangeCode({ code, redirectUri }: { code: string; redirectUri: string }): Promise<TokenSet> {
    const body = await callJson<{ access_token: string; refresh_token?: string; expires_in?: number; scope?: string }>(
      this.fetchImpl,
      "https://oauth2.googleapis.com/token",
      { method: "POST", headers: FORM_HEADERS, body: form({ code, client_id: this.clientId, client_secret: this.clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }) },
      "google token",
    );
    return { accessToken: body.access_token, refreshToken: body.refresh_token ?? null, expiresAt: expiry(body.expires_in), scopes: body.scope?.split(" ") ?? this.scopes };
  }

  async refresh(refreshToken: string): Promise<TokenSet> {
    const body = await callJson<{ access_token: string; expires_in?: number; scope?: string }>(
      this.fetchImpl,
      "https://oauth2.googleapis.com/token",
      { method: "POST", headers: FORM_HEADERS, body: form({ refresh_token: refreshToken, client_id: this.clientId, client_secret: this.clientSecret, grant_type: "refresh_token" }) },
      "google refresh",
    );
    return { accessToken: body.access_token, refreshToken, expiresAt: expiry(body.expires_in), scopes: body.scope?.split(" ") ?? this.scopes };
  }

  async fetchProfile(accessToken: string): Promise<SocialProfile> {
    const body = await callJson<{
      items?: { id: string; snippet?: { title?: string; customUrl?: string; thumbnails?: { default?: { url?: string } } }; statistics?: { subscriberCount?: string; hiddenSubscriberCount?: boolean } }[];
    }>(this.fetchImpl, "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true", { headers: { Authorization: `Bearer ${accessToken}` } }, "youtube channels");
    const channel = body.items?.[0];
    if (!channel) throw new SocialProviderError("no channel on this Google account", "That Google account has no YouTube channel.");
    // Hidden subscriber counts stay null rather than being shown as 0.
    const hidden = channel.statistics?.hiddenSubscriberCount === true;
    const subs = Number(channel.statistics?.subscriberCount);
    return {
      providerAccountId: channel.id,
      handle: channel.snippet?.customUrl ?? channel.snippet?.title ?? null,
      profileUrl: channel.snippet?.customUrl ? `https://www.youtube.com/${channel.snippet.customUrl}` : `https://www.youtube.com/channel/${channel.id}`,
      avatarUrl: channel.snippet?.thumbnails?.default?.url ?? null,
      followers: !hidden && Number.isFinite(subs) ? subs : null,
    };
  }
}

/**
 * Instagram — Facebook Login for Business + Instagram Graph API.
 * Requires the creator's Instagram account to be a Business/Creator account
 * linked to a Facebook Page; personal accounts cannot be read this way.
 * Follower metric: available (`followers_count`).
 */
export class InstagramProvider implements SocialProvider {
  readonly platform: SocialPlatform = "INSTAGRAM";
  readonly label = "Instagram";
  readonly scopes = ["instagram_basic", "pages_show_list", "pages_read_engagement"];
  readonly purpose = "Read your Instagram Business/Creator username, picture and follower count to show on your Refnivo profile.";
  readonly followerMetric: MetricAvailability = { available: true };
  readonly usesPkce = false;

  constructor(
    private readonly appId: string,
    private readonly appSecret: string,
    private readonly fetchImpl: FetchLike = fetch as unknown as FetchLike,
    private readonly version = "v21.0",
  ) {}

  authorizeUrl({ redirectUri, state }: { redirectUri: string; state: string }): string {
    return `https://www.facebook.com/${this.version}/dialog/oauth?${form({ client_id: this.appId, redirect_uri: redirectUri, response_type: "code", scope: this.scopes.join(","), state })}`;
  }

  async exchangeCode({ code, redirectUri }: { code: string; redirectUri: string }): Promise<TokenSet> {
    const short = await callJson<{ access_token: string; expires_in?: number }>(
      this.fetchImpl,
      `https://graph.facebook.com/${this.version}/oauth/access_token?${form({ client_id: this.appId, client_secret: this.appSecret, redirect_uri: redirectUri, code })}`,
      {},
      "facebook token",
    );
    // Short-lived tokens last ~1 hour; exchange for the ~60-day long-lived one.
    const long = await callJson<{ access_token: string; expires_in?: number }>(
      this.fetchImpl,
      `https://graph.facebook.com/${this.version}/oauth/access_token?${form({ grant_type: "fb_exchange_token", client_id: this.appId, client_secret: this.appSecret, fb_exchange_token: short.access_token })}`,
      {},
      "facebook long-lived token",
    );
    return { accessToken: long.access_token, refreshToken: null, expiresAt: expiry(long.expires_in), scopes: this.scopes };
  }

  async fetchProfile(accessToken: string): Promise<SocialProfile> {
    const pages = await callJson<{ data?: { id: string; instagram_business_account?: { id: string } }[] }>(
      this.fetchImpl,
      `https://graph.facebook.com/${this.version}/me/accounts?fields=instagram_business_account&access_token=${encodeURIComponent(accessToken)}`,
      {},
      "facebook pages",
    );
    const igId = pages.data?.map((p) => p.instagram_business_account?.id).find(Boolean);
    if (!igId) {
      throw new SocialProviderError(
        "no instagram business account on any page",
        "We could not find an Instagram Business or Creator account linked to your Facebook Page. Instagram only shares this data for business accounts.",
      );
    }
    const profile = await callJson<{ id: string; username?: string; profile_picture_url?: string; followers_count?: number }>(
      this.fetchImpl,
      `https://graph.facebook.com/${this.version}/${igId}?fields=username,profile_picture_url,followers_count&access_token=${encodeURIComponent(accessToken)}`,
      {},
      "instagram profile",
    );
    return {
      providerAccountId: profile.id,
      handle: profile.username ?? null,
      profileUrl: profile.username ? `https://www.instagram.com/${profile.username}/` : null,
      avatarUrl: profile.profile_picture_url ?? null,
      followers: typeof profile.followers_count === "number" ? profile.followers_count : null,
    };
  }
}

/**
 * Facebook — Pages API. We read the creator's Page, not their personal profile:
 * personal follower counts are not available to apps.
 * Follower metric: available for a Page (`followers_count`).
 */
export class FacebookProvider implements SocialProvider {
  readonly platform: SocialPlatform = "FACEBOOK";
  readonly label = "Facebook";
  readonly scopes = ["pages_show_list", "pages_read_engagement"];
  readonly purpose = "Read your Facebook Page name and follower count to show on your Refnivo profile.";
  readonly followerMetric: MetricAvailability = { available: true };
  readonly usesPkce = false;

  constructor(
    private readonly appId: string,
    private readonly appSecret: string,
    private readonly fetchImpl: FetchLike = fetch as unknown as FetchLike,
    private readonly version = "v21.0",
  ) {}

  authorizeUrl({ redirectUri, state }: { redirectUri: string; state: string }): string {
    return `https://www.facebook.com/${this.version}/dialog/oauth?${form({ client_id: this.appId, redirect_uri: redirectUri, response_type: "code", scope: this.scopes.join(","), state })}`;
  }

  async exchangeCode(input: { code: string; redirectUri: string }): Promise<TokenSet> {
    return new InstagramProvider(this.appId, this.appSecret, this.fetchImpl, this.version).exchangeCode(input);
  }

  async fetchProfile(accessToken: string): Promise<SocialProfile> {
    const pages = await callJson<{ data?: { id: string; name?: string; followers_count?: number; link?: string; picture?: { data?: { url?: string } } }[] }>(
      this.fetchImpl,
      `https://graph.facebook.com/${this.version}/me/accounts?fields=name,followers_count,link,picture&access_token=${encodeURIComponent(accessToken)}`,
      {},
      "facebook pages",
    );
    const page = pages.data?.[0];
    if (!page) throw new SocialProviderError("no pages", "We could not find a Facebook Page you manage. Refnivo links Pages, not personal profiles.");
    return {
      providerAccountId: page.id,
      handle: page.name ?? null,
      profileUrl: page.link ?? `https://www.facebook.com/${page.id}`,
      avatarUrl: page.picture?.data?.url ?? null,
      followers: typeof page.followers_count === "number" ? page.followers_count : null,
    };
  }
}

/**
 * LinkedIn — "Sign In with LinkedIn using OpenID Connect".
 * Follower metric: NOT available. The member API returns name, picture and
 * e-mail only; follower counts exist for organisation pages via
 * `r_organization_social`, which needs LinkedIn partner approval we do not have.
 */
export class LinkedInProvider implements SocialProvider {
  readonly platform: SocialPlatform = "LINKEDIN";
  readonly label = "LinkedIn";
  readonly scopes = ["openid", "profile"];
  readonly purpose = "Confirm your LinkedIn identity and show your profile link on Refnivo.";
  readonly followerMetric: MetricAvailability = {
    available: false,
    reason: "LinkedIn does not share member follower counts through its public API.",
  };
  readonly usesPkce = false;

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly fetchImpl: FetchLike = fetch as unknown as FetchLike,
  ) {}

  authorizeUrl({ redirectUri, state }: { redirectUri: string; state: string }): string {
    return `https://www.linkedin.com/oauth/v2/authorization?${form({ response_type: "code", client_id: this.clientId, redirect_uri: redirectUri, scope: this.scopes.join(" "), state })}`;
  }

  async exchangeCode({ code, redirectUri }: { code: string; redirectUri: string }): Promise<TokenSet> {
    const body = await callJson<{ access_token: string; expires_in?: number; scope?: string }>(
      this.fetchImpl,
      "https://www.linkedin.com/oauth/v2/accessToken",
      { method: "POST", headers: FORM_HEADERS, body: form({ grant_type: "authorization_code", code, redirect_uri: redirectUri, client_id: this.clientId, client_secret: this.clientSecret }) },
      "linkedin token",
    );
    return { accessToken: body.access_token, refreshToken: null, expiresAt: expiry(body.expires_in), scopes: body.scope?.split(" ") ?? this.scopes };
  }

  async fetchProfile(accessToken: string): Promise<SocialProfile> {
    const body = await callJson<{ sub: string; name?: string; picture?: string }>(
      this.fetchImpl,
      "https://api.linkedin.com/v2/userinfo",
      { headers: { Authorization: `Bearer ${accessToken}` } },
      "linkedin userinfo",
    );
    return {
      providerAccountId: body.sub,
      handle: body.name ?? null,
      // The API gives no vanity URL, so we link to the member's own feed page.
      profileUrl: "https://www.linkedin.com/in/",
      avatarUrl: body.picture ?? null,
      followers: null, // see followerMetric
    };
  }
}

/**
 * X — OAuth 2.0 with PKCE.
 * Follower metric: available via `public_metrics`, on paid API tiers. On the
 * free tier the profile read is rate-limited to a handful of calls, so the
 * count may simply be missing; it is stored as null rather than guessed.
 */
export class XProvider implements SocialProvider {
  readonly platform: SocialPlatform = "X";
  readonly label = "X";
  readonly scopes = ["tweet.read", "users.read", "offline.access"];
  readonly purpose = "Read your X handle, picture and follower count to show on your Refnivo profile.";
  readonly followerMetric: MetricAvailability = { available: true };
  readonly usesPkce = true;

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly fetchImpl: FetchLike = fetch as unknown as FetchLike,
  ) {}

  authorizeUrl({ redirectUri, state, codeChallenge }: { redirectUri: string; state: string; codeChallenge?: string }): string {
    return `https://twitter.com/i/oauth2/authorize?${form({
      response_type: "code",
      client_id: this.clientId,
      redirect_uri: redirectUri,
      scope: this.scopes.join(" "),
      state,
      code_challenge: codeChallenge ?? "",
      code_challenge_method: "S256",
    })}`;
  }

  async exchangeCode({ code, redirectUri, codeVerifier }: { code: string; redirectUri: string; codeVerifier?: string }): Promise<TokenSet> {
    if (!codeVerifier) throw new SocialProviderError("missing pkce verifier");
    const body = await callJson<{ access_token: string; refresh_token?: string; expires_in?: number; scope?: string }>(
      this.fetchImpl,
      "https://api.twitter.com/2/oauth2/token",
      {
        method: "POST",
        headers: { ...FORM_HEADERS, Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64")}` },
        body: form({ code, grant_type: "authorization_code", redirect_uri: redirectUri, code_verifier: codeVerifier }),
      },
      "x token",
    );
    return { accessToken: body.access_token, refreshToken: body.refresh_token ?? null, expiresAt: expiry(body.expires_in), scopes: body.scope?.split(" ") ?? this.scopes };
  }

  async fetchProfile(accessToken: string): Promise<SocialProfile> {
    const body = await callJson<{ data?: { id: string; username?: string; profile_image_url?: string; public_metrics?: { followers_count?: number } } }>(
      this.fetchImpl,
      "https://api.twitter.com/2/users/me?user.fields=profile_image_url,public_metrics",
      { headers: { Authorization: `Bearer ${accessToken}` } },
      "x users/me",
    );
    const user = body.data;
    if (!user) throw new SocialProviderError("no user in response");
    const followers = user.public_metrics?.followers_count;
    return {
      providerAccountId: user.id,
      handle: user.username ?? null,
      profileUrl: user.username ? `https://x.com/${user.username}` : null,
      avatarUrl: user.profile_image_url ?? null,
      followers: typeof followers === "number" ? followers : null,
    };
  }
}
