import Link from "next/link";
import { uploadsAvailable } from "@/lib/storage";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, ExternalLinkIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, StatusBadge } from "@/components/dashboard/primitives";
import { ProductForm } from "@/components/products/product-form";
import { ProductThumb } from "@/components/products/product-thumb";
import { ArchiveProductButton } from "@/components/products/archive-product-button";
import { requireBrand } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { formatMoney } from "@/lib/money";
import { getBrandProduct } from "@/lib/services/products";
import { PRODUCT_STATUS_LABEL } from "@/lib/utils/labels";

export const metadata: Metadata = { title: "Product" };

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { brand } = await requireBrand();
  const { id } = await params;
  const product = await getBrandProduct(brand.id, id);
  if (!product) notFound();

  const campaigns = await prisma.campaign.findMany({
    where: { productId: product.id, brandId: brand.id },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, status: true, _count: { select: { referralClicks: true, referrals: true } } },
  });

  return (
    <div className="space-y-6">
      <Link href="/dashboard/brand/products" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> All products
      </Link>
      <PageHeader
        title={product.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={product.status} label={PRODUCT_STATUS_LABEL[product.status]} />
            <span>{formatMoney(product.price, product.currency)}</span>
            {product.status === "ACTIVE" ? (
              <Link href={`/products/${product.slug}`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                Public page <ExternalLinkIcon className="size-3" />
              </Link>
            ) : null}
          </span>
        }
        actions={
          <>
            {product.status !== "ARCHIVED" ? <ArchiveProductButton productId={product.id} /> : null}
            <Button nativeButton={false} render={<Link href={`/dashboard/brand/campaigns/new?product=${product.id}`} />}>
              <PlusIcon /> Campaign for this product
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader>
            <CardTitle>Product details</CardTitle>
            <CardDescription>Shown on the marketplace and on referral landing pages.</CardDescription>
          </CardHeader>
          <CardContent>
            <ProductForm product={product} uploadsEnabled={uploadsAvailable()} />
          </CardContent>
        </Card>
        <div className="space-y-4">
          <Card size="sm">
            <CardContent className="flex flex-col items-center gap-3">
              <ProductThumb src={product.imageUrl} name={product.name} className="size-40" />
              <a href={product.purchaseUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                Open store page <ExternalLinkIcon className="size-3" />
              </a>
            </CardContent>
          </Card>
          <Card size="sm">
            <CardHeader>
              <CardTitle>Campaigns</CardTitle>
            </CardHeader>
            <CardContent>
              {!campaigns.length ? (
                <p className="text-sm text-muted-foreground">No campaigns promote this product yet.</p>
              ) : (
                <ul className="divide-y">
                  {campaigns.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <Link href={`/dashboard/brand/campaigns/${c.id}`} className="block truncate text-sm font-medium hover:underline">
                          {c.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {c._count.referralClicks} clicks · {c._count.referrals} referrals
                        </p>
                      </div>
                      <StatusBadge status={c.status} />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
