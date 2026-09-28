import { NextResponse, type NextRequest } from "next/server";
import { isProduction } from "@/lib/config/env";
import { ATTRIBUTION_COOKIE, newVisitorId, recordClick, resolveReferralCode, VISITOR_COOKIE } from "@/lib/services/tracking";
import { rateLimit } from "@/lib/utils/rate-limit";
import { recordAffiliateClick, resolveAffiliateCode, withSubId } from "@/lib/services/affiliate-links";
import { securityEvent } from "@/lib/utils/security-log";

/** Clicks per IP per minute before tracking is skipped (the redirect always happens). */
const CLICKS_PER_MINUTE = 60;

/**
 * Referral entry point: /r/[code] (append ?src=qr for QR scans).
 * 1. Validate the code and that the campaign is live.
 * 2. Record the click + referral session for an anonymous visitor id.
 * 3. Store last-click attribution (cookie, attribution window from the campaign).
 * 4. Redirect to the public campaign page carrying ?ref=CODE.
 * A click is never treated as a sale.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const base = new URL(req.url);

  // External affiliate programmes share this code namespace. Their codes forward
  // straight to the creator's own affiliate URL — no intermediate page.
  // A failure here must never break campaign links (e.g. a deploy that lands
  // before its migration): fall through to the campaign lookup instead.
  let affiliate: Awaited<ReturnType<typeof resolveAffiliateCode>> = null;
  try {
    affiliate = await resolveAffiliateCode(code);
  } catch (err) {
    console.error("[affiliate] code lookup failed, falling back to campaign links", err instanceof Error ? err.message : err);
  }
  if (affiliate) return affiliateRedirect(req, affiliate, base);

  const resolved = await resolveReferralCode(code);

  if (!resolved.ok) {
    const status = resolved.reason === "NOT_FOUND" ? "invalid" : "inactive";
    const dest = resolved.reason !== "NOT_FOUND" && "link" in resolved && resolved.link ? `/campaigns/${resolved.link.campaign.slug}?link=${status}` : `/campaigns?link=${status}`;
    return NextResponse.redirect(new URL(dest, base), { status: 302 });
  }

  const link = resolved.link;
  const source = base.searchParams.get("src") === "qr" ? "QR" : "LINK";
  const visitorId = req.cookies.get(VISITOR_COOKIE)?.value || newVisitorId();
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : null;

  try {
    // Abuse guard: a flood of hits from one address is redirected but not counted.
    const limit = await rateLimit(`click:${ip ?? "local"}`, CLICKS_PER_MINUTE, 60 * 1000);
    if (limit.ok) {
      await recordClick({
        linkId: link.id,
        campaignId: link.campaignId,
        referrerId: link.ownerId,
        visitorId,
        source,
        ip,
        userAgent: req.headers.get("user-agent"),
        referer: req.headers.get("referer"),
      });
    } else {
      securityEvent("RATE_LIMITED", { scope: "click", code: link.code });
    }
  } catch (err) {
    // Tracking must never block the visitor from reaching the offer.
    console.error("[referral] click tracking failed", err instanceof Error ? err.message : err);
  }

  const dest = new URL(`/campaigns/${link.campaign.slug}`, base);
  dest.searchParams.set("ref", link.code);
  const res = NextResponse.redirect(dest, { status: 302 });

  const windowSeconds = link.campaign.attributionWindowDays * 24 * 60 * 60;
  // Behind a TLS-terminating proxy the request URL may be http; trust the forwarded protocol / production flag.
  const secure = isProduction() || base.protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
  res.cookies.set(VISITOR_COOKIE, visitorId, { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: 60 * 60 * 24 * 365 });
  res.cookies.set(ATTRIBUTION_COOKIE, JSON.stringify({ code: link.code, campaignId: link.campaignId, at: Date.now() }), {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: windowSeconds,
  });
  return res;
}

/**
 * Forward to an external affiliate programme.
 *
 *   validate the code → record the click (with its platform) → 302 to the
 *   creator's own affiliate URL, plus a sub id only if the programme declares one.
 *
 * Tracking never blocks the visitor: if recording fails they are still sent on.
 * The destination was checked when the creator saved it (http(s) only, never a
 * Refnivo URL), and only an ACTIVE link on an APPROVED programme forwards at all.
 */
async function affiliateRedirect(req: NextRequest, affiliate: NonNullable<Awaited<ReturnType<typeof resolveAffiliateCode>>>, base: URL) {
  if (!affiliate.ok) return NextResponse.redirect(new URL(`/affiliate-programs/${affiliate.programSlug}?link=inactive`, base), { status: 302 });
  const { row } = affiliate;
  const visitorId = req.cookies.get(VISITOR_COOKIE)?.value || newVisitorId();
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : null;

  let subId: string | null = null;
  try {
    const limit = await rateLimit(`click:${ip ?? "local"}`, CLICKS_PER_MINUTE, 60 * 1000);
    if (limit.ok) {
      const result = await recordAffiliateClick({
        code: row.code,
        trackingCodeId: row.id,
        linkId: row.link.id,
        programId: row.link.program.id,
        creatorId: row.link.creatorId,
        source: row.source,
        visitorId,
        ip,
        userAgent: req.headers.get("user-agent"),
        referer: req.headers.get("referer"),
        subIdParam: row.link.program.subIdParam,
      });
      subId = result.subId;
    } else {
      securityEvent("RATE_LIMITED", { scope: "affiliate-click", code: row.code });
    }
  } catch (err) {
    console.error("[affiliate] click tracking failed", err instanceof Error ? err.message : err);
  }

  const destination = subId ? withSubId(row.link.targetUrl, row.link.program.subIdParam, subId) : row.link.targetUrl;
  const res = NextResponse.redirect(destination, { status: 302 });
  const secure = isProduction() || base.protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
  res.cookies.set(VISITOR_COOKIE, visitorId, { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: 60 * 60 * 24 * 365 });
  return res;
}
