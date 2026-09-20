import Link from "next/link";
import { canViewAudienceNumbers } from "@/lib/auth/viewer";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BadgeCheckIcon, MapPinIcon, MessageCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/dashboard/primitives";
import { SelfReported } from "@/components/creators/creator-stats";
import {
  ContentSamples,
  CreatorSocialLinks,
  CreatorStatTiles,
  CreatorTagChips,
  creatorSocialLinks,
  parseContentSamples,
} from "@/components/creators/creator-profile-sections";
import { ShareProfileButton } from "@/components/creators/share-profile-button";
import { BrandLogo, ProductThumb } from "@/components/products/product-thumb";
import { getPublicCreator } from "@/lib/services/creators";
import { formatDate } from "@/lib/utils/dates";

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  const c = await getPublicCreator(username);
  return { title: c ? `${c.displayName} (@${c.username})` : "Creator" };
}

export default async function CreatorProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const showNumbers = await canViewAudienceNumbers();
  const { username } = await params;
  const creator = await getPublicCreator(username);
  if (!creator) notFound();

  const socials = creatorSocialLinks(creator);
  const primarySocial = socials[0] ?? null;
  const samples = parseContentSamples(creator.contentSamples);
  const tagline = [creator.category, creator.audienceCategory].filter(Boolean).join(" | ");
  const verified = creator.verificationStatus === "VERIFIED";

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-10 sm:px-6">
      {/* Header */}
      <Card className="rounded-2xl border-indigo-100/80 shadow-sm">
        <CardContent className="flex flex-col gap-6 md:flex-row md:items-start">
          <ProductThumb
            src={creator.profileImageUrl}
            name={creator.displayName}
            className="size-28 shrink-0 rounded-full border-0 bg-linear-to-br from-violet-100 to-blue-100 ring-4 ring-indigo-50"
          />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{creator.displayName}</h1>
              {verified ? <BadgeCheckIcon className="size-5 fill-indigo-600 text-white" aria-label="Verified creator" /> : null}
            </div>
            <p className="text-sm text-muted-foreground">@{creator.username}</p>
            {tagline ? <p className="text-sm font-medium text-foreground">{tagline}</p> : null}
            {creator.location ? (
              <p className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                <MapPinIcon className="size-3.5" aria-hidden /> {creator.location}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row md:w-44 md:flex-col">
            {primarySocial ? (
              <Button
                nativeButton={false}
                render={<a href={primarySocial.url} target="_blank" rel="noreferrer" />}
                className="bg-linear-to-r from-violet-600 to-blue-500 text-white shadow-md shadow-indigo-500/25 hover:shadow-lg"
              >
                <MessageCircleIcon /> Message on {primarySocial.label.split(" ")[0]}
              </Button>
            ) : (
              <Button nativeButton={false} render={<Link href="/campaigns" />}>
                Browse campaigns
              </Button>
            )}
            <ShareProfileButton />
          </div>
        </CardContent>
      </Card>

      {/* Audience numbers — brands and admins only (self-reported; never shown to customers). */}
      {showNumbers ? (
        <CreatorStatTiles profile={creator} />
      ) : (
        <p className="rounded-xl border border-dashed bg-muted/30 px-4 py-3 text-sm text-muted-foreground">Audience figures are shared with brands reviewing applications.</p>
      )}

      {/* Tags */}
      <CreatorTagChips tags={[creator.category, creator.audienceCategory, creator.audienceLocation]} />

      {/* About + content samples */}
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card className="rounded-2xl border-indigo-100/80 shadow-sm">
          <CardHeader>
            <CardTitle>About</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="text-sm leading-relaxed text-foreground">{creator.bio ?? "This creator has not written a bio yet."}</p>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">Social Links</p>
              <CreatorSocialLinks links={socials} />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-indigo-100/80 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Content Samples</CardTitle>
            {primarySocial && samples.length ? (
              <a href={primarySocial.url} target="_blank" rel="noreferrer" className="text-xs font-semibold text-indigo-600 hover:underline">
                View More
              </a>
            ) : null}
          </CardHeader>
          <CardContent>
            <ContentSamples samples={samples} />
          </CardContent>
        </Card>
      </div>

      {/* Previous campaigns */}
      <Card className="rounded-2xl border-indigo-100/80 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Previous Campaigns</CardTitle>
          <p className="text-xs text-muted-foreground">
            {creator.verifiedSales} verified order{creator.verifiedSales === 1 ? "" : "s"} on Refnivo
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {creator.campaigns.length ? (
            <ul className="divide-y">
              {creator.campaigns.map((a) => (
                <li key={a.campaign.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <BrandLogo src={a.campaign.brand.logoUrl} name={a.campaign.brand.name} className="size-10 rounded-xl text-xs" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {a.campaign.name} · {a.campaign.brand.name}
                    </p>
                    <p className="flex items-center gap-2 truncate text-xs text-muted-foreground">
                      <StatusBadge status={a.campaign.status} />
                      <span>{a.campaign.product.name}</span>
                      <span>· joined {formatDate(a.createdAt)}</span>
                    </p>
                  </div>
                  <Link href={`/campaigns/${a.campaign.slug}`} className="shrink-0 text-xs font-semibold text-indigo-600 hover:underline">
                    View Details
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No campaigns on Refnivo yet.</p>
          )}
          {creator.previousCampaigns ? (
            <div className="rounded-xl bg-muted/50 p-3">
              <p className="mb-1 flex items-center gap-2 text-xs font-semibold text-foreground">
                Earlier work <SelfReported />
              </p>
              <p className="text-sm text-muted-foreground">{creator.previousCampaigns}</p>
            </div>
          ) : null}
          <p className="text-xs text-muted-foreground">On Refnivo AI since {formatDate(creator.createdAt)}.</p>
        </CardContent>
      </Card>
    </div>
  );
}
