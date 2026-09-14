import Link from "next/link";
import type { Metadata } from "next";
import { CompassIcon, GiftIcon, LinkIcon, MousePointerClickIcon, ShoppingCartIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard, PageHeader } from "@/components/dashboard/primitives";
import { PartnerLinksList } from "@/components/links/partner-links-list";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { formatMoney } from "@/lib/money";
import { getPartnerStats } from "@/lib/services/metrics";

export const metadata: Metadata = { title: "My rewards" };

export default async function CustomerOverviewPage() {
  const user = await requireRole("CUSTOMER");
  const [stats, links] = await Promise.all([getPartnerStats(user.id), prisma.referralLink.count({ where: { ownerId: user.id, status: "ACTIVE" } })]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Hi ${user.name.split(" ")[0]}`}
        description="Share products you like. When a friend buys through your link, you earn the reward."
        actions={
          <Button nativeButton={false} render={<Link href="/campaigns" />}>
            <CompassIcon /> Discover products
          </Button>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="My links" value={links} icon={LinkIcon} />
        <KpiCard label="Clicks on my links" value={stats.clicks} hint={`${stats.qrScans} via QR`} icon={MousePointerClickIcon} />
        <KpiCard label="Successful purchases" value={stats.verified} hint={`${stats.purchased} awaiting verification`} icon={ShoppingCartIcon} />
        <KpiCard label="Rewards earned" value={formatMoney(stats.rewardsPending + stats.rewardsAvailable + stats.rewardsRedeemed)} hint={`${formatMoney(stats.rewardsAvailable)} available`} icon={GiftIcon} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>My referral links</CardTitle>
        </CardHeader>
        <CardContent>
          <PartnerLinksList userId={user.id} emptyDescription="Open any campaign and tap “Join & generate my referral link” — you get a link and QR code instantly." />
        </CardContent>
      </Card>
    </div>
  );
}
