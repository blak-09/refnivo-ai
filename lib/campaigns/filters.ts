/**
 * Campaign discovery filters, shared by the public marketplace (/campaigns) and
 * the creator's Discover page. All state lives in the URL, so a filtered view
 * survives refresh and can be shared. Pure: no database access here.
 */

export type MarketplaceSort = "newest" | "commission" | "trending" | "ending";
export type CampaignTypeFilter = "CREATOR_AFFILIATE" | "CUSTOMER_REFERRAL" | "HYBRID";
export type ApprovalFilter = "instant" | "approval";
export type CommissionFilter = "PERCENTAGE" | "FIXED_AMOUNT";

export type CampaignSearch = {
  q?: string;
  category?: string;
  industry?: string;
  type?: string;
  approval?: string;
  commission?: string;
  offer?: string;
  sort?: string;
  page?: string;
};

export type CampaignFilterValues = {
  q?: string;
  category?: string;
  industry?: string;
  type?: CampaignTypeFilter;
  approval?: ApprovalFilter;
  commission?: CommissionFilter;
  offer?: true;
  sort: MarketplaceSort;
  page: number;
};

export const SORT_OPTIONS: { value: MarketplaceSort; label: string }[] = [
  { value: "newest", label: "New campaigns" },
  { value: "commission", label: "Highest commission (est.)" },
  { value: "trending", label: "Trending" },
  { value: "ending", label: "Ending soon" },
];
export const TYPE_OPTIONS: { value: CampaignTypeFilter; label: string }[] = [
  { value: "CREATOR_AFFILIATE", label: "Creators only" },
  { value: "CUSTOMER_REFERRAL", label: "Customers only" },
  { value: "HYBRID", label: "Creators & customers" },
];
export const APPROVAL_OPTIONS: { value: ApprovalFilter; label: string }[] = [
  { value: "instant", label: "Instant link" },
  { value: "approval", label: "Approval needed" },
];
export const COMMISSION_OPTIONS: { value: CommissionFilter; label: string }[] = [
  { value: "PERCENTAGE", label: "Percentage of the order" },
  { value: "FIXED_AMOUNT", label: "Fixed amount per order" },
];

export const PAGE_SIZE = 24;

const pick = <T extends string>(value: string | undefined, options: readonly { value: T }[]): T | undefined =>
  options.some((o) => o.value === value) ? (value as T) : undefined;

/** Normalise raw search params: unknown values are dropped instead of failing. */
export function parseCampaignSearch(sp: CampaignSearch): CampaignFilterValues {
  const q = sp.q?.trim().slice(0, 100) || undefined;
  const page = Math.min(Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1), 50);
  return {
    q,
    category: sp.category?.trim() || undefined,
    industry: sp.industry?.trim() || undefined,
    type: pick(sp.type, TYPE_OPTIONS),
    approval: pick(sp.approval, APPROVAL_OPTIONS),
    commission: pick(sp.commission, COMMISSION_OPTIONS),
    offer: sp.offer === "1" ? true : undefined,
    sort: pick(sp.sort, SORT_OPTIONS) ?? "newest",
    page,
  };
}

/** How many filters (not search or sort) are applied — shown on the phone "Filters" button. */
export function activeFilterCount(f: CampaignFilterValues): number {
  return [f.category, f.industry, f.type, f.approval, f.commission, f.offer].filter(Boolean).length;
}

/** Build a URL for `basePath` with the current filters, overridden by `over` (undefined removes a key). */
export function campaignSearchHref(basePath: string, f: CampaignFilterValues, over: Partial<Record<keyof CampaignSearch, string | undefined>> = {}): string {
  const current: Record<keyof CampaignSearch, string | undefined> = {
    q: f.q,
    category: f.category,
    industry: f.industry,
    type: f.type,
    approval: f.approval,
    commission: f.commission,
    offer: f.offer ? "1" : undefined,
    sort: f.sort === "newest" ? undefined : f.sort,
    page: undefined,
  };
  const merged = { ...current, ...over };
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
  const qs = p.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}
