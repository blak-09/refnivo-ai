import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BadgeCheckIcon, ShoppingBagIcon, UsersIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BrandLogo, ProductThumb } from "@/components/products/product-thumb";
import { describeCreatorCommission, describeCustomerReward, describeDuration } from "@/components/campaigns/campaign-summary";
import { formatMoney } from "@/lib/money";
import { getPublicProduct } from "@/lib/services/products";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = await getPublicProduct(slug);
  return { title: p ? `${p.name} · ${p.brand.name}` : "Product" };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getPublicProduct(slug);
  if (!product) notFound();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="grid gap-8 lg:grid-cols-2">
        <ProductThumb src={product.imageUrl} name={product.name} className="aspect-square w-full rounded-2xl" />
        <div className="space-y-5">
          <div className="flex items-center gap-2">
            <BrandLogo src={product.brand.logoUrl} name={product.brand.name} className="size-8 text-xs" />
            <Link href={`/brands/${product.brand.slug}`} className="text-sm font-medium hover:underline">
              {product.brand.name}
            </Link>
            {product.brand.verificationStatus === "VERIFIED" ? <BadgeCheckIcon className="size-4 text-primary" aria-label="Verified brand" /> : null}
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{product.name}</h1>
            <p className="mt-1 text-xl font-medium">{formatMoney(product.price, product.currency)}</p>
            {product.category ? <Badge variant="secondary" className="mt-2">{product.category}</Badge> : null}
          </div>
          {product.description ? <p className="whitespace-pre-line text-sm text-muted-foreground">{product.description}</p> : null}
          <Button nativeButton={false} render={<a href={product.purchaseUrl} target="_blank" rel="noreferrer" />}>
            <ShoppingBagIcon /> Buy on {product.brand.name}
          </Button>

          <section className="space-y-3 pt-2">
            <h2 className="text-base font-semibold">Promote this product</h2>
            {!product.campaigns.length ? (
              <p className="text-sm text-muted-foreground">No live campaign for this product right now.</p>
            ) : (
              product.campaigns.map((c) => (
                <Card key={c.id} size="sm">
                  <CardContent className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Link href={`/campaigns/${c.slug}`} className="text-sm font-semibold hover:underline">
                        {c.name}
                      </Link>
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <UsersIcon className="size-3.5" /> {c._count.partnerApplications}
                      </span>
                    </div>
                    <ul className="text-sm text-muted-foreground">
                      {c.campaignType !== "CUSTOMER_REFERRAL" ? <li>Creators: {describeCreatorCommission(c)}</li> : null}
                      {c.campaignType !== "CREATOR_AFFILIATE" ? <li>Customers: {describeCustomerReward(c)}</li> : null}
                      <li>{describeDuration(c)}</li>
                    </ul>
                    <Button size="sm" nativeButton={false} render={<Link href={`/campaigns/${c.slug}`} />}>
                      View campaign & get link
                    </Button>
                  </CardContent>
                </Card>
              ))
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
