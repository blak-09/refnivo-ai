import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/primitives";
import { PartnerLinksList } from "@/components/links/partner-links-list";
import { ChannelLinkPicker } from "@/components/links/channel-link-picker";
import { SourcePerformanceTable } from "@/components/links/source-performance";
import { requireCreator } from "@/lib/auth/guards";
import { partnerCampaignsForLinks, partnerSourcePerformance } from "@/lib/services/channel-links";

export const metadata: Metadata = { title: "Referral links & QR" };

export default async function CreatorLinksPage() {
  const { user } = await requireCreator();
  const [campaigns, performance] = await Promise.all([partnerCampaignsForLinks(user.id), partnerSourcePerformance(user.id)]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Referral links & QR codes"
        description="One link per campaign, plus a separate link for each platform you share on. Every click, scan and sale is tracked against the exact link that produced it."
        actions={<ChannelLinkPicker campaigns={campaigns} />}
      />
      <PartnerLinksList userId={user.id} emptyDescription="Links are issued when a brand approves your application (or instantly for campaigns without approval)." />
      <SourcePerformanceTable
        rows={performance}
        title="Performance by channel"
        description="Only platforms you have a link for appear here. A sale counts for a platform when it came through that platform's link."
      />
    </div>
  );
}
