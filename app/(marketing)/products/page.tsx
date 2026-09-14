import Link from "next/link";
import type { Metadata } from "next";
import { PackageIcon, SearchIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { EmptyState } from "@/components/dashboard/primitives";
import { BrandLogo, ProductThumb } from "@/components/products/product-thumb";
import { shortCommission, shortReward } from "@/components/campaigns/campaign-summary";
import { formatMoney } from "@/lib/money";
import { listPublicProducts } from "@/lib/services/products";
import { PRODUCT_CATEGORIES } from "@/lib/utils/labels";

export const metadata: Metadata = { title: "Discover products" };

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string }> }) {
  const sp = await searchParams;
  const products = await listPublicProducts({ q: sp.q || undefined, category: sp.category || undefined });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="max-w-2xl">
        <p className="text-sm font-semibold text-primary">Products</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Discover products</h1>
        <p className="mt-2 text-muted-foreground">Products listed by brands. Ones with a live campaign show what you can earn by promoting them.</p>
      </div>

      <form className="mt-6 grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-[1fr_220px_auto]" method="get">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={sp.q ?? ""} placeholder="Search products" className="pl-9" />
        </div>
        <NativeSelect name="category" defaultValue={sp.category ?? ""}>
          <option value="">All categories</option>
          {PRODUCT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </NativeSelect>
        <Button type="submit">Filter</Button>
      </form>

      {!products.length ? (
        <EmptyState className="mt-6" icon={PackageIcon} title="No products match" description="Try a different search or category." />
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((p) => {
            const c = p.campaigns[0];
            return (
              <Card key={p.id} size="sm" className="h-full transition-shadow hover:shadow-md">
                <CardContent className="flex h-full flex-col gap-3">
                  <Link href={`/products/${p.slug}`}>
                    <ProductThumb src={p.imageUrl} name={p.name} className="aspect-[4/3] w-full" />
                  </Link>
                  <div className="flex items-center gap-2">
                    <BrandLogo src={p.brand.logoUrl} name={p.brand.name} className="size-6 text-[10px]" />
                    <Link href={`/brands/${p.brand.slug}`} className="truncate text-xs text-muted-foreground hover:text-foreground">
                      {p.brand.name}
                    </Link>
                  </div>
                  <div>
                    <Link href={`/products/${p.slug}`} className="line-clamp-2 text-sm font-semibold hover:underline">
                      {p.name}
                    </Link>
                    <p className="text-sm font-medium">{formatMoney(p.price, p.currency)}</p>
                    {p.category ? <p className="text-xs text-muted-foreground">{p.category}</p> : null}
                  </div>
                  <div className="mt-auto">
                    {c ? (
                      <div className="flex flex-wrap gap-1">
                        <Badge>Earn {shortCommission(c)}</Badge>
                        <Badge variant="secondary">Refer for {shortReward(c)}</Badge>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">No live campaign</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
