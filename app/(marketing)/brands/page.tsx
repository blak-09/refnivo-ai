import Link from "next/link";
import type { Metadata } from "next";
import { BadgeCheckIcon, SearchIcon, StoreIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { EmptyState } from "@/components/dashboard/primitives";
import { BrandLogo } from "@/components/products/product-thumb";
import { listPublicBrands } from "@/lib/services/brands";
import { BRAND_INDUSTRIES } from "@/lib/utils/labels";

export const metadata: Metadata = { title: "Discover brands" };

export default async function BrandsPage({ searchParams }: { searchParams: Promise<{ q?: string; industry?: string }> }) {
  const sp = await searchParams;
  const brands = await listPublicBrands({ q: sp.q || undefined, industry: sp.industry || undefined });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="max-w-2xl">
        <p className="text-sm font-semibold text-primary">Brands</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Discover brands</h1>
        <p className="mt-2 text-muted-foreground">Brands running affiliate and referral campaigns on Refnivo AI.</p>
      </div>

      <form className="mt-6 grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-[1fr_220px_auto]" method="get">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={sp.q ?? ""} placeholder="Search brands" className="pl-9" />
        </div>
        <NativeSelect name="industry" defaultValue={sp.industry ?? ""}>
          <option value="">All industries</option>
          {BRAND_INDUSTRIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </NativeSelect>
        <Button type="submit">Filter</Button>
      </form>

      {!brands.length ? (
        <EmptyState className="mt-6" icon={StoreIcon} title="No brands match" description="Try a different search or industry." />
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {brands.map((b) => (
            <Card key={b.id} size="sm" className="transition-shadow hover:shadow-md">
              <CardContent className="flex gap-3">
                <BrandLogo src={b.logoUrl} name={b.name} className="size-14" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <Link href={`/brands/${b.slug}`} className="truncate text-sm font-semibold hover:underline">
                      {b.name}
                    </Link>
                    {b.verificationStatus === "VERIFIED" ? <BadgeCheckIcon className="size-4 text-primary" aria-label="Verified brand" /> : null}
                  </div>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{b.tagline ?? b.description ?? b.industry ?? ""}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {b._count.products} product{b._count.products === 1 ? "" : "s"} · {b._count.campaigns} active campaign{b._count.campaigns === 1 ? "" : "s"}
                    {b.industry ? ` · ${b.industry}` : ""}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
