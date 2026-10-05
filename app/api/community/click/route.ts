import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/guards";
import { parseCommunityClick, recordCommunityClick } from "@/lib/services/community";
import { clientIp, rateLimit } from "@/lib/utils/rate-limit";

/**
 * Records one "Join … community" click (sent with navigator.sendBeacon as the
 * WhatsApp invite opens). Always answers 204 — tracking must never get in the
 * way of joining — but only well-formed, same-site, rate-limited clicks are stored.
 */
export const dynamic = "force-dynamic";

const NO_CONTENT = () => new NextResponse(null, { status: 204 });

export async function POST(req: NextRequest) {
  // Beacons from our own pages carry our Origin; anything else is not a real click.
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.nextUrl.host) return NO_CONTENT();

  let body: unknown;
  try {
    body = JSON.parse(await req.text());
  } catch {
    return NO_CONTENT();
  }
  const click = parseCommunityClick(body);
  if (!click) return NO_CONTENT();

  const limit = await rateLimit(`community-click:${await clientIp()}`, 30, 10 * 60 * 1000);
  if (!limit.ok) return NO_CONTENT();

  try {
    const user = await getCurrentUser();
    await recordCommunityClick({ ...click, role: user?.role ?? null });
  } catch (err) {
    console.error("[community] click not recorded", err instanceof Error ? err.message : err);
  }
  return NO_CONTENT();
}
