import Link from "next/link";
import { MegaphoneIcon, SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { EmptyState } from "@/components/dashboard/primitives";
import { CampaignDirectoryCard } from "@/components/campaigns/campaign-directory-card";
import { DIRECTORY_SORTS, listDirectory } from "@/lib/services/directory";
import { cn } from "@/lib/utils";

export type DirectorySearch = { q?: string; category?: string; sort?: string; page?: string };

/**
 * The creator's campaign directory (Discover). All state is in the URL, so
 * filters survive refresh and are shareable.
 */
export async function CampaignDirectory({ basePath, sp }: { basePath: string; sp: DirectorySearch }) {
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const { items, total, categories } = await listDirectory({ q: sp.q, category: sp.category, sort: sp.sort, page });
  const hasFilters = !!(sp.q || sp.category);

  const href = (over: Partial<DirectorySearch>) => {
    const p = new URLSearchParams();
    const merged = { q: sp.q, category: sp.category, sort: sp.sort, ...over };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, String(v));
    return `${basePath}${p.toString() ? `?${p}` : ""}`;
  };

  return (
    <div>
      <form key={`${sp.q ?? ""}|${sp.sort ?? ""}`} className="grid gap-3 sm:grid-cols-[1fr_auto_auto]" role="search">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input name="q" defaultValue={sp.q} placeholder="Search brands, products or categories…" aria-label="Search campaigns" className="h-11 pl-9" />
          {sp.category ? <input type="hidden" name="category" value={sp.category} /> : null}
        </div>
        <NativeSelect name="sort" defaultValue={sp.sort ?? "newest"} aria-label="Sort by" className="h-11">
          {DIRECTORY_SORTS.map(([value, label]) => (
            <option key={value} value={value}>
              Sort: {label}
            </option>
          ))}
        </NativeSelect>
        <Button type="submit" className="h-11">
          Search
        </Button>
      </form>

      {categories.length ? (
        <nav className="-mx-4 mt-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" aria-label="Categories">
          {[undefined, ...categories].map((c) => (
            <Link
              key={c ?? "all"}
              href={href({ category: c, page: undefined })}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors",
                (sp.category ?? undefined) === c ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted",
              )}
            >
              {c ?? "All categories"}
            </Link>
          ))}
        </nav>
      ) : null}

      <p className="mt-5 text-sm text-muted-foreground" aria-live="polite">
        {total} {total === 1 ? "campaign" : "campaigns"}
        {hasFilters ? (
          <>
            {" · "}
            <Link href={basePath} className="font-medium text-primary hover:underline">
              Clear filters
            </Link>
          </>
        ) : null}
      </p>

      {!items.length ? (
        <EmptyState
          className="mt-6"
          icon={MegaphoneIcon}
          title={hasFilters ? "No campaigns match" : "No live campaigns yet"}
          description={hasFilters ? "Try changing your filters or search terms." : "New campaigns appear here as soon as brands publish them."}
          action={
            hasFilters ? (
              <Button size="sm" variant="outline" nativeButton={false} render={<Link href={basePath} />}>
                Show all campaigns
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((i) => (
              <li key={i.key}>
                <CampaignDirectoryCard campaign={i.campaign} />
              </li>
            ))}
          </ul>
          {items.length < total ? (
            <div className="mt-8 flex flex-col items-center gap-2">
              <Button variant="outline" nativeButton={false} render={<Link href={href({ page: String(page + 1) })} scroll={false} />}>
                Load more
              </Button>
              <p className="text-xs text-muted-foreground">
                Showing {items.length} of {total}
              </p>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
