import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRightIcon, CompassIcon, GiftIcon, LinkIcon, MousePointerClickIcon, PackageCheckIcon, ShoppingCartIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard, PageHeader, StatusBadge } from "@/components/dashboard/primitives";
import { PartnerLinksList } from "@/components/links/partner-links-list";
import { CampaignCard } from "@/components/marketplace/campaign-card";
import { recommendCampaigns } from "@/lib/services/dashboard";
import { requireCustomer } from "@/lib/auth/guards";
import { ProfileCompletionCard } from "@/components/onboarding/completion-card";
import { profileCompletionFor } from "@/lib/services/onboarding";
import { prisma } from "@/lib/db/prisma";
import { formatMoney } from "@/lib/money";
import { getPartnerStats } from "@/lib/services/metrics";
import { listCustomerClaims } from "@/lib/services/order-claims";
import { formatDate } from "@/lib/utils/dates";

const CLAIM_LABEL: Record<string, string> = { PENDING: "Waiting for the brand", CONFIRMED: "Confirmed", REJECTED: "Not matched" };

export const metadata: Metadata = { title: "My rewards" };

export default async function CustomerOverviewPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const user = await requireCustomer();
  const { welcome } = await searchParams;
  const [stats, links, claims, completion, profile] = await Promise.all([
    getPartnerStats(user.id),
    prisma.referralLink.count({ where: { ownerId: user.id, status: "ACTIVE" } }),
    listCustomerClaims(user.id),
    profileCompletionFor(user.id, "CUSTOMER"),
    prisma.customerProfile.findUnique({ where: { userId: user.id }, select: { preferredCategories: true } }),
  ]);
  const shareable = await recommendCampaigns({ userId: user.id, audience: "CUSTOMER", categories: profile?.preferredCategories ?? [] });

  const productsToShare = shareable.campaigns.length ? (
    <section aria-labelledby="share-heading" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="share-heading" className="text-base font-semibold tracking-tight">
            Products you can share
          </h2>
          <p className="text-sm text-muted-foreground">
            {shareable.matched ? "Live campaigns in the categories you picked." : "The newest live campaigns you haven't joined yet."} Open one to get your personal link.
          </p>
        </div>
        <Link href="/campaigns" className="inline-flex items-center gap-1 text-xs font-medium text-primary">
          All products <ArrowRightIcon className="size-3" />
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shareable.campaigns.map((c) => (
          <CampaignCard key={c.id} c={c} />
        ))}
      </div>
    </section>
  ) : null;

  return (
    <div className="space-y-6">
      {welcome ? (
        <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          <p className="font-medium">Welcome to Refnivo, {user.name.split(" ")[0]} 🎉</p>
          <p className="text-muted-foreground">
            Next: {shareable.campaigns.length ? "pick a product below" : <Link href="/campaigns" className="underline underline-offset-4">discover products</Link>}, get your personal link and share it with friends.
          </p>
        </div>
      ) : null}
      <PageHeader
        title={`Hi ${user.name.split(" ")[0]}`}
        description="Share products you like. When a friend buys through your link, you earn the reward."
        actions={
          <Button nativeButton={false} render={<Link href="/campaigns" />}>
            <CompassIcon /> Discover products
          </Button>
        }
      />
      <ProfileCompletionCard completion={completion} editHref="/dashboard/customer/profile" />
      {links === 0 ? productsToShare : null}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiCard
          label="Rewards available"
          value={formatMoney(stats.rewardsAvailable)}
          hint={`${formatMoney(stats.rewardsPending)} pending · ${formatMoney(stats.rewardsRedeemed)} redeemed`}
          icon={GiftIcon}
        />
        <KpiCard label="Successful purchases" value={stats.verified} hint={`${stats.purchased} awaiting verification`} icon={ShoppingCartIcon} />
        <KpiCard label="Clicks on my links" value={stats.clicks} hint={`${stats.qrScans} via QR`} icon={MousePointerClickIcon} />
        <KpiCard label="My links" value={links} icon={LinkIcon} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>My referral links</CardTitle>
        </CardHeader>
        <CardContent>
          <PartnerLinksList userId={user.id} emptyDescription="Open any campaign and tap “Join & generate my referral link” — you get a link and QR code instantly." />
        </CardContent>
      </Card>
      {links > 0 ? productsToShare : null}
      {claims.length ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PackageCheckIcon className="size-5 text-primary" aria-hidden /> Orders I confirmed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {claims.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                  <div>
                    <span className="font-mono font-medium">{c.orderReference}</span>
                    <span className="block text-xs text-muted-foreground">
                      <Link href={`/campaigns/${c.campaign.slug}`} className="hover:underline">
                        {c.campaign.name}
                      </Link>{" "}
                      · {c.campaign.brand.name} · {formatDate(c.createdAt)}
                    </span>
                    {c.status === "REJECTED" && c.rejectionReason ? <span className="block text-xs text-muted-foreground">Brand: “{c.rejectionReason}”</span> : null}
                  </div>
                  <StatusBadge status={c.status === "CONFIRMED" ? "VERIFIED" : c.status === "REJECTED" ? "REJECTED" : "PURCHASED"} label={CLAIM_LABEL[c.status]} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
