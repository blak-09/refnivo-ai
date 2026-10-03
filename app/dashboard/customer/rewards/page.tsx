import type { Metadata } from "next";
import { GiftIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard, PageHeader } from "@/components/dashboard/primitives";
import { PartnerConversionsTable } from "@/components/links/partner-conversions-table";
import { PayoutHistory } from "@/components/payouts/payout-history";
import { PayoutAccountsManager } from "@/components/payouts/payout-accounts";
import { PayoutRequestButton } from "@/components/payouts/payout-panel";
import { requireRole } from "@/lib/auth/guards";
import { formatMoney } from "@/lib/money";
import { getPartnerStats } from "@/lib/services/metrics";
import { autoPayoutsEnabled } from "@/lib/services/auto-payouts";
import { listPayoutAccounts, MAX_PAYOUT_ACCOUNTS, payoutAccountsEnabled } from "@/lib/services/payout-accounts";
import { payoutSummary } from "@/lib/services/payouts";

export const metadata: Metadata = { title: "Rewards" };

export default async function CustomerRewardsPage() {
  const user = await requireRole("CUSTOMER");
  const accountsOn = payoutAccountsEnabled();
  const [stats, payout, accounts] = await Promise.all([getPartnerStats(user.id), payoutSummary(user.id, "REWARD"), accountsOn ? listPayoutAccounts(user.id) : Promise.resolve([])]);
  const automatic = autoPayoutsEnabled();

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
            Submit a request once your available balance reaches {formatMoney(payout.minimum)}. The Refnivo AI team reviews it,{" "}
            {automatic ? "then sends it to your saved UPI ID or bank account (or issues a brand voucher)" : "settles it as a payout or brand voucher"} and records the reference here.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm">
            Available now: <span className="font-semibold tabular-nums">{formatMoney(payout.eligible)}</span>
            <span className="text-muted-foreground"> across {payout.eligibleCount} reward{payout.eligibleCount === 1 ? "" : "s"}</span>
          </p>
          <PayoutRequestButton kind="REWARD" canRequest={payout.canRequest} reason={blockedReason} accounts={accounts} />
          <PayoutHistory rows={payout.history} />
        </CardContent>
      </Card>
      {accountsOn ? (
        <Card>
          <CardHeader>
            <CardTitle>Payout accounts</CardTitle>
            <CardDescription>Save the UPI ID or bank account you want to be paid into, then choose it when you request a redemption.</CardDescription>
          </CardHeader>
          <CardContent>
            <PayoutAccountsManager accounts={accounts} max={MAX_PAYOUT_ACCOUNTS} />
          </CardContent>
        </Card>
      ) : null}
      <PartnerConversionsTable userId={user.id} kind="reward" />
    </div>
  );
}
