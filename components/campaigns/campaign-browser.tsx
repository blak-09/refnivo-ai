import Link from "next/link";
import { CompassIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/dashboard/primitives";
import { CampaignCard } from "@/components/marketplace/campaign-card";
import { CampaignFilterBar } from "@/components/campaigns/campaign-filter-bar";
import { prisma } from "@/lib/db/prisma";
import { listMarketplaceCampaigns } from "@/lib/services/campaigns";
import { PAGE_SIZE, SORT_OPTIONS, activeFilterCount, campaignSearchHref, parseCampaignSearch, type CampaignSearch } from "@/lib/campaigns/filters";
import { BRAND_INDUSTRIES, PRODUCT_CATEGORIES } from "@/lib/utils/labels";
import { cn } from "@/lib/utils";

/**
 * Campaign discovery: filter bar, sort chips, results and "Load more". Used by
 * the public marketplace (/campaigns) and the creator's Discover page, so a
 * campaign looks and filters the same wherever it is found.
 */
export async function CampaignBrowser({
  basePath,
  sp,
  emptyAction,
  gridClassName = "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
}: {
  basePath: string;
  sp: CampaignSearch;
  /** Shown when there are no live campaigns at all (not when filters hide them). */
  emptyAction?: React.ReactNode;
  gridClassName?: string;
}) {
  const f = parseCampaignSearch(sp);
  const [campaigns, categoriesInUse] = await Promise.all([
    listMarketplaceCampaigns({
      q: f.q,
      category: f.category,
      industry: f.industry,
      type: f.type,
      approval: f.approval,
      commission: f.commission,
      offer: f.offer,
      sort: f.sort,
    }),
    prisma.product.findMany({ where: { status: "ACTIVE", campaigns: { some: { status: "ACTIVE" } } }, select: { category: true }, distinct: ["category"] }),
  ]);
  const inUse = PRODUCT_CATEGORIES.filter((c) => categoriesInUse.some((p) => p.category === c));
  const categories = inUse.length ? inUse : PRODUCT_CATEGORIES;
  const filtered = activeFilterCount(f) > 0 || !!f.q;
  const shown = campaigns.slice(0, f.page * PAGE_SIZE);

  return (
    <div>
      <CampaignFilterBar basePath={basePath} values={f} categories={categories} industries={BRAND_INDUSTRIES} />

      <div className="mt-3 flex items-center gap-3">
        <nav aria-label="Sort campaigns" className="-mx-4 flex min-w-0 flex-1 gap-1.5 overflow-x-auto px-4 py-1 sm:mx-0 sm:flex-wrap sm:px-0">
          {SORT_OPTIONS.map((s) => {
            const active = f.sort === s.value;
            return (
              <Link
                key={s.value}
                href={campaignSearchHref(basePath, f, { sort: s.value === "newest" ? undefined : s.value })}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "inline-flex min-h-8 shrink-0 items-center rounded-full border px-3 text-xs font-medium whitespace-nowrap transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  active ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted",
                )}
              >
                {s.label}
              </Link>
            );
          })}
        </nav>
        <p className="hidden shrink-0 text-xs text-muted-foreground sm:block" aria-live="polite">
          {campaigns.length} live campaign{campaigns.length === 1 ? "" : "s"}
        </p>
      </div>
      <p className="mt-1 text-xs text-muted-foreground sm:hidden" aria-live="polite">
        {campaigns.length} live campaign{campaigns.length === 1 ? "" : "s"}
      </p>

      {!campaigns.length ? (
        <EmptyState
          className="mt-6"
          icon={CompassIcon}
          title={f.sort === "ending" && !filtered ? "No campaigns are ending soon" : filtered ? "No live campaigns match these filters" : "No live campaigns yet"}
          description={filtered || f.sort === "ending" ? "Try removing a filter. New campaigns appear here as soon as brands publish them." : "Campaigns appear here as soon as brands publish them."}
          action={
            filtered || f.sort === "ending" ? (
              <Button size="sm" variant="outline" nativeButton={false} render={<Link href={basePath} />}>
                Clear filters
              </Button>
            ) : (
              emptyAction
            )
          }
        />
      ) : (
        <>
          <ul className={cn("mt-4 grid gap-4", gridClassName)}>
            {shown.map((c) => (
              <li key={c.id}>
                <CampaignCard c={c} />
              </li>
            ))}
          </ul>
          {shown.length < campaigns.length ? (
            <div className="mt-8 flex flex-col items-center gap-2">
              <Button variant="outline" nativeButton={false} render={<Link href={campaignSearchHref(basePath, f, { page: String(f.page + 1) })} scroll={false} />}>
                Load more
              </Button>
              <p className="text-xs text-muted-foreground">
                Showing {shown.length} of {campaigns.length}
              </p>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
