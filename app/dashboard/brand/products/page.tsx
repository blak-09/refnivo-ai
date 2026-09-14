import Link from "next/link";
import type { Metadata } from "next";
import type { ProductStatus } from "@prisma/client";
import { ExternalLinkIcon, PackageIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, PageHeader, StatusBadge } from "@/components/dashboard/primitives";
import { ProductThumb } from "@/components/products/product-thumb";
import { requireBrand } from "@/lib/auth/guards";
import { formatMoney } from "@/lib/money";
import { listBrandProducts } from "@/lib/services/products";
import { PRODUCT_STATUS_LABEL } from "@/lib/utils/labels";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Products" };

const FILTERS: { value: ProductStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "ACTIVE", label: "Active" },
  { value: "DRAFT", label: "Drafts" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "ARCHIVED", label: "Archived" },
];

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { brand } = await requireBrand();
  const { status } = await searchParams;
  const filter = FILTERS.some((f) => f.value === status) ? (status as ProductStatus | "ALL") : "ALL";
  const products = await listBrandProducts(brand.id, filter === "ALL" ? undefined : filter);
  const visible = filter === "ALL" ? products.filter((p) => p.status !== "ARCHIVED") : products;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products"
        description="Products you sell online. Each campaign promotes exactly one product."
        actions={
          <Button nativeButton={false} render={<Link href="/dashboard/brand/products/new" />}>
            <PlusIcon /> Add product
          </Button>
        }
      />

      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter by status">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={f.value === "ALL" ? "/dashboard/brand/products" : `/dashboard/brand/products?status=${f.value}`}
            role="tab"
            aria-selected={filter === f.value}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              filter === f.value ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted",
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {!visible.length ? (
        <EmptyState
          icon={PackageIcon}
          title={filter === "ALL" ? "No products yet" : `No ${PRODUCT_STATUS_LABEL[filter]?.toLowerCase()} products`}
          description="Add the product you want creators and customers to promote — name, image, price and the purchase link on your store."
          action={
            filter === "ALL" ? (
              <Button size="sm" nativeButton={false} render={<Link href="/dashboard/brand/products/new" />}>
                Add your first product
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((p) => (
            <Card key={p.id} size="sm">
              <CardContent className="flex gap-3">
                <ProductThumb src={p.imageUrl} name={p.name} className="size-16" />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/dashboard/brand/products/${p.id}`} className="truncate text-sm font-semibold hover:underline">
                      {p.name}
                    </Link>
                    <StatusBadge status={p.status} label={PRODUCT_STATUS_LABEL[p.status]} />
                  </div>
                  <p className="text-sm">{formatMoney(p.price, p.currency)}</p>
                  <p className="text-xs text-muted-foreground">
                    {[p.category, p.sku ? `SKU ${p.sku}` : null].filter(Boolean).join(" · ") || "No category"} · {p._count.campaigns} campaign{p._count.campaigns === 1 ? "" : "s"}
                  </p>
                  <a href={p.purchaseUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                    Store page <ExternalLinkIcon className="size-3" />
                  </a>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
