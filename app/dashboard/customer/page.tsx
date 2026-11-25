import Link from "next/link";
import type { Metadata } from "next";
import { CompassIcon, GiftIcon, LinkIcon, MousePointerClickIcon, PackageCheckIcon, ShoppingCartIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard, PageHeader, StatusBadge } from "@/components/dashboard/primitives";
import { PartnerLinksList } from "@/components/links/partner-links-list";
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
  const [stats, links, claims, completion] = await Promise.all([
    getPartnerStats(user.id),
    prisma.referralLink.count({ where: { ownerId: user.id, status: "ACTIVE" } }),
    listCustomerClaims(user.id),
    profileCompletionFor(user.id, "CUSTOMER"),
  ]);

  return (
    <div className="space-y-6">
      {welcome ? (
        <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          <p className="font-medium">Welcome to Refnivo, {user.name.split(" ")[0]} 🎉</p>
          <p className="text-muted-foreground">
            Next: <Link href="/campaigns" className="underline underline-offset-4">discover products</Link> and share the ones you like with friends.
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
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiCard label="My links" value={links} icon={LinkIcon} />
        <KpiCard label="Clicks on my links" value={stats.clicks} hint={`${stats.qrScans} via QR`} icon={MousePointerClickIcon} />
        <KpiCard label="Successful purchases" value={stats.verified} hint={`${stats.purchased} awaiting verification`} icon={ShoppingCartIcon} />
        <KpiCard label="Rewards earned" value={formatMoney(stats.rewardsPending + stats.rewardsAvailable + stats.rewardsRedeemed)} hint={`${formatMoney(stats.rewardsAvailable)} available`} icon={GiftIcon} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>My referral links</CardTitle>
        </CardHeader>
        <CardContent>
          <PartnerLinksList userId={user.id} emptyDescription="Open any campaign and tap “Join & generate my referral link” — you get a link and QR code instantly." />
        </CardContent>
      </Card>
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
