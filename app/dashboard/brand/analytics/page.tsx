import Link from "next/link";
import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { KpiCard, PageHeader, StatusBadge } from "@/components/dashboard/primitives";
import { CostByCampaignChart, FunnelChart, PartnerSplitChart, PerformanceChart, ReferralsOverTimeChart, RevenueByCampaignChart, RevenueSeriesChart } from "@/components/charts/lazy-charts";
import { RangeTabs } from "@/components/dashboard/range-tabs";
import { ProductThumb } from "@/components/products/product-thumb";
import { requireBrand } from "@/lib/auth/guards";
import { formatMoney } from "@/lib/money";
import { getBrandOverview, getBrandSeries, getCampaignBreakdown, getPartnerTypeSplit, getReferralsOverTime, getTopCreators, getTopProducts, parseRange, RANGE_OPTIONS } from "@/lib/services/metrics";
import { brandSourcePerformance } from "@/lib/services/channel-links";
import { SourcePerformanceTable } from "@/components/links/source-performance";

export const metadata: Metadata = { title: "Analytics" };

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const { brand } = await requireBrand();
  const days = parseRange((await searchParams).range);
  const rangeLabel = RANGE_OPTIONS.find((o) => Number(o.value) === days)?.label ?? `${days} days`;
  const [overview, breakdown, series, split, topCreators, topProducts, sources, performance] = await Promise.all([
    getBrandOverview(brand.id),
    getCampaignBreakdown(brand.id),
    getReferralsOverTime(brand.id, days),
    getPartnerTypeSplit(brand.id),
    getTopCreators(brand.id, 10),
    getTopProducts(brand.id, 10),
    brandSourcePerformance(brand.id),
    getBrandSeries(brand.id, days),
  ]);
  const periodClicks = performance.reduce((s, d) => s + d.clicks, 0);
  const periodConversions = performance.reduce((s, d) => s + d.conversions, 0);
  const periodRevenue = performance.reduce((s, d) => s + d.revenue, 0);
  const totalCost = overview.approvedRewardCost + overview.approvedCommissionCost;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="All figures are computed from recorded clicks, orders and verified conversions — nothing is estimated."
        actions={<RangeTabs basePath="/dashboard/brand/analytics" days={days} />}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Clicks & conversions</CardTitle>
            <CardDescription>
              {rangeLabel} · {periodClicks.toLocaleString("en-IN")} clicks · {periodConversions.toLocaleString("en-IN")} verified conversions
              {periodClicks ? ` · ${((periodConversions / periodClicks) * 100).toFixed(1)}% conversion rate` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PerformanceChart data={performance} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Revenue</CardTitle>
            <CardDescription>
              {rangeLabel} · {formatMoney(periodRevenue)} verified
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RevenueSeriesChart data={performance} />
          </CardContent>
        </Card>
      </div>

      <h2 className="text-sm font-semibold text-muted-foreground">All time</h2>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Campaigns" value={overview.totalCampaigns} hint={`${overview.activeCampaigns} active`} />
        <KpiCard label="Products" value={overview.totalProducts} />
        <KpiCard label="Creators" value={overview.totalCreators} hint="Approved partners" />
        <KpiCard label="Customers" value={overview.totalCustomers} hint="Referral partners" />
        <KpiCard label="Clicks" value={overview.totalClicks} hint={`${overview.qrScans} QR scans`} />
        <KpiCard label="Orders" value={overview.totalOrders} hint={`${overview.verifiedConversions} verified · ${overview.pendingVerification} pending`} />
        <KpiCard label="Conversion rate" value={overview.conversionRate === null ? "—" : `${(overview.conversionRate * 100).toFixed(1)}%`} hint={overview.conversionRate === null ? "No clicks recorded yet" : "Verified orders ÷ clicks"} />
        <KpiCard label="Revenue" value={formatMoney(overview.revenue)} hint="Verified orders" />
        <KpiCard label="Commissions" value={formatMoney(overview.approvedCommissionCost)} hint={`${formatMoney(overview.pendingCommissions)} pending`} />
        <KpiCard label="Customer rewards" value={formatMoney(overview.approvedRewardCost)} hint={`${formatMoney(overview.pendingRewards)} pending`} />
        <KpiCard label="Partner cost share" value={totalCost > 0 && overview.revenue > 0 ? `${Math.round((totalCost / overview.revenue) * 100)}%` : "—"} hint="Approved cost ÷ revenue" />
        <KpiCard label="Return on partner spend" value={overview.roi === null ? "—" : `${overview.roi.toFixed(1)}×`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SourcePerformanceTable
          rows={sources}
          title="Traffic sources"
          description="Which channels your partners actually sell through. A sale counts for a channel only when it came through that channel's referral link."
        />

        <Card>
          <CardHeader>
            <CardTitle>Referrals over time</CardTitle>
            <CardDescription>{rangeLabel}</CardDescription>
          </CardHeader>
          <CardContent>
            <ReferralsOverTimeChart data={series} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Creator vs customer referrals</CardTitle>
            <CardDescription>All time</CardDescription>
          </CardHeader>
          <CardContent>
            <PartnerSplitChart creator={split.creator} customer={split.customer} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Revenue by campaign</CardTitle>
          </CardHeader>
          <CardContent>
            <RevenueByCampaignChart data={breakdown} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Commission & reward cost</CardTitle>
            <CardDescription>Approved entries by campaign</CardDescription>
          </CardHeader>
          <CardContent>
            <CostByCampaignChart data={breakdown} />
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Conversion funnel</CardTitle>
          </CardHeader>
          <CardContent>
            <FunnelChart
              steps={[
                { label: "Link & QR clicks", value: overview.totalClicks },
                { label: "Referral sessions", value: overview.totalReferrals },
                { label: "Orders recorded", value: overview.totalOrders },
                { label: "Verified conversions", value: overview.verifiedConversions },
              ]}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top creators</CardTitle>
            <CardDescription>By attributed revenue</CardDescription>
          </CardHeader>
          <CardContent>
            {!topCreators.length ? (
              <p className="text-sm text-muted-foreground">No creator activity yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Creator</TableHead>
                    <TableHead className="text-right">Clicks</TableHead>
                    <TableHead className="text-right">Orders</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Commission</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topCreators.map((c) => (
                    <TableRow key={c.userId}>
                      <TableCell>
                        {c.username ? (
                          <Link href={`/creators/${c.username}`} className="font-medium hover:underline">
                            {c.name}
                          </Link>
                        ) : (
                          c.name
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{c.clicks}</TableCell>
                      <TableCell className="text-right tabular-nums">{c.verified}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(c.revenue)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(c.commission)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Best-performing products</CardTitle>
            <CardDescription>By attributed revenue</CardDescription>
          </CardHeader>
          <CardContent>
            {!topProducts.length ? (
              <p className="text-sm text-muted-foreground">No products yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Campaigns</TableHead>
                    <TableHead className="text-right">Clicks</TableHead>
                    <TableHead className="text-right">Orders</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topProducts.map((p) => (
                    <TableRow key={p.productId}>
                      <TableCell>
                        <Link href={`/dashboard/brand/products/${p.productId}`} className="flex items-center gap-2 font-medium hover:underline">
                          <ProductThumb src={p.imageUrl} name={p.name} className="size-7" />
                          {p.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{p.campaigns}</TableCell>
                      <TableCell className="text-right tabular-nums">{p.clicks}</TableCell>
                      <TableCell className="text-right tabular-nums">{p.verified}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(p.revenue)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Campaign breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {!breakdown.length ? (
            <p className="text-sm text-muted-foreground">No campaigns yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Clicks</TableHead>
                    <TableHead className="text-right">Referrals</TableHead>
                    <TableHead className="text-right">Verified</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Commissions</TableHead>
                    <TableHead className="text-right">Rewards</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {breakdown.map((b) => (
                    <TableRow key={b.campaignId}>
                      <TableCell>
                        <Link href={`/dashboard/brand/campaigns/${b.campaignId}`} className="font-medium hover:underline">
                          {b.name}
                        </Link>
                        <span className="block text-xs text-muted-foreground">{b.productName}</span>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={b.status} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{b.clicks}</TableCell>
                      <TableCell className="text-right tabular-nums">{b.referrals}</TableCell>
                      <TableCell className="text-right tabular-nums">{b.verified}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(b.revenue)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(b.commissionCost)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(b.rewardCost)}</TableCell>
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
