import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BadgeCheckIcon, MapPinIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/dashboard/primitives";
import { CreatorAudience, CreatorSocialStats } from "@/components/creators/creator-stats";
import { BrandLogo, ProductThumb } from "@/components/products/product-thumb";
import { getPublicCreator } from "@/lib/services/creators";
import { formatDate } from "@/lib/utils/dates";
import { VERIFICATION_LABEL } from "@/lib/utils/labels";

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  const c = await getPublicCreator(username);
  return { title: c ? `${c.displayName} (@${c.username})` : "Creator" };
}

export default async function CreatorProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const creator = await getPublicCreator(username);
  if (!creator) notFound();

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <ProductThumb src={creator.profileImageUrl} name={creator.displayName} className="size-28 rounded-full" />
        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{creator.displayName}</h1>
            <Badge variant="outline" className={creator.verificationStatus === "VERIFIED" ? "gap-1 border-primary/30 text-primary" : "text-muted-foreground"}>
              {creator.verificationStatus === "VERIFIED" ? <BadgeCheckIcon className="size-3" /> : null}
              {VERIFICATION_LABEL[creator.verificationStatus]}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            @{creator.username}
            {creator.category ? ` · ${creator.category}` : ""}
            {creator.location ? (
              <span className="ml-2 inline-flex items-center gap-1">
                <MapPinIcon className="size-3.5" /> {creator.location}
              </span>
            ) : null}
          </p>
          {creator.bio ? <p className="max-w-2xl text-sm">{creator.bio}</p> : null}
          <CreatorSocialStats profile={creator} />
          <div className="pt-1">
            <Button size="sm" nativeButton={false} render={<Link href="/campaigns" />}>
              Browse campaigns to promote
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Campaigns</CardTitle>
            </CardHeader>
            <CardContent>
              {!creator.campaigns.length ? (
                <p className="text-sm text-muted-foreground">No campaigns on Refnivo AI yet.</p>
              ) : (
                <ul className="divide-y">
                  {creator.campaigns.map((a) => (
                    <li key={a.campaign.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                      <ProductThumb src={a.campaign.product.imageUrl} name={a.campaign.product.name} className="size-10" />
                      <div className="min-w-0 flex-1">
                        <Link href={`/campaigns/${a.campaign.slug}`} className="block truncate text-sm font-medium hover:underline">
                          {a.campaign.product.name}
                        </Link>
                        <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                          <BrandLogo src={a.campaign.brand.logoUrl} name={a.campaign.brand.name} className="size-4 rounded text-[8px]" />
                          {a.campaign.brand.name} · joined {formatDate(a.createdAt)}
                        </p>
                      </div>
                      <StatusBadge status={a.campaign.status} />
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-xs text-muted-foreground">
                {creator.verifiedSales} verified order{creator.verifiedSales === 1 ? "" : "s"} attributed on the platform.
              </p>
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Audience & experience</CardTitle>
          </CardHeader>
          <CardContent>
            <CreatorAudience profile={creator} />
            <p className="mt-4 text-xs text-muted-foreground">Audience figures are self-reported by the creator. On Refnivo AI since {formatDate(creator.createdAt)}.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
