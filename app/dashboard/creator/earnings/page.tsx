import type { Metadata } from "next";
import { BadgeIndianRupeeIcon, WalletIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard, PageHeader } from "@/components/dashboard/primitives";
import { PartnerConversionsTable } from "@/components/links/partner-conversions-table";
import { requireCreator } from "@/lib/auth/guards";
import { formatMoney } from "@/lib/money";
import { getPartnerStats } from "@/lib/services/metrics";

export const metadata: Metadata = { title: "Earnings" };

export default async function CreatorEarningsPage() {
  const { user } = await requireCreator();
  const stats = await getPartnerStats(user.id);
  const minimum = Number(process.env.PAYOUT_MINIMUM_AMOUNT ?? 50000);
  return (
    <div className="space-y-6">
      <PageHeader title="Earnings" description="Your commission ledger across all campaigns." />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total earnings" value={formatMoney(stats.commissionPending + stats.commissionApproved + stats.commissionPaid)} icon={BadgeIndianRupeeIcon} />
        <KpiCard label="Pending" value={formatMoney(stats.commissionPending)} hint="Awaiting brand verification" icon={WalletIcon} />
        <KpiCard label="Approved" value={formatMoney(stats.commissionApproved)} hint="Eligible for payout" icon={WalletIcon} />
        <KpiCard label="Paid" value={formatMoney(stats.commissionPaid)} icon={WalletIcon} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Payouts</CardTitle>
          <CardDescription>
            Payout requests open once your approved commission reaches {formatMoney(minimum)}. Payouts are processed manually by the Refnivo AI team — there is no automatic UPI transfer in this version.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {stats.commissionApproved >= minimum
            ? "You have reached the payout threshold. The payout request flow ships in the next release."
            : `${formatMoney(Math.max(0, minimum - stats.commissionApproved))} more in approved commission needed to request a payout.`}
        </CardContent>
      </Card>
      <PartnerConversionsTable userId={user.id} kind="commission" />
    </div>
  );
}
