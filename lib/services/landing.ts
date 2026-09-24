import { unstable_cache } from "next/cache";
import QRCode from "qrcode";
import { prisma } from "@/lib/db/prisma";
import { listMarketplaceCampaigns } from "./campaigns";
import { listPublicBrands } from "./brands";
import { listPublicCreators } from "./creators";
import { appOrigin } from "./links";

/**
 * Data for the public landing page.
 *
 * The page is rendered per request (the header needs the visitor's session),
 * but none of this content is visitor-specific, so it is cached for 60 s and
 * bounded to what the page actually shows (4 campaigns, 8 brands, 4
 * creators, 3 counts). Before this, every homepage hit ran the full
 * marketplace, brand and creator listings (unbounded) plus three counts and a
 * QR render, all round-tripping to the database.
 *
 * Failures are never cached. A degraded result (a transient database error
 * during a cold start, say) must not be pinned for the next 60 s — that turns
 * one blip into a minute of a homepage that claims there are no campaigns or
 * brands. The cached loader therefore throws on any failure, and the fallback
 * is produced OUTSIDE the cache, so the very next request queries again.
 */
export const LANDING_CACHE_TAG = "landing";
export const LANDING_REVALIDATE_SECONDS = 60;

export type LandingStats = { activeCampaigns: number; brandCount: number; creatorCount: number };

export type LandingData = {
  campaigns: Awaited<ReturnType<typeof listMarketplaceCampaigns>>;
  brands: Awaited<ReturnType<typeof listPublicBrands>>;
  creators: Awaited<ReturnType<typeof listPublicCreators>>;
  stats: LandingStats | null;
};

/** Everything the landing page shows. Throws if any part fails — see the note above. */
const loadLanding = unstable_cache(
  async (): Promise<LandingData> => {
    const [campaigns, brands, creators, stats] = await Promise.all([
      listMarketplaceCampaigns({ sort: "trending", limit: 4 }),
      listPublicBrands({ limit: 8 }),
      listPublicCreators({ limit: 4 }),
      (async (): Promise<LandingStats> => {
        const [activeCampaigns, brandCount, creatorCount] = await Promise.all([
          prisma.campaign.count({ where: { status: "ACTIVE" } }),
          prisma.brand.count({ where: { status: "ACTIVE" } }),
          prisma.creatorProfile.count({ where: { user: { status: "APPROVED" } } }),
        ]);
        return { activeCampaigns, brandCount, creatorCount };
      })(),
    ]);
    return { campaigns, brands, creators, stats };
  },
  ["landing-data"],
  { revalidate: LANDING_REVALIDATE_SECONDS, tags: [LANDING_CACHE_TAG] },
);

export const EMPTY_LANDING_DATA: LandingData = { campaigns: [], brands: [], creators: [], stats: null };

export async function getLandingData(): Promise<LandingData> {
  try {
    return await loadLanding();
  } catch (err) {
    // Outside the cache on purpose: the next request retries instead of
    // serving this degraded result for the rest of the revalidate window.
    console.error("[landing] load failed, rendering without listings", err instanceof Error ? err.message : err);
    return EMPTY_LANDING_DATA;
  }
}

// The marketplace QR only depends on the deployment origin: render it once per process.
// A failure is not memoised, so a later request can still produce the code.
let qrPromise: Promise<string | null> | null = null;
export function getMarketplaceQr(): Promise<string | null> {
  qrPromise ??= QRCode.toDataURL(`${appOrigin()}/campaigns`, { margin: 1, width: 128, color: { dark: "#1e1b4b", light: "#ffffff" } }).catch((err: unknown) => {
    console.error("[landing] qr failed", err instanceof Error ? err.message : err);
    qrPromise = null;
    return null;
  });
  return qrPromise;
}
