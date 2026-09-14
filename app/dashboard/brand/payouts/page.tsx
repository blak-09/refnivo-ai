import Link from "next/link";
import type { Metadata } from "next";
import { WalletIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, KpiCard, PageHeader, StatusBadge } from "@/components/dashboard/primitives";
import { requireBrand } from "@/lib/auth/guards";
import { formatMoney } from "@/lib/money";
import { getBrandLedger } from "@/lib/services/ledger";
import { formatDate } from "@/lib/utils/dates";
import { REWARD_TYPE_LABEL } from "@/lib/utils/labels";

export const metadata: Metadata = { title: "Commissions & Rewards" };

export default async function PayoutsPage() {
  const { brand } = await requireBrand();
  const { rewards, commissions, totals } = await getBrandLedger(brand.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Commissions & Rewards"
        description="Everything your brand owes to creators and customers, by status. Entries are created when an order is recorded and approved when you verify it. Payouts are processed by the platform team."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard label="Commissions pending" value={formatMoney(totals.commissionsPending)} hint="Awaiting order verification" />
        <KpiCard label="Commissions approved" value={formatMoney(totals.commissionsApproved)} hint="Payable to creators" />
        <KpiCard label="Commissions paid" value={formatMoney(totals.commissionsPaid)} />
        <KpiCard label="Rewards pending" value={formatMoney(totals.rewardsPending)} hint="Awaiting order verification" />
        <KpiCard label="Rewards available" value={formatMoney(totals.rewardsApproved)} hint="Customers can redeem" />
        <KpiCard label="Rewards redeemed" value={formatMoney(totals.rewardsRedeemed)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Creator commissions</CardTitle>
            <CardDescription>Latest 100 entries</CardDescription>
          </CardHeader>
          <CardContent>
            {!commissions.length ? (
              <EmptyState icon={WalletIcon} title="No commissions yet" description="Commissions are created when you record an order that came through a creator link." />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Creator</TableHead>
                      <TableHead>Campaign</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {commissions.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="whitespace-nowrap">{formatDate(c.createdAt)}</TableCell>
                        <TableCell>{c.creator.creatorProfile?.displayName ?? c.creator.name}</TableCell>
                        <TableCell>
                          <Link href={`/dashboard/brand/campaigns/${c.referral.campaign.id}`} className="hover:underline">
                            {c.referral.campaign.name}
                          </Link>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(c.amount, c.currency)}</TableCell>
                        <TableCell>
                          <StatusBadge status={c.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Customer rewards</CardTitle>
            <CardDescription>Latest 100 entries</CardDescription>
          </CardHeader>
          <CardContent>
            {!rewards.length ? (
              <EmptyState icon={WalletIcon} title="No rewards yet" description="Rewards are created when you record an order that came through a customer's referral link." />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Campaign</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rewards.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="whitespace-nowrap">{formatDate(r.createdAt)}</TableCell>
                        <TableCell>{r.recipient.name}</TableCell>
                        <TableCell>
                          <Link href={`/dashboard/brand/campaigns/${r.referral.campaign.id}`} className="hover:underline">
                            {r.referral.campaign.name}
                          </Link>
                          <span className="block text-xs text-muted-foreground">{REWARD_TYPE_LABEL[r.rewardType]}</span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(r.amount, r.currency)}</TableCell>
                        <TableCell>
                          <StatusBadge status={r.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
