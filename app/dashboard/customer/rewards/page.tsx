import type { Metadata } from "next";
import { GiftIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard, PageHeader } from "@/components/dashboard/primitives";
import { PartnerConversionsTable } from "@/components/links/partner-conversions-table";
import { requireRole } from "@/lib/auth/guards";
import { formatMoney } from "@/lib/money";
import { getPartnerStats } from "@/lib/services/metrics";

export const metadata: Metadata = { title: "Rewards" };

export default async function CustomerRewardsPage() {
  const user = await requireRole("CUSTOMER");
  const stats = await getPartnerStats(user.id);
  return (
    <div className="space-y-6">
      <PageHeader title="Rewards" description="Rewards are created when a friend's order is recorded and become available once the brand verifies it." />
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard label="Pending" value={formatMoney(stats.rewardsPending)} hint="Awaiting brand verification" icon={GiftIcon} />
        <KpiCard label="Available" value={formatMoney(stats.rewardsAvailable)} hint="Ready to redeem" icon={GiftIcon} />
        <KpiCard label="Redeemed" value={formatMoney(stats.rewardsRedeemed)} icon={GiftIcon} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Redeeming rewards</CardTitle>
          <CardDescription>
            Available rewards are paid out or converted to brand vouchers by the Refnivo AI team. Self-service redemption ships in the next release.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {stats.rewardsAvailable > 0 ? `You have ${formatMoney(stats.rewardsAvailable)} available.` : "No rewards available to redeem yet."}
        </CardContent>
      </Card>
      <PartnerConversionsTable userId={user.id} kind="reward" />
    </div>
  );
}
