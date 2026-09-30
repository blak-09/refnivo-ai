import Link from "next/link";
import type { Metadata } from "next";
import { InfoIcon, SearchIcon, StoreIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { EmptyState } from "@/components/dashboard/primitives";
import { ProgramTypeBadge } from "@/components/affiliate/program-badge";
import { ProgramCard } from "@/components/affiliate/program-card";
import { listPublishedPrograms, programFacets, PROGRAMS_PAGE_SIZE, type ProgramFilters } from "@/lib/services/affiliate-programs";
import { PROGRAM_TYPE_LABEL } from "@/lib/validation/affiliate";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Discover Affiliate Programs",
  description: "Official affiliate, creator and ambassador programmes from D2C brands and e-commerce platforms — verified, with commission and eligibility as each programme states them.",
};

type Search = { q?: string; category?: string; type?: string; sort?: string; page?: string };

const SORTS: [string, string][] = [
  ["featured", "Featured"],
  ["recent", "Recently verified"],
  ["az", "A–Z"],
  ["category", "Category"],
];

/**
 * Public marketplace of external affiliate programmes — only listings an admin
 * published. Refnivo lists and links to each official programme; it is not a
 * partner of these brands unless a listing says so.
 */
export default async function AffiliateProgramsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const filters: ProgramFilters = { q: sp.q, category: sp.category, type: sp.type, sort: sp.sort, page };
  const [{ programs, total }, facets] = await Promise.all([listPublishedPrograms(filters), programFacets()]);
  const hasFilters = !!(sp.q || sp.category || sp.type);

  const href = (over: Partial<Search>) => {
    const p = new URLSearchParams();
    const merged = { q: sp.q, category: sp.category, type: sp.type, sort: sp.sort, ...over };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, String(v));
    return `/affiliate-programs${p.toString() ? `?${p}` : ""}`;
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="max-w-3xl">
        <ProgramTypeBadge type="EXTERNAL" />
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Discover affiliate programs</h1>
        <p className="mt-2 text-muted-foreground">
          Official affiliate, creator and ambassador programmes from brands and online stores. Apply on each brand&apos;s own programme page, then share and track your
          links with Refnivo.
        </p>
        <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
          <InfoIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Refnivo lists these programmes so creators can find them. Unless a listing says otherwise, Refnivo is not partnered with the brand — approval, commission and
          payment are handled by each programme.
        </p>
      </div>

      {/* Remounted per query so the inputs pick up the new defaults after client navigation. */}
      <form key={`${sp.q ?? ""}|${sp.category ?? ""}|${sp.type ?? ""}|${sp.sort ?? ""}`} className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto_auto_auto]" role="search">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input name="q" defaultValue={sp.q} placeholder="Search brand, category or program type…" aria-label="Search programmes" className="pl-9" />
        </div>
        <NativeSelect name="category" defaultValue={sp.category ?? ""} aria-label="Category">
          <option value="">All categories</option>
          {facets.categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="type" defaultValue={sp.type ?? ""} aria-label="Program type">
          <option value="">All program types</option>
          {facets.types.map((t) => (
            <option key={t} value={t}>
              {PROGRAM_TYPE_LABEL[t]}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="sort" defaultValue={sp.sort ?? "featured"} aria-label="Sort by">
          {SORTS.map(([value, label]) => (
            <option key={value} value={value}>
              Sort: {label}
            </option>
          ))}
        </NativeSelect>
        <Button type="submit">Search</Button>
      </form>

      <nav className="-mx-4 mt-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" aria-label="Categories">
        {[undefined, ...facets.categories].map((c) => (
          <Link
            key={c ?? "all"}
            href={href({ category: c, page: undefined })}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors",
              (sp.category ?? undefined) === c ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted",
            )}
          >
            {c ?? "All"}
          </Link>
        ))}
      </nav>

      <p className="mt-5 text-sm text-muted-foreground" aria-live="polite">
        {total} {total === 1 ? "program" : "programs"}
        {hasFilters ? " match" : " · all active"}
        {hasFilters ? (
          <>
            {" · "}
            <Link href="/affiliate-programs" className="font-medium text-primary hover:underline">
              Clear filters
            </Link>
          </>
        ) : null}
      </p>

      {!programs.length ? (
        <div className="mt-6">
          <EmptyState
            icon={StoreIcon}
            title={hasFilters ? "No programmes match" : "No affiliate programmes listed yet"}
            description={hasFilters ? "Try a different search, category or program type." : "Programmes appear here once they are verified. Browse Refnivo campaigns meanwhile."}
            action={
              <Button size="sm" variant="outline" nativeButton={false} render={<Link href={hasFilters ? "/affiliate-programs" : "/campaigns"} />}>
                {hasFilters ? "Show all programmes" : "Browse Refnivo campaigns"}
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {programs.map((p) => (
              <li key={p.id}>
                <ProgramCard program={p} />
              </li>
            ))}
          </ul>
          {programs.length < total ? (
            <div className="mt-8 flex flex-col items-center gap-2">
              <Button variant="outline" nativeButton={false} render={<Link href={href({ page: String(page + 1) })} scroll={false} />}>
                Load more
              </Button>
              <p className="text-xs text-muted-foreground">
                Showing {programs.length} of {total}
              </p>
            </div>
          ) : total > PROGRAMS_PAGE_SIZE ? (
            <p className="mt-8 text-center text-xs text-muted-foreground">All {total} programmes shown</p>
          ) : null}
        </>
      )}
    </div>
  );
}
