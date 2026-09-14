import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, BadgeIndianRupeeIcon, ExternalLinkIcon, MousePointerClickIcon, QrCodeIcon, ShoppingCartIcon, UsersIcon, WalletIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard, PageHeader, StatusBadge } from "@/components/dashboard/primitives";
import { CampaignActions } from "@/components/campaigns/campaign-actions";
import { CampaignRulesGrid } from "@/components/campaigns/campaign-summary";
import { ProductThumb } from "@/components/products/product-thumb";
import { requireBrand } from "@/lib/auth/guards";
import { isCampaignLive, publishProblems } from "@/lib/domain/campaign-rules";
import { formatMoney } from "@/lib/money";
import { getCampaignWithStats } from "@/lib/services/campaigns";
import { formatDateTime } from "@/lib/utils/dates";

export const metadata: Metadata = { title: "Campaign" };

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { brand } = await requireBrand();
  const { id } = await params;
  const result = await getCampaignWithStats(brand.id, id);
  if (!result) notFound();
  const { campaign, stats } = result;

  const problems = publishProblems(campaign);
  if (campaign.product.status !== "ACTIVE") problems.push("The promoted product must be active.");
  const live = isCampaignLive(campaign);

  return (
    <div className="space-y-6">
      <Link href="/dashboard/brand/campaigns" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> All campaigns
      </Link>

      <PageHeader
        title={campaign.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={campaign.status} />
            {campaign.status === "ACTIVE" && !live ? (
              <span className="text-xs">
                {campaign.startDate > new Date() ? "Scheduled — starts " + formatDateTime(campaign.startDate) : "Past its end date — no new eligible conversions"}
              </span>
            ) : null}
            <span className="text-xs">Updated {formatDateTime(campaign.updatedAt)}</span>
            {campaign.status !== "DRAFT" ? (
              <Link href={`/campaigns/${campaign.slug}`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                Public campaign page <ExternalLinkIcon className="size-3" />
              </Link>
            ) : null}
          </span>
        }
        actions={<CampaignActions campaignId={campaign.id} status={campaign.status} problems={problems} />}
      />

      {campaign.status === "DRAFT" && problems.length ? (
        <div className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
          <p className="font-medium">Not ready to publish</p>
          <ul className="list-disc pl-5 text-muted-foreground">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <KpiCard label="Clicks" value={campaign._count.referralClicks} icon={MousePointerClickIcon} />
        <KpiCard label="QR scans" value={stats.qrClicks} icon={QrCodeIcon} />
        <KpiCard label="Verified orders" value={stats.verifiedReferrals} hint={`${campaign._count.referrals} referrals`} icon={ShoppingCartIcon} />
        <KpiCard label="Partners" value={stats.approvedCreators + stats.approvedCustomers} hint={`${stats.approvedCreators} creators · ${stats.approvedCustomers} customers`} icon={UsersIcon} />
        <KpiCard label="Revenue" value={formatMoney(stats.revenue)} icon={BadgeIndianRupeeIcon} />
        <KpiCard label="Approved cost" value={formatMoney(stats.rewardCost + stats.commissionCost)} hint="Commissions + rewards" icon={WalletIcon} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle>Product</CardTitle>
            <CardDescription>What partners are promoting</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <ProductThumb src={campaign.product.imageUrl} name={campaign.product.name} className="size-24" />
              <div className="min-w-0">
                <Link href={`/dashboard/brand/products/${campaign.product.id}`} className="font-semibold hover:underline">
                  {campaign.product.name}
                </Link>
                <p className="text-sm">{formatMoney(campaign.product.price, campaign.product.currency)}</p>
                {campaign.product.category ? <p className="text-xs text-muted-foreground">{campaign.product.category}</p> : null}
                <a href={campaign.product.purchaseUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline">
                  Store page <ExternalLinkIcon className="size-3" />
                </a>
              </div>
            </div>
            {campaign.offerTitle ? (
              <div className="rounded-xl border bg-gradient-to-br from-accent/60 to-background p-4">
                <p className="text-xs font-medium text-muted-foreground uppercase">Customer offer</p>
                <p className="mt-1 font-semibold">{campaign.offerTitle}</p>
                {campaign.offerDescription ? <p className="mt-1 text-sm text-muted-foreground">{campaign.offerDescription}</p> : null}
              </div>
            ) : null}
            {campaign.description ? (
              <div>
                <p className="text-sm font-medium">About this campaign</p>
                <p className="mt-1 text-sm whitespace-pre-line text-muted-foreground">{campaign.description}</p>
              </div>
            ) : null}
            {campaign.terms ? (
              <div>
                <p className="text-sm font-medium">Campaign rules</p>
                <p className="mt-1 text-sm whitespace-pre-line text-muted-foreground">{campaign.terms}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Commission, reward & rules</CardTitle>
          </CardHeader>
          <CardContent>
            <CampaignRulesGrid campaign={campaign} />
            <p className="mt-3 text-xs text-muted-foreground">
              {campaign.publishedAt ? `Published ${formatDateTime(campaign.publishedAt)}.` : "Not published yet."} Applications are under{" "}
              <Link href="/dashboard/brand/creators" className="underline underline-offset-4">Creators & Customers</Link>; orders under{" "}
              <Link href="/dashboard/brand/orders" className="underline underline-offset-4">Orders & Conversions</Link>.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
