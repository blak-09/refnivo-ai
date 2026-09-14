import Link from "next/link";
import type { Metadata } from "next";
import type { CampaignStatus } from "@prisma/client";
import { MegaphoneIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, PageHeader, StatusBadge } from "@/components/dashboard/primitives";
import { describeCreatorCommission, describeCustomerReward, describeDuration } from "@/components/campaigns/campaign-summary";
import { ProductThumb } from "@/components/products/product-thumb";
import { requireBrand } from "@/lib/auth/guards";
import { listCampaigns } from "@/lib/services/campaigns";
import { CAMPAIGN_STATUS_LABEL } from "@/lib/utils/labels";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Campaigns" };

const FILTERS: { value: CampaignStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "ACTIVE", label: "Active" },
  { value: "DRAFT", label: "Drafts" },
  { value: "PAUSED", label: "Paused" },
  { value: "ENDED", label: "Ended" },
  { value: "ARCHIVED", label: "Archived" },
];

export default async function CampaignsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { brand } = await requireBrand();
  const { status } = await searchParams;
  const filter = FILTERS.some((f) => f.value === status) ? (status as CampaignStatus | "ALL") : "ALL";
  const campaigns = await listCampaigns(brand.id, filter);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campaigns"
        description="Product promotions that creators and customers can join."
        actions={
          <Button nativeButton={false} render={<Link href="/dashboard/brand/campaigns/new" />}>
            <PlusIcon /> New campaign
          </Button>
        }
      />

      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter by status">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={f.value === "ALL" ? "/dashboard/brand/campaigns" : `/dashboard/brand/campaigns?status=${f.value}`}
            role="tab"
            aria-selected={filter === f.value}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              filter === f.value ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted",
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {!campaigns.length ? (
        <EmptyState
          icon={MegaphoneIcon}
          title={filter === "ALL" ? "No campaigns yet" : `No ${CAMPAIGN_STATUS_LABEL[filter]?.toLowerCase() ?? ""} campaigns`}
          description="A campaign links one product to a creator commission, a customer reward and the rules for a valid order."
          action={
            filter === "ALL" ? (
              <Button size="sm" nativeButton={false} render={<Link href="/dashboard/brand/campaigns/new" />}>
                Create your first campaign
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-3">
          {campaigns.map((c) => (
            <Card key={c.id} size="sm">
              <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 gap-3">
                  <ProductThumb src={c.product.imageUrl} name={c.product.name} className="size-14" />
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/dashboard/brand/campaigns/${c.id}`} className="text-sm font-semibold hover:underline">
                        {c.name}
                      </Link>
                      <StatusBadge status={c.status} />
                    </div>
                    <p className="text-sm text-muted-foreground">{c.product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Creator: {describeCreatorCommission(c)} · Customer: {describeCustomerReward(c)} · {describeDuration(c)}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-4 text-xs text-muted-foreground sm:flex-col sm:items-end sm:gap-1">
                  <span>{c._count.referralClicks} clicks</span>
                  <span>{c._count.referrals} referrals</span>
                  <span>{c._count.partnerApplications} partners</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
