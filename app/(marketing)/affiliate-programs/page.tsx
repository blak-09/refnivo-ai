import Link from "next/link";
import type { Metadata } from "next";
import { ExternalLinkIcon, SearchIcon, StoreIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { EmptyState } from "@/components/dashboard/primitives";
import { BrandLogo } from "@/components/products/product-thumb";
import { APPROVAL_LABEL, ProgramTypeBadge, VerifiedProgramMark } from "@/components/affiliate/program-badge";
import { listPublishedPrograms, programBrandName, programFacets } from "@/lib/services/affiliate-programs";
import { AFFILIATE_CATEGORIES } from "@/lib/validation/affiliate";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Discover Affiliate Programs",
  description: "Find brands' existing affiliate programmes, join them on the brand's own platform, and track your promotion with Refnivo links.",
};

type Search = { q?: string; category?: string; network?: string; approval?: string; platform?: string };

/**
 * Public marketplace of external affiliate programmes — only listings an admin
 * approved. Each card is explicit that the programme is run by the brand
 * elsewhere, and a commission appears only as the brand's own description.
 */
export default async function AffiliateProgramsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const [programs, facets] = await Promise.all([listPublishedPrograms(sp), programFacets()]);
  const hasFilters = !!(sp.q || sp.category || sp.network || sp.approval || sp.platform);
  const categoryHref = (c?: string) => {
    const p = new URLSearchParams();
    if (sp.q) p.set("q", sp.q);
    if (c) p.set("category", c);
    return `/affiliate-programs${p.toString() ? `?${p}` : ""}`;
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="max-w-2xl">
        <ProgramTypeBadge type="EXTERNAL" />
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Discover affiliate programs</h1>
        <p className="mt-2 text-muted-foreground">
          Find brands you can promote and earn from. You join each programme on the brand&apos;s own platform — Refnivo helps you find it, share trackable links and see
          your clicks.
        </p>
      </div>

      <form className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]" role="search">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input name="q" defaultValue={sp.q} placeholder="Search brands or programmes…" aria-label="Search" className="pl-9" />
          {sp.category ? <input type="hidden" name="category" value={sp.category} /> : null}
        </div>
        <NativeSelect name="network" defaultValue={sp.network ?? ""} aria-label="Affiliate network">
          <option value="">Any network</option>
          {facets.networks.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="approval" defaultValue={sp.approval ?? ""} aria-label="Approval">
          <option value="">Any approval</option>
          <option value="AUTOMATIC">Automatic approval</option>
          <option value="APPLICATION">Application required</option>
          <option value="INVITE_ONLY">Invite only</option>
        </NativeSelect>
        <Button type="submit">Search</Button>
      </form>

      <nav className="mt-4 flex flex-wrap gap-1.5" aria-label="Categories">
        {[undefined, ...AFFILIATE_CATEGORIES].map((c) => (
          <Link
            key={c ?? "all"}
            href={categoryHref(c)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              (sp.category ?? undefined) === c ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted",
            )}
          >
            {c ?? "All"}
          </Link>
        ))}
      </nav>

      {!programs.length ? (
        <div className="mt-8">
          <EmptyState
            icon={StoreIcon}
            title={hasFilters ? "No programmes match" : "No affiliate programmes listed yet"}
            description={
              hasFilters ? "Try a different search or category." : "Brands are starting to list the affiliate programmes they already run. Check back soon — or browse Refnivo campaigns."
            }
            action={
              <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/campaigns" />}>
                Browse Refnivo campaigns
              </Button>
            }
          />
        </div>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {programs.map((p) => {
            const brandName = programBrandName(p);
            return (
            <li key={p.id}>
              <Card className="h-full rounded-2xl transition-shadow hover:shadow-md">
                <CardContent className="flex h-full flex-col gap-3">
                  <div className="flex items-start gap-3">
                    <BrandLogo src={p.logoUrl ?? p.brand?.logoUrl} name={brandName} className="size-12 rounded-xl" sizes="48px" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{brandName}</p>
                      <p className="truncate text-xs text-muted-foreground">{p.category ?? p.brand?.industry ?? "Affiliate programme"}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <ProgramTypeBadge type="EXTERNAL" />
                    <VerifiedProgramMark verifiedAt={p.verifiedAt} />
                  </div>
                  <p className="text-sm font-medium">{p.name}</p>
                  {p.description ? <p className="line-clamp-2 text-xs text-muted-foreground">{p.description}</p> : null}
                  <dl className="grid flex-1 gap-1 text-xs">
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">Commission</dt>
                      {/* The brand's own statement — never a Refnivo promise. */}
                      <dd className="text-right font-medium">{p.commissionDescription ?? "Set by the programme"}</dd>
                    </div>
                    {p.approvalType ? (
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted-foreground">Joining</dt>
                        <dd className="text-right">{APPROVAL_LABEL[p.approvalType]}</dd>
                      </div>
                    ) : null}
                    {p.networkName ? (
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted-foreground">Network</dt>
                        <dd className="text-right">{p.networkName}</dd>
                      </div>
                    ) : null}
                  </dl>
                  {!p.brand ? <p className="text-[11px] text-muted-foreground">Listed by Refnivo from public information · {brandName} is not a Refnivo partner</p> : null}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button size="sm" variant="outline" className="flex-1 justify-center" nativeButton={false} render={<Link href={`/affiliate-programs/${p.slug}`} />}>
                      View program
                    </Button>
                    <Button size="sm" className="flex-1 justify-center" nativeButton={false} render={<a href={p.signupUrl} target="_blank" rel="noreferrer noopener" aria-label={`Join ${p.name} on the programme's site (opens in a new tab)`} />}>
                      Join affiliate program <ExternalLinkIcon className="size-3.5" aria-hidden />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
