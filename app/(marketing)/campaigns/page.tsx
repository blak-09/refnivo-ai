import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { CampaignBrowser } from "@/components/campaigns/campaign-browser";
import { CircleCallout } from "@/components/community/community-ui";
import type { CampaignSearch } from "@/lib/campaigns/filters";

export const metadata: Metadata = { title: "Discover campaigns", description: "Product campaigns from brands looking for creators and customer referrals." };

export default async function DiscoverCampaignsPage({ searchParams }: { searchParams: Promise<CampaignSearch> }) {
  const sp = await searchParams;
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="max-w-2xl">
        <p className="text-sm font-semibold text-primary">Campaign marketplace</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Discover campaigns</h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          Creators earn a commission on every verified order; customers earn a reward for referring friends.
        </p>
      </div>

      <div className="mt-5 sm:mt-6">
        <CampaignBrowser
          basePath="/campaigns"
          sp={sp}
          emptyAction={
            <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/auth/register?role=BRAND_OWNER" />}>
              Start as a brand
            </Button>
          }
        />
      </div>
      <CircleCallout audience="CREATOR" placement="campaigns" className="mt-12" />
    </div>
  );
}
