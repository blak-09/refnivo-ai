import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth/guards";
import { getSocialProvider, isSocialPlatform, socialRedirectUri, verifyState } from "@/lib/social";
import { appOrigin } from "@/lib/services/links";
import { SocialAccountError, upsertSocialAccount } from "@/lib/services/social-accounts";
import { securityEvent } from "@/lib/utils/security-log";
import { PKCE_COOKIE } from "../start/route";

/**
 * Where the platform returns the creator.
 *
 * Order matters: the signed state is checked BEFORE anything else, and it must
 * also match the session — so an authorisation cannot be pasted into someone
 * else's browser to link an account to their profile. Only then is the code
 * exchanged and the profile read.
 *
 * Failures come back as a short, non-technical `error` on the settings page;
 * the provider's own message stays in the server log.
 */
export const dynamic = "force-dynamic";

const back = (req: NextRequest, params: Record<string, string>) =>
  NextResponse.redirect(new URL(`/dashboard/creator/social?${new URLSearchParams(params)}`, req.url));

export async function GET(req: NextRequest, ctx: { params: Promise<{ platform: string }> }) {
  const { platform: raw } = await ctx.params;
  const platform = raw.toUpperCase();
  if (!isSocialPlatform(platform)) return NextResponse.json({ error: "Unknown platform" }, { status: 404 });

  const url = new URL(req.url);
  // The creator pressed "cancel" on the platform's screen.
  if (url.searchParams.get("error")) return back(req, { error: "cancelled" });

  const state = verifyState(url.searchParams.get("state"));
  const user = await getCurrentUser();
  if (!state || !user || state.userId !== user.id || state.platform !== platform) {
    securityEvent("SOCIAL_OAUTH_STATE_INVALID", { platform });
    return back(req, { error: "state" });
  }

  const provider = getSocialProvider(platform);
  const code = url.searchParams.get("code");
  if (!provider || !code) return back(req, { error: "unavailable" });

  const jar = await cookies();
  const codeVerifier = provider.usesPkce ? jar.get(PKCE_COOKIE)?.value : undefined;
  if (provider.usesPkce && !codeVerifier) return back(req, { error: "expired" });

  try {
    const tokens = await provider.exchangeCode({ code, redirectUri: socialRedirectUri(platform, appOrigin()), codeVerifier });
    const profile = await provider.fetchProfile(tokens.accessToken);
    await upsertSocialAccount({ userId: user.id, platform, profile, tokens });
    if (provider.usesPkce) jar.delete(PKCE_COOKIE);
    return back(req, { connected: platform.toLowerCase() });
  } catch (err) {
    console.error("[social] callback failed", platform, err instanceof Error ? err.message : err);
    if (err instanceof SocialAccountError) return back(req, { error: "claimed" });
    // A provider error carries a safe public message; anything else is generic.
    const publicMessage = err && typeof err === "object" && "publicMessage" in err ? String((err as { publicMessage: string }).publicMessage) : "";
    return back(req, publicMessage ? { error: "provider", detail: publicMessage.slice(0, 160) } : { error: "provider" });
  }
}
