import type { MetadataRoute } from "next";
import { listPublishedPrograms } from "@/lib/services/affiliate-programs";
import { listPublicBrands } from "@/lib/services/brands";
import { listMarketplaceCampaigns } from "@/lib/services/campaigns";
import { appOrigin } from "@/lib/services/links";

/** Regenerated hourly, so new programmes, campaigns and brands appear without a deploy. */
export const revalidate = 3600;

const STATIC_PAGES: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
  { path: "/", priority: 1, changeFrequency: "daily" },
  { path: "/affiliate-programs", priority: 0.9, changeFrequency: "daily" },
  { path: "/campaigns", priority: 0.8, changeFrequency: "daily" },
  { path: "/brands", priority: 0.7, changeFrequency: "weekly" },
  { path: "/creators", priority: 0.6, changeFrequency: "weekly" },
  { path: "/products", priority: 0.6, changeFrequency: "weekly" },
  { path: "/how-it-works", priority: 0.6, changeFrequency: "monthly" },
  { path: "/pricing", priority: 0.6, changeFrequency: "monthly" },
  { path: "/about", priority: 0.4, changeFrequency: "monthly" },
  { path: "/team", priority: 0.3, changeFrequency: "monthly" },
  { path: "/contact", priority: 0.3, changeFrequency: "yearly" },
  { path: "/community", priority: 0.7, changeFrequency: "monthly" },
  { path: "/privacy", priority: 0.2, changeFrequency: "yearly" },
  { path: "/refund-policy", priority: 0.2, changeFrequency: "yearly" },
  { path: "/terms", priority: 0.2, changeFrequency: "yearly" },
];

/**
 * Public pages only — dashboards, auth and API routes are excluded (and
 * disallowed in robots.ts). If the database is unreachable the static pages are
 * still served, so a blip never produces an empty sitemap.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = appOrigin();
  const now = new Date();
  const entries: MetadataRoute.Sitemap = STATIC_PAGES.map((p) => ({ url: `${origin}${p.path}`, lastModified: now, changeFrequency: p.changeFrequency, priority: p.priority }));

  const [programs, campaigns, brands] = await Promise.allSettled([listPublishedPrograms({ sort: "az" }, 2000), listMarketplaceCampaigns({ sort: "newest" }), listPublicBrands()]);

  if (programs.status === "fulfilled") {
    for (const p of programs.value.programs) {
      entries.push({ url: `${origin}/affiliate-programs/${p.slug}`, lastModified: p.verifiedAt ?? now, changeFrequency: "weekly", priority: 0.7 });
    }
  }
  if (campaigns.status === "fulfilled") {
    for (const c of campaigns.value) {
      entries.push({ url: `${origin}/campaigns/${c.slug}`, lastModified: c.publishedAt ?? now, changeFrequency: "daily", priority: 0.8 });
    }
  }
  if (brands.status === "fulfilled") {
    for (const b of brands.value) {
      if (b.slug) entries.push({ url: `${origin}/brands/${b.slug}`, lastModified: now, changeFrequency: "weekly", priority: 0.5 });
    }
  }
  return entries;
}
