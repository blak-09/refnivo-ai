import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/primitives";
import { CampaignDirectory, type DirectorySearch } from "@/components/campaigns/campaign-directory";
import { requireCreator } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Discover campaigns" };

/** Creator → Discover: live Refnivo campaigns a creator can join and promote. */
export default async function CreatorDiscoverPage({ searchParams }: { searchParams: Promise<DirectorySearch> }) {
  await requireCreator();
  const sp = await searchParams;
  return (
    <div className="space-y-6">
      <PageHeader title="Find Brands to Promote" description="Join Refnivo campaigns, share your link and QR code, and earn commission on every verified order." />
      <CampaignDirectory basePath="/dashboard/creator/discover" sp={sp} />
    </div>
  );
}
