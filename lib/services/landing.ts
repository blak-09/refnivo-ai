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
 */
export const LANDING_CACHE_TAG = "landing";
export const LANDING_REVALIDATE_SECONDS = 60;

export type LandingStats = { activeCampaigns: number; brandCount: number; creatorCount: number };

async function safe<T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.error(`[landing] ${label} failed`, err instanceof Error ? err.message : err);
    return fallback;
  }
}

const loadLanding = unstable_cache(
  async () => {
    const [campaigns, brands, creators, stats] = await Promise.all([
      safe("campaigns", () => listMarketplaceCampaigns({ sort: "trending", limit: 4 }), []),
      safe("brands", () => listPublicBrands({ limit: 8 }), []),
      safe("creators", () => listPublicCreators({ limit: 4 }), []),
      safe<LandingStats | null>(
        "stats",
        async () => {
          const [activeCampaigns, brandCount, creatorCount] = await Promise.all([
            prisma.campaign.count({ where: { status: "ACTIVE" } }),
            prisma.brand.count({ where: { status: "ACTIVE" } }),
            prisma.creatorProfile.count({ where: { user: { status: "APPROVED" } } }),
          ]);
          return { activeCampaigns, brandCount, creatorCount };
        },
        null,
      ),
    ]);
    return { campaigns, brands, creators, stats };
  },
  ["landing-data"],
  { revalidate: LANDING_REVALIDATE_SECONDS, tags: [LANDING_CACHE_TAG] },
);

export function getLandingData() {
  return loadLanding();
}

// The marketplace QR only depends on the deployment origin: render it once per process.
let qrPromise: Promise<string | null> | null = null;
export function getMarketplaceQr(): Promise<string | null> {
  qrPromise ??= safe("qr", () => QRCode.toDataURL(`${appOrigin()}/campaigns`, { margin: 1, width: 128, color: { dark: "#1e1b4b", light: "#ffffff" } }), null);
  return qrPromise;
}
