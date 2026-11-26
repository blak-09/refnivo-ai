import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/primitives";
import { CampaignBrowser } from "@/components/campaigns/campaign-browser";
import { requireCreator } from "@/lib/auth/guards";
import type { CampaignSearch } from "@/lib/campaigns/filters";

export const metadata: Metadata = { title: "Discover campaigns" };

/** Creator → Discover: live Refnivo campaigns a creator can join and promote (same filters and cards as /campaigns). */
export default async function CreatorDiscoverPage({ searchParams }: { searchParams: Promise<CampaignSearch> }) {
  await requireCreator();
  const sp = await searchParams;
  return (
    <div className="space-y-6">
      <PageHeader title="Find Brands to Promote" description="Join Refnivo campaigns, share your link and QR code, and earn commission on every verified order." />
      <CampaignBrowser basePath="/dashboard/creator/discover" sp={sp} gridClassName="sm:grid-cols-2 lg:grid-cols-3" />
    </div>
  );
}
