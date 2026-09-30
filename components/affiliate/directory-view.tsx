import Link from "next/link";
import { SearchIcon, StoreIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { EmptyState } from "@/components/dashboard/primitives";
import { CampaignProgramCard } from "@/components/affiliate/campaign-program-card";
import { ProgramCard } from "@/components/affiliate/program-card";
import { DIRECTORY_SORTS, listDirectory } from "@/lib/services/directory";
import { cn } from "@/lib/utils";

export type DirectorySearch = { q?: string; kind?: string; category?: string; sort?: string; page?: string };

/**
 * The programme directory (Refnivo campaigns + external programmes), shared by
 * the public /affiliate-programs page and the creator's Discover Programs page.
 * All state is in the URL, so filters survive refresh and are shareable.
 */
export async function DirectoryView({ basePath, sp }: { basePath: string; sp: DirectorySearch }) {
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const { items, total, categories, counts, kind } = await listDirectory({ q: sp.q, kind: sp.kind, category: sp.category, sort: sp.sort, page });
  const hasFilters = !!(sp.q || sp.kind || sp.category);

  const href = (over: Partial<DirectorySearch>) => {
    const p = new URLSearchParams();
    const merged = { q: sp.q, kind: sp.kind, category: sp.category, sort: sp.sort, ...over };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, String(v));
    return `${basePath}${p.toString() ? `?${p}` : ""}`;
  };

  const kinds: { value?: string; label: string; count: number }[] = [
    { value: undefined, label: "All", count: counts.all },
    { value: "refnivo", label: "Refnivo Campaigns", count: counts.refnivo },
    { value: "external", label: "External Programs", count: counts.external },
  ];

  return (
    <div>
      <form key={`${sp.q ?? ""}|${sp.sort ?? ""}`} className="grid gap-3 sm:grid-cols-[1fr_auto_auto]" role="search">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input name="q" defaultValue={sp.q} placeholder="Search brands, products or categories…" aria-label="Search programs" className="h-11 pl-9" />
          {sp.kind ? <input type="hidden" name="kind" value={sp.kind} /> : null}
          {sp.category ? <input type="hidden" name="category" value={sp.category} /> : null}
        </div>
        <NativeSelect name="sort" defaultValue={sp.sort ?? "featured"} aria-label="Sort by" className="h-11">
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

      <div className="mt-4 flex flex-col gap-3">
        <div className="-mx-4 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="tablist" aria-label="Program type">
          {kinds.map((k) => {
            const active = (sp.kind ?? undefined) === k.value;
            return (
              <Link
                key={k.label}
                href={href({ kind: k.value, page: undefined })}
                role="tab"
                aria-selected={active}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
                  active ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                {k.label}
                <span className={cn("rounded-full px-1.5 text-[11px] tabular-nums", active ? "bg-white/20" : "bg-muted")}>{k.count}</span>
              </Link>
            );
          })}
        </div>
        <nav className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" aria-label="Categories">
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
      </div>

      <p className="mt-5 text-sm text-muted-foreground" aria-live="polite">
        {total} {total === 1 ? "program" : "programs"}
        {kind === "REFNIVO" ? " · Refnivo campaigns" : kind === "EXTERNAL" ? " · external programs" : ""}
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
          icon={StoreIcon}
          title="No programs found"
          description="Try changing your filters or search terms."
          action={
            hasFilters ? (
              <Button size="sm" variant="outline" nativeButton={false} render={<Link href={basePath} />}>
                Show all programs
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((i) => (
              <li key={i.key}>{i.kind === "REFNIVO" ? <CampaignProgramCard campaign={i.campaign} /> : <ProgramCard program={i.program} />}</li>
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
