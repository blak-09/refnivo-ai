import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRightIcon, BadgeIndianRupeeIcon, CompassIcon, MousePointerClickIcon, ShoppingCartIcon, TrendingUpIcon, WalletIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, KpiCard, PageHeader, StatusBadge } from "@/components/dashboard/primitives";
import { ProductThumb } from "@/components/products/product-thumb";
import { requireCreator } from "@/lib/auth/guards";
import { formatMoney } from "@/lib/money";
import { listCreatorCampaigns } from "@/lib/services/creators";
import { getPartnerStats } from "@/lib/services/metrics";

export const metadata: Metadata = { title: "Creator overview" };

export default async function CreatorOverviewPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const { user, profile } = await requireCreator();
  const { welcome } = await searchParams;
  const [stats, campaigns] = await Promise.all([getPartnerStats(user.id), listCreatorCampaigns(user.id)]);
  const recent = campaigns.slice(0, 5);

  return (
    <div className="space-y-6">
      {welcome ? (
        <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          <p className="font-medium">Your creator profile is live, {profile.displayName} 🎉</p>
          <p className="text-muted-foreground">
            Next: <Link href="/campaigns" className="underline underline-offset-4">discover campaigns</Link> and apply to promote products you like.
          </p>
        </div>
      ) : null}
      <PageHeader
        title="Overview"
        description={`Your affiliate performance, ${profile.displayName}.`}
        actions={
          <Button nativeButton={false} render={<Link href="/campaigns" />}>
            <CompassIcon /> Discover campaigns
          </Button>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total clicks" value={stats.clicks} hint={`${stats.qrScans} via QR`} icon={MousePointerClickIcon} />
        <KpiCard label="Verified conversions" value={stats.verified} hint={`${stats.purchased} awaiting verification`} icon={ShoppingCartIcon} />
        <KpiCard label="Sales generated" value={formatMoney(stats.sales)} hint="Verified order value" icon={BadgeIndianRupeeIcon} />
        <KpiCard label="Conversion rate" value={stats.conversionRate === null ? "—" : `${(stats.conversionRate * 100).toFixed(1)}%`} hint="Verified orders ÷ clicks" icon={TrendingUpIcon} />
        <KpiCard label="Pending commission" value={formatMoney(stats.commissionPending)} hint="Orders awaiting brand verification" icon={WalletIcon} />
        <KpiCard label="Approved commission" value={formatMoney(stats.commissionApproved)} hint="Ready for payout" icon={WalletIcon} />
        <KpiCard label="Paid out" value={formatMoney(stats.commissionPaid)} icon={WalletIcon} />
        <KpiCard label="Total earnings" value={formatMoney(stats.commissionPending + stats.commissionApproved + stats.commissionPaid)} icon={BadgeIndianRupeeIcon} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>My campaigns</CardTitle>
            <Link href="/dashboard/creator/campaigns" className="inline-flex items-center gap-1 text-xs font-medium text-primary">
              View all <ArrowRightIcon className="size-3" />
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {!recent.length ? (
            <EmptyState
              icon={CompassIcon}
              title="You haven't joined any campaigns yet"
              description="Browse the marketplace, apply to a campaign, and get your unique referral link and QR code."
              action={
                <Button size="sm" nativeButton={false} render={<Link href="/campaigns" />}>
                  Discover campaigns
                </Button>
              }
            />
          ) : (
            <ul className="divide-y">
              {recent.map((a) => {
                const link = a.campaign.referralLinks[0];
                return (
                  <li key={a.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                    <ProductThumb src={a.campaign.product.imageUrl} name={a.campaign.product.name} className="size-10" />
                    <div className="min-w-0 flex-1">
                      <Link href={`/campaigns/${a.campaign.slug}`} className="block truncate text-sm font-medium hover:underline">
                        {a.campaign.product.name}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">
                        {a.campaign.brand.name} · {a.campaign.name}
                        {link ? ` · ${link._count.clicks} clicks · ${link._count.referrals} referrals` : ""}
                      </p>
                    </div>
                    <StatusBadge status={a.status} label={a.status === "APPROVED" ? "Active" : a.status === "PENDING" ? "Awaiting approval" : undefined} />
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
