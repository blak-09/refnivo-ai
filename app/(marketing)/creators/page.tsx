import Link from "next/link";
import type { Metadata } from "next";
import { BadgeCheckIcon, MapPinIcon, SearchIcon, UsersIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { EmptyState } from "@/components/dashboard/primitives";
import { ProductThumb } from "@/components/products/product-thumb";
import { compact, SelfReported } from "@/components/creators/creator-stats";
import { listPublicCreators } from "@/lib/services/creators";
import { CREATOR_CATEGORIES } from "@/lib/utils/labels";

export const metadata: Metadata = {
  title: "Discover creators",
  description: "Browse creators for your affiliate campaigns — categories, audience size and engagement.",
};

export default async function CreatorsPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string }> }) {
  const sp = await searchParams;
  const creators = await listPublicCreators({ q: sp.q || undefined, category: sp.category || undefined });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="max-w-2xl">
        <p className="text-sm font-semibold text-primary">Creators</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Discover creators</h1>
        <p className="mt-2 text-muted-foreground">
          Find creators to promote your products. Open a profile to review their audience and content before you approve an application.
          Audience figures are self-reported by creators.
        </p>
      </div>

      <form className="mt-6 grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-[1fr_220px_auto]" method="get">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={sp.q ?? ""} placeholder="Search by name, username or niche" className="pl-9" />
        </div>
        <NativeSelect name="category" defaultValue={sp.category ?? ""}>
          <option value="">All categories</option>
          {CREATOR_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </NativeSelect>
        <Button type="submit">Filter</Button>
      </form>

      {!creators.length ? (
        <EmptyState
          className="mt-6"
          icon={UsersIcon}
          title={sp.q || sp.category ? "No creators match" : "No creators yet"}
          description={sp.q || sp.category ? "Try a different search or category." : "Creators appear here once they complete their public profile."}
        />
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {creators.map((c) => (
            <Card key={c.username} size="sm" className="transition-shadow hover:shadow-md">
              <CardContent className="space-y-3">
                <div className="flex items-start gap-3">
                  <ProductThumb src={c.profileImageUrl} name={c.displayName} className="size-14 rounded-full" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <Link href={`/creators/${c.username}`} className="truncate font-semibold hover:underline">
                        {c.displayName}
                      </Link>
                      {c.verificationStatus === "VERIFIED" ? <BadgeCheckIcon className="size-4 shrink-0 text-primary" aria-label="Verified" /> : null}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">@{c.username}</p>
                    {c.category ? <Badge variant="secondary" className="mt-1">{c.category}</Badge> : null}
                  </div>
                </div>
                {c.bio ? <p className="line-clamp-2 text-sm text-muted-foreground">{c.bio}</p> : null}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {c.instagramFollowers ? <span>{compact(c.instagramFollowers)} IG followers</span> : null}
                  {c.youtubeSubscribers ? <span>{compact(c.youtubeSubscribers)} YT subs</span> : null}
                  {c.engagementRate ? <span>{c.engagementRate}% engagement</span> : null}
                  {c.location ? (
                    <span className="inline-flex items-center gap-1">
                      <MapPinIcon className="size-3" /> {c.location}
                    </span>
                  ) : null}
                </div>
                {c.instagramFollowers || c.youtubeSubscribers || c.engagementRate ? <SelfReported /> : null}
                <Button variant="outline" size="sm" className="w-full" nativeButton={false} render={<Link href={`/creators/${c.username}`} />}>
                  View profile
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
