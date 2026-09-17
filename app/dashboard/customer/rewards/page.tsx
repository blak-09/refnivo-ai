import type { Metadata } from "next";
import { GiftIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard, PageHeader } from "@/components/dashboard/primitives";
import { PartnerConversionsTable } from "@/components/links/partner-conversions-table";
import { PayoutHistory } from "@/components/payouts/payout-history";
import { PayoutRequestButton } from "@/components/payouts/payout-panel";
import { requireRole } from "@/lib/auth/guards";
import { formatMoney } from "@/lib/money";
import { getPartnerStats } from "@/lib/services/metrics";
import { payoutSummary } from "@/lib/services/payouts";

export const metadata: Metadata = { title: "Rewards" };

export default async function CustomerRewardsPage() {
  const user = await requireRole("CUSTOMER");
  const [stats, payout] = await Promise.all([getPartnerStats(user.id), payoutSummary(user.id, "REWARD")]);

  const blockedReason = payout.open
    ? `A redemption of ${formatMoney(payout.open.amount)} is ${payout.open.status.toLowerCase().replace("_", " ")}.`
    : payout.eligible <= 0
      ? "No available rewards to redeem yet."
      : payout.eligible < payout.minimum
        ? `${formatMoney(payout.minimum - payout.eligible)} more in available rewards is needed to reach the ${formatMoney(payout.minimum)} minimum.`
        : null;

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
          <CardTitle>Redeem rewards</CardTitle>
          <CardDescription>
            Available rewards are settled manually by the Refnivo AI team as a payout or brand voucher. Submit a request once your available balance reaches{" "}
            {formatMoney(payout.minimum)}; the team reviews it and records the settlement reference here.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm">
            Available now: <span className="font-semibold tabular-nums">{formatMoney(payout.eligible)}</span>
            <span className="text-muted-foreground"> across {payout.eligibleCount} reward{payout.eligibleCount === 1 ? "" : "s"}</span>
          </p>
          <PayoutRequestButton kind="REWARD" canRequest={payout.canRequest} reason={blockedReason} />
          <PayoutHistory rows={payout.history} />
        </CardContent>
      </Card>
      <PartnerConversionsTable userId={user.id} kind="reward" />
    </div>
  );
}
