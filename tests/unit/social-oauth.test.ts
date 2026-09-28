import { describe, expect, it } from "vitest";
import { decryptSecret, deriveKey, encryptSecret, SecretBoxError, encryptionConfigured } from "@/lib/security/secret-box";
import { createPkcePair, getSocialProvider, platformConfig, signState, socialRedirectUri, STATE_TTL_MS, verifyState, SOCIAL_PLATFORMS } from "@/lib/social";
import { FacebookProvider, InstagramProvider, LinkedInProvider, XProvider, YouTubeProvider } from "@/lib/social/adapters";

const env = (v: Record<string, string>) => v as unknown as NodeJS.ProcessEnv;
const KEY = Buffer.alloc(32, 7);

describe("token encryption", () => {
  it("round-trips a token and produces a different ciphertext each time", () => {
    const token = "ya29.a0AfH6SMB-secret-value";
    const a = encryptSecret(token, KEY);
    const b = encryptSecret(token, KEY);
    expect(a).not.toBe(b); // fresh IV per call
    expect(a.startsWith("v1.")).toBe(true);
    expect(a).not.toContain(token);
    expect(decryptSecret(a, KEY)).toBe(token);
    expect(decryptSecret(b, KEY)).toBe(token);
  });

  it("refuses a tampered ciphertext and a wrong key", () => {
    const sealed = encryptSecret("token", KEY);
    const [v, iv, tag, ct] = sealed.split(".");
    expect(() => decryptSecret([v, iv, tag, `${ct}AA`].join("."), KEY)).toThrow(SecretBoxError);
    expect(() => decryptSecret(sealed, Buffer.alloc(32, 9))).toThrow(SecretBoxError);
    expect(() => decryptSecret("garbage", KEY)).toThrow(SecretBoxError);
  });

  it("will not encrypt without a key, rather than falling back to plaintext", () => {
    expect(() => deriveKey(undefined)).toThrow(SecretBoxError);
    expect(() => deriveKey("   ")).toThrow(SecretBoxError);
    expect(encryptionConfigured(env({}))).toBe(false);
    expect(encryptionConfigured(env({ SOCIAL_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString("base64") }))).toBe(true);
  });

  it("accepts a 32-byte key as base64 or hex, and hashes a passphrase", () => {
    expect(deriveKey(Buffer.alloc(32, 3).toString("base64"))).toHaveLength(32);
    expect(deriveKey(Buffer.alloc(32, 3).toString("hex"))).toHaveLength(32);
    expect(deriveKey("a-long-enough-passphrase-for-hashing")).toHaveLength(32);
  });
});

describe("oauth state", () => {
  it("round-trips and binds the user and platform", () => {
    const state = signState({ userId: "user_1", platform: "YOUTUBE" });
    expect(verifyState(state)).toMatchObject({ userId: "user_1", platform: "YOUTUBE" });
  });

  it("rejects a forged, altered, empty or expired state", () => {
    const state = signState({ userId: "user_1", platform: "YOUTUBE" });
    const [payload, mac] = state.split(".");
    expect(verifyState(null)).toBeNull();
    expect(verifyState("")).toBeNull();
    expect(verifyState(payload)).toBeNull(); // no signature
    expect(verifyState(`${payload}.${"a".repeat(mac.length)}`)).toBeNull(); // wrong signature
    // Payload swapped for another user, keeping the old signature.
    const forged = Buffer.from(JSON.stringify({ userId: "someone_else", platform: "YOUTUBE", nonce: "x", issuedAt: Date.now() })).toString("base64url");
    expect(verifyState(`${forged}.${mac}`)).toBeNull();
    // Replayed after the window.
    const old = signState({ userId: "user_1", platform: "YOUTUBE" }, Date.now() - STATE_TTL_MS - 1000);
    expect(verifyState(old)).toBeNull();
  });

  it("gives every flow a distinct state", () => {
    expect(signState({ userId: "u", platform: "X" })).not.toBe(signState({ userId: "u", platform: "X" }));
  });
});

describe("pkce", () => {
  it("derives an S256 challenge from a fresh verifier", () => {
    const a = createPkcePair();
    const b = createPkcePair();
    expect(a.verifier).not.toBe(b.verifier);
    expect(a.challenge).not.toBe(a.verifier);
    expect(a.challenge).toMatch(/^[A-Za-z0-9_-]+$/); // base64url, no padding
  });
});

describe("platform configuration", () => {
  it("is off for every platform until that platform's credentials exist", () => {
    for (const platform of SOCIAL_PLATFORMS) {
      expect(platformConfig(platform, env({})).configured).toBe(false);
      expect(getSocialProvider(platform, env({}))).toBeNull();
    }
  });

  it("enables platforms independently, and never without the encryption key", () => {
    const key = { SOCIAL_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString("base64") };
    const withYouTube = env({ ...key, YOUTUBE_CLIENT_ID: "id", YOUTUBE_CLIENT_SECRET: "secret" });
    expect(platformConfig("YOUTUBE", withYouTube).configured).toBe(true);
    // Configuring YouTube does not turn on anything else.
    expect(platformConfig("INSTAGRAM", withYouTube).configured).toBe(false);
    expect(platformConfig("INSTAGRAM", withYouTube).reason).toMatch(/META_APP_ID/);
    // One Meta app serves both Instagram and Facebook.
    const meta = env({ ...key, META_APP_ID: "id", META_APP_SECRET: "secret" });
    expect(platformConfig("INSTAGRAM", meta).configured).toBe(true);
    expect(platformConfig("FACEBOOK", meta).configured).toBe(true);
    // No encryption key: nothing is connectable, whatever else is set.
    expect(platformConfig("YOUTUBE", env({ YOUTUBE_CLIENT_ID: "id", YOUTUBE_CLIENT_SECRET: "s" })).reason).toMatch(/SOCIAL_TOKEN_ENCRYPTION_KEY/);
  });

  it("builds a callback URL per platform", () => {
    expect(socialRedirectUri("YOUTUBE", "https://www.refnivo.com/")).toBe("https://www.refnivo.com/api/social/youtube/callback");
    expect(socialRedirectUri("X", "https://www.refnivo.com")).toBe("https://www.refnivo.com/api/social/x/callback");
  });
});

describe("adapters", () => {
  const redirectUri = "https://www.refnivo.com/api/social/x/callback";
  const state = "signed-state";

  it("sends the creator to the platform's own authorisation screen with only the declared scopes", () => {
    const cases = [
      { p: new YouTubeProvider("cid", "sec"), host: "accounts.google.com", scope: "youtube.readonly" },
      { p: new InstagramProvider("app", "sec"), host: "www.facebook.com", scope: "instagram_basic" },
      { p: new FacebookProvider("app", "sec"), host: "www.facebook.com", scope: "pages_show_list" },
      { p: new LinkedInProvider("cid", "sec"), host: "www.linkedin.com", scope: "openid" },
      { p: new XProvider("cid", "sec"), host: "twitter.com", scope: "users.read" },
    ];
    for (const { p, host, scope } of cases) {
      const url = new URL(p.authorizeUrl({ redirectUri, state, codeChallenge: "challenge" }));
      expect(url.host).toBe(host);
      expect(url.searchParams.get("state")).toBe(state);
      expect(url.searchParams.get("redirect_uri")).toBe(redirectUri);
      expect(url.searchParams.get("scope")).toContain(scope);
      // The app secret is never in a URL the browser follows.
      expect(url.toString()).not.toContain("sec");
    }
  });

  it("uses PKCE only where the platform requires it", () => {
    expect(new XProvider("id", "s").usesPkce).toBe(true);
    const challenge = new URL(new XProvider("id", "s").authorizeUrl({ redirectUri, state, codeChallenge: "abc" })).searchParams;
    expect(challenge.get("code_challenge")).toBe("abc");
    expect(challenge.get("code_challenge_method")).toBe("S256");
    for (const p of [new YouTubeProvider("i", "s"), new InstagramProvider("i", "s"), new FacebookProvider("i", "s"), new LinkedInProvider("i", "s")]) {
      expect(p.usesPkce).toBe(false);
    }
  });

  it("declares honestly which platforms can report a follower count", () => {
    expect(new YouTubeProvider("i", "s").followerMetric.available).toBe(true);
    expect(new InstagramProvider("i", "s").followerMetric.available).toBe(true);
    expect(new FacebookProvider("i", "s").followerMetric.available).toBe(true);
    expect(new XProvider("i", "s").followerMetric.available).toBe(true);
    const linkedin = new LinkedInProvider("i", "s").followerMetric;
    expect(linkedin.available).toBe(false);
    if (!linkedin.available) expect(linkedin.reason).toMatch(/does not share member follower counts/i);
  });

  it("reads a profile without inventing a follower count", async () => {
    const youtube = new YouTubeProvider("i", "s", async () => ({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({ items: [{ id: "UC123", snippet: { title: "Chan", customUrl: "@chan" }, statistics: { subscriberCount: "8200" } }] }),
    }));
    expect(await youtube.fetchProfile("token")).toMatchObject({ providerAccountId: "UC123", handle: "@chan", followers: 8200 });

    // A channel that hides its subscriber count reports null, not zero.
    const hidden = new YouTubeProvider("i", "s", async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ items: [{ id: "UC9", snippet: { title: "C" }, statistics: { hiddenSubscriberCount: true, subscriberCount: "0" } }] }),
    }));
    expect((await hidden.fetchProfile("token")).followers).toBeNull();

    // LinkedIn never reports one.
    const linkedin = new LinkedInProvider("i", "s", async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ sub: "abc", name: "A Person" }) }));
    expect((await linkedin.fetchProfile("token")).followers).toBeNull();
  });

  it("explains an Instagram account that is not a business account, without leaking provider detail", async () => {
    const ig = new InstagramProvider("i", "s", async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ data: [{ id: "page1" }] }) }));
    await expect(ig.fetchProfile("token")).rejects.toMatchObject({ publicMessage: expect.stringContaining("Instagram Business") });
  });
});
