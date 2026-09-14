import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRightIcon,
  BadgeIndianRupeeIcon,
  LightbulbIcon,
  MegaphoneIcon,
  MousePointerClickIcon,
  PackageIcon,
  PlusIcon,
  ShoppingCartIcon,
  TrendingUpIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, KpiCard, PageHeader, StatusBadge } from "@/components/dashboard/primitives";
import { FunnelChart, ReferralsOverTimeChart, RevenueByCampaignChart } from "@/components/charts/charts";
import { ProductThumb } from "@/components/products/product-thumb";
import { requireBrand } from "@/lib/auth/guards";
import { formatMoney } from "@/lib/money";
import { listCampaigns } from "@/lib/services/campaigns";
import { getBrandOverview, getCampaignBreakdown, getReferralsOverTime, getTopCreators } from "@/lib/services/metrics";
import { buildInsight } from "@/lib/domain/insights";

export const metadata: Metadata = { title: "Overview" };

export default async function BrandOverviewPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const { brand } = await requireBrand();
  const { welcome } = await searchParams;

  const [overview, breakdown, series, campaigns, topCreators] = await Promise.all([
    getBrandOverview(brand.id),
    getCampaignBreakdown(brand.id),
    getReferralsOverTime(brand.id, 30),
    listCampaigns(brand.id),
    getTopCreators(brand.id, 5),
  ]);

  const insight = buildInsight(overview, breakdown);
  const recent = campaigns.slice(0, 5);

  return (
    <div className="space-y-8">
      {welcome ? (
        <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          <p className="font-medium">Welcome to Refnivo AI, {brand.name} 🎉</p>
          <p className="text-muted-foreground">
            Next: <Link href="/dashboard/brand/products/new" className="underline underline-offset-4">add a product</Link>, then create a campaign for it.
          </p>
        </div>
      ) : null}

      <PageHeader
        title="Overview"
        description={`How ${brand.name} is growing through creators and customer referrals.`}
        actions={
          <>
            <Button variant="outline" nativeButton={false} render={<Link href="/dashboard/brand/products/new" />}>
              <PackageIcon /> Add product
            </Button>
            <Button nativeButton={false} render={<Link href="/dashboard/brand/campaigns/new" />}>
              <PlusIcon /> New campaign
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Attributed revenue" value={formatMoney(overview.revenue)} hint="From verified orders" icon={BadgeIndianRupeeIcon} />
        <KpiCard label="Verified conversions" value={overview.verifiedConversions} hint={`${overview.pendingVerification} awaiting verification`} icon={ShoppingCartIcon} />
        <KpiCard label="Link clicks" value={overview.totalClicks} hint={`${overview.qrScans} via QR`} icon={MousePointerClickIcon} />
        <KpiCard label="Conversion rate" value={overview.conversionRate === null ? "—" : `${(overview.conversionRate * 100).toFixed(1)}%`} hint="Verified orders ÷ clicks" icon={TrendingUpIcon} />
        <KpiCard label="Active campaigns" value={overview.activeCampaigns} hint={`${overview.totalProducts} products listed`} icon={MegaphoneIcon} />
        <KpiCard label="Partners" value={overview.totalCreators + overview.totalCustomers} hint={`${overview.totalCreators} creators · ${overview.totalCustomers} customers`} icon={UsersIcon} />
        <KpiCard
          label="Pending payouts"
          value={formatMoney(overview.pendingCommissions + overview.pendingRewards)}
          hint={`${formatMoney(overview.pendingCommissions)} commissions · ${formatMoney(overview.pendingRewards)} rewards`}
          icon={WalletIcon}
        />
        <KpiCard
          label="Return on partner spend"
          value={overview.roi === null ? "—" : `${overview.roi.toFixed(1)}×`}
          hint={overview.roi === null ? "Needs approved commissions or rewards" : "Revenue ÷ approved commission & reward cost"}
          icon={TrendingUpIcon}
        />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <LightbulbIcon className="size-4 text-primary" aria-hidden />
            <CardTitle>Campaign insight</CardTitle>
          </div>
          <CardDescription>Computed from your real referral data. No numbers are estimated.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm">{insight.text}</p>
          {insight.recommendation ? <p className="mt-2 text-sm text-muted-foreground">{insight.recommendation}</p> : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Referrals over time</CardTitle>
            <CardDescription>Last 30 days, creator vs customer</CardDescription>
          </CardHeader>
          <CardContent>
            <ReferralsOverTimeChart data={series} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Revenue by campaign</CardTitle>
            <CardDescription>Verified orders only</CardDescription>
          </CardHeader>
          <CardContent>
            <RevenueByCampaignChart data={breakdown} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Conversion funnel</CardTitle>
            <CardDescription>All campaigns, all time</CardDescription>
          </CardHeader>
          <CardContent>
            <FunnelChart
              steps={[
                { label: "Link & QR clicks", value: overview.totalClicks },
                { label: "Orders recorded", value: overview.totalOrders },
                { label: "Verified conversions", value: overview.verifiedConversions },
              ]}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Top creators</CardTitle>
              <Link href="/dashboard/brand/analytics" className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                Analytics <ArrowRightIcon className="size-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {!topCreators.length ? (
              <EmptyState icon={UsersIcon} title="No creator activity yet" description="Creators appear here once their links start bringing clicks and orders." />
            ) : (
              <ul className="divide-y">
                {topCreators.map((c) => (
                  <li key={c.userId} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      {c.username ? (
                        <Link href={`/creators/${c.username}`} className="block truncate text-sm font-medium hover:underline">
                          {c.name}
                        </Link>
                      ) : (
                        <p className="truncate text-sm font-medium">{c.name}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {c.clicks} clicks · {c.verified} verified orders
                      </p>
                    </div>
                    <span className="text-sm font-medium tabular-nums">{formatMoney(c.revenue)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent campaigns</CardTitle>
            <Link href="/dashboard/brand/campaigns" className="inline-flex items-center gap-1 text-xs font-medium text-primary">
              View all <ArrowRightIcon className="size-3" />
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {!recent.length ? (
            <EmptyState
              icon={MegaphoneIcon}
              title="No campaigns yet"
              description="Add a product, then create a campaign so creators and customers can start promoting it."
              action={
                <Button size="sm" nativeButton={false} render={<Link href={overview.totalProducts ? "/dashboard/brand/campaigns/new" : "/dashboard/brand/products/new"} />}>
                  {overview.totalProducts ? "Create campaign" : "Add your first product"}
                </Button>
              }
            />
          ) : (
            <ul className="divide-y">
              {recent.map((c) => (
                <li key={c.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <ProductThumb src={c.product.imageUrl} name={c.product.name} className="size-10" />
                  <div className="min-w-0 flex-1">
                    <Link href={`/dashboard/brand/campaigns/${c.id}`} className="block truncate text-sm font-medium hover:underline">
                      {c.name}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.product.name} · {c._count.referralClicks} clicks · {c._count.referrals} referrals · {c._count.partnerApplications} partners
                    </p>
                  </div>
                  <StatusBadge status={c.status} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
