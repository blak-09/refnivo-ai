import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRightIcon,
  BadgeIndianRupeeIcon,
  BarChart3Icon,
  ClapperboardIcon,
  ClockIcon,
  HandshakeIcon,
  LightbulbIcon,
  MegaphoneIcon,
  MousePointerClickIcon,
  PackageCheckIcon,
  PackageIcon,
  PiggyBankIcon,
  PlusIcon,
  ShoppingCartIcon,
  TrendingUpIcon,
  UserPlusIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, KpiCard, PageHeader, StatusBadge } from "@/components/dashboard/primitives";
import { AttentionList, SetupChecklist, type AttentionItem, type SetupStep } from "@/components/dashboard/overview-blocks";
import { CircleCallout } from "@/components/community/community-ui";
import { FunnelChart, ReferralsOverTimeChart, RevenueByCampaignChart } from "@/components/charts/lazy-charts";
import { ProductThumb } from "@/components/products/product-thumb";
import { requireBrand } from "@/lib/auth/guards";
import { ProfileCompletionCard } from "@/components/onboarding/completion-card";
import { brandCompletion } from "@/lib/onboarding/completion";
import { formatMoney } from "@/lib/money";
import { listCampaigns } from "@/lib/services/campaigns";
import { getBrandAttention, type BrandAttention } from "@/lib/services/dashboard";
import { getBrandOverview, getCampaignBreakdown, getReferralsOverTime, getTopCreators } from "@/lib/services/metrics";
import { getBrandEntitlements } from "@/lib/services/plan-limits";
import { buildInsight } from "@/lib/domain/insights";

export const metadata: Metadata = { title: "Overview" };

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** One row per open task, in the order a brand should handle them. */
function attentionItems(a: BrandAttention): AttentionItem[] {
  const items: AttentionItem[] = [];
  if (a.walletShortfall)
    items.push({
      key: "wallet",
      icon: PiggyBankIcon,
      title: "Your wallet is running low",
      detail: `Balance ${formatMoney(a.walletShortfall.balance)} · pending orders would cost ${formatMoney(a.walletShortfall.owed)}. Verifying an order needs enough balance.`,
      href: "/dashboard/brand/wallet",
      cta: "Add money",
    });
  if (a.ordersToVerify)
    items.push({
      key: "orders",
      icon: ShoppingCartIcon,
      title: `${plural(a.ordersToVerify, "order")} to verify`,
      detail: "Match them in your store, then verify or reject. Partners see how long each order has waited.",
      href: "/dashboard/brand/orders?status=PURCHASED",
      cta: "Review orders",
    });
  if (a.buyerClaims)
    items.push({
      key: "claims",
      icon: PackageCheckIcon,
      title: `${plural(a.buyerClaims, "buyer claim")} to match`,
      detail: "Shoppers confirmed an order number from a campaign page.",
      href: "/dashboard/brand/orders",
      cta: "Match claims",
    });
  if (a.applications)
    items.push({
      key: "applications",
      icon: UserPlusIcon,
      title: `${plural(a.applications, "application")} waiting`,
      detail: "Partners asked to join a campaign that needs your approval.",
      href: "/dashboard/brand/creators?status=PENDING&type=ALL",
      cta: "Review applications",
    });
  if (a.ugcToReview)
    items.push({
      key: "ugc",
      icon: ClapperboardIcon,
      title: `${plural(a.ugcToReview, "UGC update")} to review`,
      detail: "New pitches or submitted content on your UGC briefs.",
      href: "/dashboard/brand/ugc",
      cta: "Open UGC",
    });
  if (a.ugcToPay)
    items.push({
      key: "ugc-pay",
      icon: WalletIcon,
      title: `${plural(a.ugcToPay, "approved UGC collaboration")} to pay`,
      detail: "Pay the creator directly, then mark it paid.",
      href: "/dashboard/brand/ugc",
      cta: "Open UGC",
    });
  if (a.incomingConnections)
    items.push({
      key: "connections",
      icon: HandshakeIcon,
      title: `${plural(a.incomingConnections, "connection request")} from creators`,
      detail: "Accept to start working together, or decline.",
      href: "/dashboard/brand/connections?tab=INCOMING",
      cta: "Respond",
    });
  if (a.campaignsInReview)
    items.push({
      key: "review",
      icon: ClockIcon,
      kind: "info",
      title: `${plural(a.campaignsInReview, "campaign")} in review`,
      detail: "The Refnivo team checks a brand's first campaign before it goes live, usually within one business day.",
      href: "/dashboard/brand/campaigns",
      cta: "View campaigns",
    });
  return items;
}

export default async function BrandOverviewPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const { brand } = await requireBrand();
  const { welcome } = await searchParams;

  const [overview, breakdown, series, campaigns, topCreators, attention, entitlements] = await Promise.all([
    getBrandOverview(brand.id),
    getCampaignBreakdown(brand.id),
    getReferralsOverTime(brand.id, 30),
    listCampaigns(brand.id),
    getTopCreators(brand.id, 5),
    getBrandAttention(brand.id),
    getBrandEntitlements(brand.id),
  ]);

  const insight = buildInsight(overview, breakdown);
  const recent = campaigns.slice(0, 5);
  const partners = overview.totalCreators + overview.totalCustomers;
  const hasAnalytics = entitlements.features.analytics;
  const hasActivity = overview.totalClicks > 0 || overview.totalOrders > 0;
  const tasks = attentionItems(attention);

  const steps: SetupStep[] = [
    {
      title: "Add a product",
      description: "Every campaign promotes one product: add its name, price, photo and store link.",
      done: overview.totalProducts > 0,
      href: "/dashboard/brand/products/new",
      cta: "Add product",
    },
    {
      title: "Create a campaign",
      description: "Set the creator commission, customer reward and refund window. Your first campaign is checked by the Refnivo team before it goes live.",
      done: overview.totalCampaigns > 0,
      href: "/dashboard/brand/campaigns/new",
      cta: "Create campaign",
    },
    {
      title: "Get your first partner",
      description:
        attention.applications > 0
          ? "Creators have applied — approve the ones that fit your brand."
          : "Invite creators from the directory, or share your campaign so creators and customers can join.",
      done: partners > 0,
      href: attention.applications > 0 ? "/dashboard/brand/creators?status=PENDING&type=ALL" : "/creators",
      cta: attention.applications > 0 ? "Review applications" : "Find creators",
    },
  ];
  const setupDone = steps.every((s) => s.done);

  return (
    <div className="space-y-6">
      {welcome ? (
        <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          <p className="font-medium">Welcome to Refnivo AI, {brand.name} 🎉</p>
          <p className="text-muted-foreground">Follow the steps below to launch your first campaign.</p>
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

      {!setupDone ? <SetupChecklist title="Get started" description="Three steps to your first referral sale." steps={steps} /> : null}

      {setupDone || tasks.length ? <AttentionList items={tasks} /> : null}

      <ProfileCompletionCard completion={brandCompletion(brand)} editHref="/dashboard/brand/profile" />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiCard
          label="Live campaigns"
          value={overview.liveCampaigns}
          hint={
            overview.activeCampaigns > overview.liveCampaigns
              ? `${overview.activeCampaigns - overview.liveCampaigns} active but outside their dates — hidden from the marketplace`
              : `${plural(overview.totalProducts, "product")} listed`
          }
          icon={MegaphoneIcon}
        />
        <KpiCard label="Link clicks" value={overview.totalClicks} hint={`${overview.qrScans} via QR`} icon={MousePointerClickIcon} />
        <KpiCard label="Verified conversions" value={overview.verifiedConversions} hint={`${overview.pendingVerification} awaiting verification`} icon={ShoppingCartIcon} />
        <KpiCard
          label="Pending commissions"
          value={formatMoney(overview.pendingCommissions + overview.pendingRewards)}
          hint={`${formatMoney(overview.pendingCommissions)} creators · ${formatMoney(overview.pendingRewards)} customer rewards`}
          icon={WalletIcon}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
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
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Top creators</CardTitle>
              <Link href={hasAnalytics ? "/dashboard/brand/analytics" : "/dashboard/brand/partners"} className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                {hasAnalytics ? "Analytics" : "All partners"} <ArrowRightIcon className="size-3" />
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

      {hasActivity ? (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <LightbulbIcon className="size-4 text-primary" aria-hidden />
                <CardTitle>Campaign insight</CardTitle>
              </div>
              {hasAnalytics ? (
                <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/dashboard/brand/analytics" />}>
                  <BarChart3Icon aria-hidden /> Revenue, ROI & charts
                </Button>
              ) : null}
            </div>
            <CardDescription>Computed from your real referral data. No numbers are estimated.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{insight.text}</p>
            {insight.recommendation ? <p className="mt-2 text-sm text-muted-foreground">{insight.recommendation}</p> : null}
          </CardContent>
        </Card>
      ) : null}

      {/* Analytics is a Growth feature, so on other plans these numbers and charts stay on the overview. */}
      {!hasAnalytics && hasActivity ? (
        <section aria-labelledby="performance-heading" className="space-y-4">
          <h2 id="performance-heading" className="text-sm font-semibold text-muted-foreground">
            Performance
          </h2>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <KpiCard label="Attributed revenue" value={formatMoney(overview.revenue)} hint="From verified orders" icon={BadgeIndianRupeeIcon} />
            <KpiCard label="Conversion rate" value={overview.conversionRate === null ? "—" : `${(overview.conversionRate * 100).toFixed(1)}%`} hint="Verified orders ÷ clicks" icon={TrendingUpIcon} />
            <KpiCard label="Partners" value={partners} hint={`${overview.totalCreators} creators · ${overview.totalCustomers} customers`} icon={UsersIcon} />
            <KpiCard
              label="Return on partner spend"
              value={overview.roi === null ? "—" : `${overview.roi.toFixed(1)}×`}
              hint={overview.roi === null ? "Needs approved commissions or rewards" : "Revenue ÷ approved commission & reward cost"}
              icon={TrendingUpIcon}
            />
          </div>
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
            <Card className="lg:col-span-2">
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
          </div>
        </section>
      ) : null}

      <CircleCallout audience="BRAND" placement="brand-dashboard" />
    </div>
  );
}
