import { formatMoney, formatPercent } from "@/lib/money";
import { listMarketplaceCampaigns, type MarketplaceCampaign } from "./campaigns";
import { listPublishedPrograms, programBrandName, type PublicAffiliateProgram } from "./affiliate-programs";

/**
 * One directory of programmes a creator can promote, from two very different
 * sources that must never be confused:
 *  - REFNIVO campaigns: run on Refnivo end to end (Refnivo tracks the order and
 *    the commission).
 *  - EXTERNAL programmes: the brand's own programme elsewhere — Refnivo only
 *    lists it; approval, tracking and payouts happen on the official programme.
 */
export type DirectoryKind = "REFNIVO" | "EXTERNAL";

export type DirectoryItem =
  | { kind: "REFNIVO"; key: string; brandName: string; category: string; sortDate: number; campaign: MarketplaceCampaign; commission: string }
  | { kind: "EXTERNAL"; key: string; brandName: string; category: string; sortDate: number; program: PublicAffiliateProgram };

/** Campaign product categories mapped onto the directory's categories. */
const PRODUCT_TO_DIRECTORY: Record<string, string> = {
  "Headphones & audio": "Electronics",
  Wearables: "Electronics",
  "Mobile accessories": "Electronics",
  "Laptops & computing": "Electronics",
  Skincare: "Beauty",
  Haircare: "Beauty",
  Makeup: "Beauty",
  Clothing: "Fashion",
  Footwear: "Fashion",
  Supplements: "Fitness",
  "Fitness equipment": "Fitness",
  "Kitchen appliances": "Home",
  "Home decor": "Home",
  "Snacks & beverages": "Food",
  "Books & courses": "Education",
  Subscriptions: "Technology",
};

export function campaignCategory(c: Pick<MarketplaceCampaign, "product">): string {
  return PRODUCT_TO_DIRECTORY[c.product.category ?? ""] ?? "Other";
}

/** What the partner earns on a Refnivo campaign, as configured by the brand. */
export function campaignCommission(c: MarketplaceCampaign): string {
  if (c.campaignType === "CUSTOMER_REFERRAL") return "Customer rewards";
  return c.creatorCommissionType === "PERCENTAGE" ? `${formatPercent(c.creatorCommissionValue)} per sale` : `${formatMoney(c.creatorCommissionValue, c.currency)} per sale`;
}

export type DirectoryFilters = { q?: string; kind?: string; category?: string; type?: string; commission?: string; sort?: string; page?: number };
export const DIRECTORY_PAGE_SIZE = 24;
export const DIRECTORY_SORTS = [
  ["featured", "Featured"],
  ["newest", "Recently added"],
  ["az", "Brand A–Z"],
  ["category", "Category"],
  ["commission", "Commission available"],
] as const;
type DirectorySort = (typeof DIRECTORY_SORTS)[number][0];

/** True when the listing states its commission (Refnivo campaigns always do). Never inferred. */
export function hasPublicCommission(i: DirectoryItem): boolean {
  return i.kind === "REFNIVO" ? i.campaign.campaignType !== "CUSTOMER_REFERRAL" : !!i.program.commissionDescription;
}

/**
 * The merged directory. Refnivo campaigns come from the live-campaign query,
 * external programmes from published listings; both honour the search.
 */
export async function listDirectory(filters: DirectoryFilters = {}, pageSize = DIRECTORY_PAGE_SIZE) {
  const kind: DirectoryKind | undefined = filters.kind === "refnivo" ? "REFNIVO" : filters.kind === "external" ? "EXTERNAL" : undefined;
  const q = filters.q?.trim() || undefined;
  // Both lists are always loaded so every tab shows an accurate count.
  const [campaigns, external] = await Promise.all([listMarketplaceCampaigns({ q, sort: "newest" }), listPublishedPrograms({ q, sort: "featured" }, 2000)]);

  let items: DirectoryItem[] = [
    ...campaigns.map((c) => ({
      kind: "REFNIVO" as const,
      key: `c-${c.id}`,
      brandName: c.brand.name,
      category: campaignCategory(c),
      sortDate: c.publishedAt?.getTime() ?? 0,
      campaign: c,
      commission: campaignCommission(c),
    })),
    ...external.programs.map((p) => ({
      kind: "EXTERNAL" as const,
      key: `p-${p.id}`,
      brandName: programBrandName(p),
      category: p.category ?? "Other",
      sortDate: p.verifiedAt?.getTime() ?? 0,
      program: p,
    })),
  ];

  // Programme types are an external-programme concept; picking one narrows the directory to external listings.
  const types = [...new Set(external.programs.map((p) => p.programType))].sort();
  const type = types.find((t) => t === filters.type);
  if (type) items = items.filter((i) => i.kind === "EXTERNAL" && i.program.programType === type);
  if (filters.commission === "1") items = items.filter(hasPublicCommission);

  // Category chips: what exists for the selected type (before the category filter).
  const categories = [...new Set(items.filter((i) => !kind || i.kind === kind).map((i) => i.category))].sort((a, b) => a.localeCompare(b));
  if (filters.category) items = items.filter((i) => i.category === filters.category);
  // Tab counts honour the search and filters, not the selected tab itself.
  const counts = { all: items.length, refnivo: items.filter((i) => i.kind === "REFNIVO").length, external: items.filter((i) => i.kind === "EXTERNAL").length };
  if (kind) items = items.filter((i) => i.kind === kind);

  const byName = (a: DirectoryItem, b: DirectoryItem) => a.brandName.localeCompare(b.brandName, "en", { sensitivity: "base" });
  const featuredRank = (i: DirectoryItem) => (i.kind === "EXTERNAL" && i.program.featured ? 0 : i.kind === "REFNIVO" ? 1 : 2);
  const sort: DirectorySort = DIRECTORY_SORTS.some(([v]) => v === filters.sort) ? (filters.sort as DirectorySort) : "featured";
  const COMPARE: Record<DirectorySort, (a: DirectoryItem, b: DirectoryItem) => number> = {
    // Featured: pinned programmes, then Refnivo campaigns (natively tracked), then A–Z.
    featured: (a, b) => featuredRank(a) - featuredRank(b) || byName(a, b),
    newest: (a, b) => b.sortDate - a.sortDate || byName(a, b),
    az: byName,
    category: (a, b) => a.category.localeCompare(b.category, "en", { sensitivity: "base" }) || byName(a, b),
    // Listings that state their commission first; nothing is ranked by a guessed rate.
    commission: (a, b) => Number(hasPublicCommission(b)) - Number(hasPublicCommission(a)) || byName(a, b),
  };
  items.sort(COMPARE[sort]);

  const page = Math.min(Math.max(1, Math.floor(filters.page ?? 1)), 50);
  return { items: items.slice(0, page * pageSize), total: items.length, categories, types, counts, kind };
}
