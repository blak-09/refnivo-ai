import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { isProduction } from "@/lib/config/env";
import { getCurrentUser } from "@/lib/auth/guards";
import { createPkcePair, getSocialProvider, isSocialPlatform, signState, socialRedirectUri } from "@/lib/social";
import { appOrigin } from "@/lib/services/links";
import { rateLimit } from "@/lib/utils/rate-limit";

/**
 * Starts a platform's own OAuth flow.
 *
 * Refnivo never sees a social password: we only redirect to the platform, which
 * authenticates the creator itself. The `state` we send is signed with the app
 * secret and carries who started the flow, so a callback that was not begun
 * here — or was begun by someone else — cannot attach an account.
 *
 * PKCE (X) stores its verifier in a short-lived, http-only cookie; it never
 * reaches the browser's JavaScript.
 */
export const dynamic = "force-dynamic";

export const PKCE_COOKIE = "refnivo.social-pkce";

export async function GET(req: NextRequest, ctx: { params: Promise<{ platform: string }> }) {
  const { platform: raw } = await ctx.params;
  const platform = raw.toUpperCase();
  if (!isSocialPlatform(platform)) return NextResponse.json({ error: "Unknown platform" }, { status: 404 });

  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL(`/auth/login?callbackUrl=${encodeURIComponent("/dashboard/creator/social")}`, req.url));
  if (user.role !== "CREATOR") return NextResponse.redirect(new URL("/dashboard", req.url));

  const provider = getSocialProvider(platform);
  if (!provider) return NextResponse.redirect(new URL("/dashboard/creator/social?error=unavailable", req.url));

  const limit = await rateLimit(`social-connect:${user.id}`, 20, 60 * 60 * 1000);
  if (!limit.ok) return NextResponse.redirect(new URL("/dashboard/creator/social?error=rate-limited", req.url));

  const redirectUri = socialRedirectUri(platform, appOrigin());
  const state = signState({ userId: user.id, platform });

  let codeChallenge: string | undefined;
  const res = NextResponse.redirect(provider.authorizeUrl({ redirectUri, state, codeChallenge: undefined }));
  if (provider.usesPkce) {
    const pkce = createPkcePair();
    codeChallenge = pkce.challenge;
    const secure = isProduction() || new URL(req.url).protocol === "https:";
    (await cookies()).set(PKCE_COOKIE, pkce.verifier, { httpOnly: true, sameSite: "lax", secure, path: "/api/social", maxAge: 600 });
    return NextResponse.redirect(provider.authorizeUrl({ redirectUri, state, codeChallenge }));
  }
  return res;
}
