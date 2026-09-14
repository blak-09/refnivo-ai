import { NextResponse, type NextRequest } from "next/server";
import { ATTRIBUTION_COOKIE, newVisitorId, recordClick, resolveReferralCode, VISITOR_COOKIE } from "@/lib/services/tracking";

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
  const resolved = await resolveReferralCode(code);
  const base = new URL(req.url);

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
  } catch (err) {
    // Tracking must never block the visitor from reaching the offer.
    console.error("[referral] click tracking failed", err instanceof Error ? err.message : err);
  }

  const dest = new URL(`/campaigns/${link.campaign.slug}`, base);
  dest.searchParams.set("ref", link.code);
  const res = NextResponse.redirect(dest, { status: 302 });

  const windowSeconds = link.campaign.attributionWindowDays * 24 * 60 * 60;
  const secure = base.protocol === "https:";
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
