import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BadgeCheckIcon, ExternalLinkIcon, GlobeIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { BrandLogo, ProductThumb } from "@/components/products/product-thumb";
import { shortCommission, shortReward } from "@/components/campaigns/campaign-summary";
import { formatMoney } from "@/lib/money";
import { getPublicBrand } from "@/lib/services/brands";
import { formatDate } from "@/lib/utils/dates";
import { VERIFICATION_LABEL } from "@/lib/utils/labels";
import type { BrandSocialLinks } from "@/lib/validation/brand";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const b = await getPublicBrand(slug);
  return { title: b?.name ?? "Brand" };
}

const SOCIAL_LABEL: Record<string, string> = { instagram: "Instagram", youtube: "YouTube", twitter: "X", facebook: "Facebook", linkedin: "LinkedIn" };

export default async function BrandProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const brand = await getPublicBrand(slug);
  if (!brand) notFound();
  const social = (brand.socialLinks ?? {}) as BrandSocialLinks;

  return (
    <div>
      <div className="h-40 bg-gradient-to-r from-accent to-muted sm:h-56" style={brand.coverImageUrl ? { backgroundImage: `url(${brand.coverImageUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined} />
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="-mt-10 flex flex-col gap-4 sm:flex-row sm:items-end">
          <BrandLogo src={brand.logoUrl} name={brand.name} className="size-24 rounded-2xl border-4 border-background text-2xl shadow-sm" />
          <div className="flex-1 pb-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{brand.name}</h1>
              <Badge variant="outline" className={brand.verificationStatus === "VERIFIED" ? "gap-1 border-primary/30 text-primary" : "text-muted-foreground"}>
                {brand.verificationStatus === "VERIFIED" ? <BadgeCheckIcon className="size-3" /> : null}
                {VERIFICATION_LABEL[brand.verificationStatus]}
              </Badge>
            </div>
            {brand.tagline ? <p className="text-muted-foreground">{brand.tagline}</p> : null}
          </div>
        </div>

        <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_300px]">
          <div className="space-y-8">
            {brand.description ? <p className="whitespace-pre-line text-sm text-muted-foreground">{brand.description}</p> : null}

            <section>
              <h2 className="text-lg font-semibold">Active campaigns ({brand._count.campaigns})</h2>
              {!brand.campaigns.length ? (
                <p className="mt-2 text-sm text-muted-foreground">No live campaigns right now.</p>
              ) : (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {brand.campaigns.map((c) => (
                    <Card key={c.id} size="sm">
                      <CardContent className="flex gap-3">
                        <ProductThumb src={c.product.imageUrl} name={c.product.name} className="size-16" />
                        <div className="min-w-0 flex-1">
                          <Link href={`/campaigns/${c.slug}`} className="block truncate text-sm font-semibold hover:underline">
                            {c.product.name}
                          </Link>
                          <p className="truncate text-xs text-muted-foreground">{c.name}</p>
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {c.campaignType !== "CUSTOMER_REFERRAL" ? <Badge>Creators {shortCommission(c)}</Badge> : null}
                            {c.campaignType !== "CREATOR_AFFILIATE" ? <Badge variant="secondary">Customers {shortReward(c)}</Badge> : null}
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {c._count.partnerApplications} creators{c.endDate ? ` · ends ${formatDate(c.endDate)}` : ""}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2 className="text-lg font-semibold">Products ({brand._count.products})</h2>
              {!brand.products.length ? (
                <p className="mt-2 text-sm text-muted-foreground">No products listed yet.</p>
              ) : (
                <div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {brand.products.map((p) => (
                    <Link key={p.id} href={`/products/${p.slug}`} className="group rounded-xl border p-2 transition-colors hover:bg-muted/40">
                      <ProductThumb src={p.imageUrl} name={p.name} className="aspect-square w-full" />
                      <p className="mt-2 truncate text-sm font-medium group-hover:underline">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{formatMoney(p.price, p.currency)}</p>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>

          <aside className="space-y-4">
            <Card size="sm">
              <CardContent className="space-y-2 text-sm">
                <p className="font-medium">About</p>
                {brand.industry ? <p className="text-muted-foreground">{brand.industry}</p> : null}
                <p className="text-muted-foreground">{brand.country}</p>
                {brand.website ? (
                  <a href={brand.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                    <GlobeIcon className="size-3.5" /> {brand.website.replace(/^https?:\/\//, "")} <ExternalLinkIcon className="size-3" />
                  </a>
                ) : null}
                {Object.entries(social).filter(([, v]) => v).length ? (
                  <ul className="space-y-1 pt-1">
                    {Object.entries(social).map(([k, v]) =>
                      v ? (
                        <li key={k}>
                          <a href={v} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                            {SOCIAL_LABEL[k] ?? k} <ExternalLinkIcon className="size-3" />
                          </a>
                        </li>
                      ) : null,
                    )}
                  </ul>
                ) : null}
                <p className="pt-1 text-xs text-muted-foreground">On Refnivo AI since {formatDate(brand.createdAt)}</p>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </div>
  );
}
