import Link from "next/link";
import type { Metadata } from "next";
import { CompassIcon, SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { EmptyState } from "@/components/dashboard/primitives";
import { CampaignCard } from "@/components/marketplace/campaign-card";
import { listMarketplaceCampaigns, type MarketplaceSort } from "@/lib/services/campaigns";
import { prisma } from "@/lib/db/prisma";
import { BRAND_INDUSTRIES, PRODUCT_CATEGORIES } from "@/lib/utils/labels";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Discover campaigns", description: "Product campaigns from brands looking for creators and customer referrals." };

const SORTS: { value: MarketplaceSort; label: string }[] = [
  { value: "newest", label: "New campaigns" },
  { value: "commission", label: "Highest commission" },
  { value: "trending", label: "Trending" },
  { value: "ending", label: "Ending soon" },
];
const TYPES = [
  { value: "", label: "Creators & customers" },
  { value: "CREATOR_AFFILIATE", label: "Creator affiliate" },
  { value: "CUSTOMER_REFERRAL", label: "Customer referral" },
  { value: "HYBRID", label: "Both" },
];

type Search = { q?: string; category?: string; industry?: string; type?: string; sort?: string };

export default async function DiscoverCampaignsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const sort = SORTS.some((s) => s.value === sp.sort) ? (sp.sort as MarketplaceSort) : "newest";
  const hasFilters = !!(sp.q || sp.category || sp.industry || sp.type);
  const type = ["CREATOR_AFFILIATE", "CUSTOMER_REFERRAL", "HYBRID"].includes(sp.type ?? "") ? (sp.type as "CREATOR_AFFILIATE" | "CUSTOMER_REFERRAL" | "HYBRID") : undefined;

  const [campaigns, categoriesInUse] = await Promise.all([
    listMarketplaceCampaigns({ q: sp.q || undefined, category: sp.category || undefined, industry: sp.industry || undefined, type, sort }),
    prisma.product.findMany({ where: { status: "ACTIVE", campaigns: { some: { status: "ACTIVE" } } }, select: { category: true }, distinct: ["category"] }),
  ]);
  const categories = PRODUCT_CATEGORIES.filter((c) => categoriesInUse.some((p) => p.category === c));

  const sortHref = (s: MarketplaceSort) => {
    const p = new URLSearchParams();
    if (sp.q) p.set("q", sp.q);
    if (sp.category) p.set("category", sp.category);
    if (sp.industry) p.set("industry", sp.industry);
    if (sp.type) p.set("type", sp.type);
    p.set("sort", s);
    return `/campaigns?${p.toString()}`;
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="max-w-2xl">
        <p className="text-sm font-semibold text-primary">Campaign marketplace</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Discover campaigns</h1>
        <p className="mt-2 text-muted-foreground">
          Product campaigns from brands. Creators earn a commission on every verified order; customers earn a reward for referring friends.
        </p>
      </div>

      <form className="mt-6 grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-[1fr_180px_180px_180px_auto]" method="get">
        <input type="hidden" name="sort" value={sort} />
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={sp.q ?? ""} placeholder="Search products or campaigns" className="pl-9" />
        </div>
        <NativeSelect name="category" defaultValue={sp.category ?? ""}>
          <option value="">All product types</option>
          {(categories.length ? categories : PRODUCT_CATEGORIES).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="industry" defaultValue={sp.industry ?? ""}>
          <option value="">All categories</option>
          {BRAND_INDUSTRIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="type" defaultValue={sp.type ?? ""}>
          {TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </NativeSelect>
        <Button type="submit">Filter</Button>
      </form>

      <div className="mt-4 flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Sort">
        {SORTS.map((s) => (
          <Link key={s.value} href={sortHref(s.value)} role="tab" aria-selected={sort === s.value} className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors", sort === s.value ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted")}>
            {s.label}
          </Link>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">{campaigns.length} live campaign{campaigns.length === 1 ? "" : "s"}</span>
      </div>

      {!campaigns.length ? (
        <EmptyState
          className="mt-6"
          icon={CompassIcon}
          title={sort === "ending" ? "No campaigns are ending soon" : hasFilters ? "No live campaigns match these filters" : "No live campaigns yet"}
          description={
            hasFilters || sort === "ending"
              ? "Try clearing a filter. New campaigns appear here as soon as brands publish them."
              : "Campaigns appear here as soon as brands publish them. Are you a brand? Create your first campaign in minutes."
          }
          action={
            hasFilters || sort === "ending" ? (
              <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/campaigns" />}>
                Clear filters
              </Button>
            ) : (
              <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/auth/register?role=BRAND_OWNER" />}>
                Start as a brand
              </Button>
            )
          }
        />
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {campaigns.map((c) => (
            <CampaignCard key={c.id} c={c} />
          ))}
        </div>
      )}
    </div>
  );
}
