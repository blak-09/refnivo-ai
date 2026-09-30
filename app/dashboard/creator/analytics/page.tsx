import Link from "next/link";
import type { Metadata } from "next";
import { BarChart3Icon, MousePointerClickIcon, PercentIcon, ReceiptIcon, WalletIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, KpiCard, PageHeader } from "@/components/dashboard/primitives";
import { PerformanceChart, RevenueSeriesChart } from "@/components/charts/lazy-charts";
import { RangeTabs } from "@/components/dashboard/range-tabs";
import { requireCreator } from "@/lib/auth/guards";
import { formatMoney } from "@/lib/money";
import { getPartnerCampaignPerformance, getPartnerSeries, getPartnerStats, parseRange, RANGE_OPTIONS } from "@/lib/services/metrics";

export const metadata: Metadata = { title: "Analytics" };

/**
 * Creator analytics: clicks on your links, verified conversions, the revenue
 * they brought brands and your commission — from recorded data only.
 */
export default async function CreatorAnalyticsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const { user } = await requireCreator();
  const days = parseRange((await searchParams).range);
  const rangeLabel = RANGE_OPTIONS.find((o) => Number(o.value) === days)?.label ?? `${days} days`;
  const [stats, series, campaigns] = await Promise.all([getPartnerStats(user.id), getPartnerSeries(user.id, days), getPartnerCampaignPerformance(user.id)]);
  const periodClicks = series.reduce((s, d) => s + d.clicks, 0);
  const periodConversions = series.reduce((s, d) => s + d.conversions, 0);
  const periodRevenue = series.reduce((s, d) => s + d.revenue, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" description="How your referral links perform. Revenue and commission count verified orders only." actions={<RangeTabs basePath="/dashboard/creator/analytics" days={days} />} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label={`Clicks · ${rangeLabel}`} value={periodClicks.toLocaleString("en-IN")} icon={MousePointerClickIcon} hint={`${stats.clicks.toLocaleString("en-IN")} all time`} />
        <KpiCard label={`Conversions · ${rangeLabel}`} value={periodConversions.toLocaleString("en-IN")} icon={ReceiptIcon} hint={`${stats.verified.toLocaleString("en-IN")} verified all time`} />
        <KpiCard label="Conversion rate" value={stats.conversionRate === null ? "—" : `${(stats.conversionRate * 100).toFixed(1)}%`} icon={PercentIcon} hint={stats.conversionRate === null ? "No clicks yet" : "Verified ÷ clicks, all time"} />
        <KpiCard label="Commission" value={formatMoney(stats.commissionApproved + stats.commissionPaid)} icon={WalletIcon} hint={`${formatMoney(stats.commissionPending)} pending`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Clicks & conversions</CardTitle>
            <CardDescription>{rangeLabel}</CardDescription>
          </CardHeader>
          <CardContent>
            <PerformanceChart data={series} emptyMessage="No clicks or conversions in this period yet — share your links to get started." />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Revenue generated</CardTitle>
            <CardDescription>
              {rangeLabel} · {formatMoney(periodRevenue)} in verified orders
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RevenueSeriesChart data={series} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>By campaign</CardTitle>
          <CardDescription>All time, highest revenue first.</CardDescription>
        </CardHeader>
        <CardContent>
          {!campaigns.length ? (
            <EmptyState
              icon={BarChart3Icon}
              title="No campaign activity yet"
              description="Join a campaign and share your link — performance shows up here."
              action={
                <Button size="sm" nativeButton={false} render={<Link href="/dashboard/creator/discover" />}>
                  Discover programs
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign</TableHead>
                    <TableHead className="text-right">Clicks</TableHead>
                    <TableHead className="text-right">Conversions</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Commission</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns.map((c) => (
                    <TableRow key={c.campaignId}>
                      <TableCell className="max-w-64">
                        <Link href={`/campaigns/${c.slug}`} className="block truncate font-medium hover:underline">
                          {c.name}
                        </Link>
                        <span className="block truncate text-xs text-muted-foreground">
                          {c.brand} · {c.product}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{c.clicks.toLocaleString("en-IN")}</TableCell>
                      <TableCell className="text-right tabular-nums">{c.conversions.toLocaleString("en-IN")}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(c.revenue)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(c.commission)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
