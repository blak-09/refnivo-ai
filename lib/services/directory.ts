import { formatMoney, formatPercent } from "@/lib/money";
import { listMarketplaceCampaigns, type MarketplaceCampaign } from "./campaigns";

/**
 * The creator's campaign directory (Discover): live Refnivo campaigns — run on
 * Refnivo end to end, so Refnivo issues the link, tracks the order and records
 * the commission — with search, category chips and sorting.
 */
export type DirectoryItem = { key: string; brandName: string; category: string; sortDate: number; campaign: MarketplaceCampaign; commission: string };

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

export type DirectoryFilters = { q?: string; category?: string; sort?: string; page?: number };
export const DIRECTORY_PAGE_SIZE = 24;
export const DIRECTORY_SORTS = [
  ["newest", "Recently added"],
  ["az", "Brand A–Z"],
  ["category", "Category"],
] as const;
type DirectorySort = (typeof DIRECTORY_SORTS)[number][0];

/** Live Refnivo campaigns, searched, filtered by category, sorted and paged ("load more"). */
export async function listDirectory(filters: DirectoryFilters = {}, pageSize = DIRECTORY_PAGE_SIZE) {
  const q = filters.q?.trim() || undefined;
  const campaigns = await listMarketplaceCampaigns({ q, sort: "newest" });

  let items: DirectoryItem[] = campaigns.map((c) => ({
    key: `c-${c.id}`,
    brandName: c.brand.name,
    category: campaignCategory(c),
    sortDate: c.publishedAt?.getTime() ?? 0,
    campaign: c,
    commission: campaignCommission(c),
  }));

  // Category chips: every category that has a campaign for this search (before the category filter).
  const categories = [...new Set(items.map((i) => i.category))].sort((a, b) => a.localeCompare(b));
  if (filters.category) items = items.filter((i) => i.category === filters.category);

  const byName = (a: DirectoryItem, b: DirectoryItem) => a.brandName.localeCompare(b.brandName, "en", { sensitivity: "base" });
  const sort: DirectorySort = DIRECTORY_SORTS.some(([v]) => v === filters.sort) ? (filters.sort as DirectorySort) : "newest";
  const COMPARE: Record<DirectorySort, (a: DirectoryItem, b: DirectoryItem) => number> = {
    newest: (a, b) => b.sortDate - a.sortDate || byName(a, b),
    az: byName,
    category: (a, b) => a.category.localeCompare(b.category, "en", { sensitivity: "base" }) || byName(a, b),
  };
  items.sort(COMPARE[sort]);

  const page = Math.min(Math.max(1, Math.floor(filters.page ?? 1)), 50);
  return { items: items.slice(0, page * pageSize), total: items.length, categories };
}
