import type { Metadata } from "next";
import { BadgeIndianRupeeIcon, WalletIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard, PageHeader } from "@/components/dashboard/primitives";
import { PartnerConversionsTable } from "@/components/links/partner-conversions-table";
import { PayoutHistory } from "@/components/payouts/payout-history";
import { PayoutRequestButton } from "@/components/payouts/payout-panel";
import { requireCreator } from "@/lib/auth/guards";
import { formatMoney } from "@/lib/money";
import { getPartnerStats } from "@/lib/services/metrics";
import { payoutSummary } from "@/lib/services/payouts";

export const metadata: Metadata = { title: "Earnings" };

export default async function CreatorEarningsPage() {
  const { user } = await requireCreator();
  const [stats, payout] = await Promise.all([getPartnerStats(user.id), payoutSummary(user.id, "COMMISSION")]);

  const blockedReason = payout.open
    ? `A request for ${formatMoney(payout.open.amount)} is ${payout.open.status.toLowerCase().replace("_", " ")}.`
    : payout.eligible <= 0
      ? "No approved commission is waiting for settlement."
      : payout.eligible < payout.minimum
        ? `${formatMoney(payout.minimum - payout.eligible)} more in approved commission is needed to reach the ${formatMoney(payout.minimum)} minimum.`
        : null;

  return (
    <div className="space-y-6">
      <PageHeader title="Earnings" description="Your commission ledger across all campaigns. Commissions are approved when the brand verifies the order." />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total earned" value={formatMoney(stats.commissionPending + stats.commissionApproved + stats.commissionPaid)} icon={BadgeIndianRupeeIcon} />
        <KpiCard label="Pending" value={formatMoney(stats.commissionPending)} hint="Awaiting brand verification" icon={WalletIcon} />
        <KpiCard label="Approved" value={formatMoney(stats.commissionApproved)} hint="Eligible for settlement" icon={WalletIcon} />
        <KpiCard label="Paid" value={formatMoney(stats.commissionPaid)} icon={WalletIcon} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Payouts</CardTitle>
          <CardDescription>
            Payouts are settled manually by the Refnivo AI team — there is no automatic transfer. Request a payout once your approved commission reaches{" "}
            {formatMoney(payout.minimum)}; the team reviews it, settles it to your chosen method and records the reference here.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm">
            Eligible now: <span className="font-semibold tabular-nums">{formatMoney(payout.eligible)}</span>
            <span className="text-muted-foreground"> across {payout.eligibleCount} approved commission{payout.eligibleCount === 1 ? "" : "s"}</span>
          </p>
          <PayoutRequestButton kind="COMMISSION" canRequest={payout.canRequest} reason={blockedReason} />
          <PayoutHistory rows={payout.history} />
        </CardContent>
      </Card>
      <PartnerConversionsTable userId={user.id} kind="commission" />
    </div>
  );
}
