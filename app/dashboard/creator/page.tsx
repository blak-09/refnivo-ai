import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRightIcon, BarChart3Icon, CircleCheckIcon, ClockIcon, CompassIcon, ShoppingCartIcon, WalletIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, KpiCard, PageHeader, StatusBadge } from "@/components/dashboard/primitives";
import { CircleCallout } from "@/components/community/community-ui";
import { CampaignCard } from "@/components/marketplace/campaign-card";
import { ProductThumb } from "@/components/products/product-thumb";
import { requireCreator } from "@/lib/auth/guards";
import { ProfileCompletionCard } from "@/components/onboarding/completion-card";
import { creatorCompletion } from "@/lib/onboarding/completion";
import { formatMoney } from "@/lib/money";
import { listCreatorCampaigns } from "@/lib/services/creators";
import { recommendCampaigns } from "@/lib/services/dashboard";
import { getPartnerStats } from "@/lib/services/metrics";
import type { MarketplaceCampaign } from "@/lib/services/campaigns";

export const metadata: Metadata = { title: "Creator overview" };

function Recommended({ campaigns, matched, first }: { campaigns: MarketplaceCampaign[]; matched: boolean; first: boolean }) {
  if (!campaigns.length) return null;
  return (
    <section aria-labelledby="recommended-heading" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="recommended-heading" className="text-base font-semibold tracking-tight">
            {first ? "Start with one of these campaigns" : "Recommended for you"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {matched ? "Live campaigns in the categories you picked, newest first." : "The newest live campaigns you haven't joined yet."}
          </p>
        </div>
        <Link href="/campaigns" className="inline-flex items-center gap-1 text-xs font-medium text-primary">
          All campaigns <ArrowRightIcon className="size-3" />
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {campaigns.map((c) => (
          <CampaignCard key={c.id} c={c} />
        ))}
      </div>
    </section>
  );
}

export default async function CreatorOverviewPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const { user, profile } = await requireCreator();
  const { welcome } = await searchParams;
  const [stats, campaigns, recommended] = await Promise.all([
    getPartnerStats(user.id),
    listCreatorCampaigns(user.id),
    recommendCampaigns({ userId: user.id, audience: "CREATOR", categories: profile.interestedCategories }),
  ]);
  const recent = campaigns.slice(0, 5);
  const firstRun = campaigns.length === 0;

  return (
    <div className="space-y-6">
      {welcome ? (
        <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          <p className="font-medium">Your creator profile is live, {profile.displayName} 🎉</p>
          <p className="text-muted-foreground">
            Next: {recommended.campaigns.length ? "pick a campaign below" : <Link href="/campaigns" className="underline underline-offset-4">discover campaigns</Link>} and get your referral link.
          </p>
        </div>
      ) : null}
      <PageHeader
        title="Overview"
        description={`Your earnings and campaigns, ${profile.displayName}.`}
        actions={
          <Button nativeButton={false} render={<Link href="/campaigns" />}>
            <CompassIcon /> Discover campaigns
          </Button>
        }
      />
      <ProfileCompletionCard completion={creatorCompletion(profile)} editHref="/dashboard/creator/profile" />

      {firstRun ? <Recommended campaigns={recommended.campaigns} matched={recommended.matched} first /> : null}

      <section aria-labelledby="earnings-heading" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="earnings-heading" className="text-base font-semibold tracking-tight">
            Earnings
          </h2>
          <div className="flex gap-3 text-xs font-medium">
            <Link href="/dashboard/creator/earnings" className="inline-flex items-center gap-1 text-primary">
              Earnings & payouts <ArrowRightIcon className="size-3" />
            </Link>
            <Link href="/dashboard/creator/analytics" className="inline-flex items-center gap-1 text-primary">
              <BarChart3Icon className="size-3" aria-hidden /> Analytics
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <KpiCard label="Pending commission" value={formatMoney(stats.commissionPending)} hint="Orders awaiting brand verification" icon={ClockIcon} />
          <KpiCard label="Approved commission" value={formatMoney(stats.commissionApproved)} hint="Payable once the campaign's refund window ends" icon={CircleCheckIcon} />
          <KpiCard label="Paid out" value={formatMoney(stats.commissionPaid)} hint={`${formatMoney(stats.commissionPending + stats.commissionApproved + stats.commissionPaid)} earned in total`} icon={WalletIcon} />
          <KpiCard label="Verified conversions" value={stats.verified} hint={`${stats.purchased} awaiting verification · ${stats.clicks} clicks`} icon={ShoppingCartIcon} />
        </div>
      </section>

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
              description="Join a campaign to get your unique referral link and QR code. Some campaigns give you a link instantly; others need the brand's approval."
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

      {!firstRun ? <Recommended campaigns={recommended.campaigns} matched={recommended.matched} first={false} /> : null}

      <CircleCallout audience="CREATOR" placement="creator-dashboard" />
    </div>
  );
}
