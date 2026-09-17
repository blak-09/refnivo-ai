import Link from "next/link";
import type { Metadata } from "next";
import { CompassIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, PageHeader, StatusBadge } from "@/components/dashboard/primitives";
import { WithdrawApplication } from "@/components/partners/withdraw-application";
import { describeCreatorCommission, describeDuration } from "@/components/campaigns/campaign-summary";
import { ProductThumb } from "@/components/products/product-thumb";
import { requireCreator } from "@/lib/auth/guards";
import { formatMoney } from "@/lib/money";
import { listCreatorCampaigns } from "@/lib/services/creators";

export const metadata: Metadata = { title: "My applications" };

export default async function CreatorCampaignsPage() {
  const { user } = await requireCreator();
  const campaigns = await listCreatorCampaigns(user.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="My applications"
        description="Campaigns you applied to or joined, with their status. Approved applications have a referral link under Referral Links & QR."
        actions={
          <Button nativeButton={false} render={<Link href="/campaigns" />}>
            <CompassIcon /> Discover more
          </Button>
        }
      />
      {!campaigns.length ? (
        <EmptyState icon={CompassIcon} title="No campaigns yet" description="Apply to a campaign from the marketplace to start earning commissions." />
      ) : (
        <div className="grid gap-3">
          {campaigns.map((a) => {
            const c = a.campaign;
            const link = c.referralLinks[0];
            return (
              <Card key={a.id} size="sm">
                <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 gap-3">
                    <ProductThumb src={c.product.imageUrl} name={c.product.name} className="size-14" />
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/campaigns/${c.slug}`} className="text-sm font-semibold hover:underline">
                          {c.product.name}
                        </Link>
                        <StatusBadge
                          status={a.status}
                          label={
                            a.status === "APPROVED"
                              ? "Approved"
                              : a.status === "PENDING"
                                ? "Awaiting approval"
                                : a.status === "WITHDRAWN"
                                  ? "Withdrawn"
                                  : a.status === "REMOVED"
                                    ? "Removed by brand"
                                    : "Not approved"
                          }
                        />
                        {a.status === "PENDING" ? <WithdrawApplication applicationId={a.id} /> : null}
                        {c.status !== "ACTIVE" ? <StatusBadge status={c.status} /> : null}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {c.brand.name} · {c.name} · {formatMoney(c.product.price, c.product.currency)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {describeCreatorCommission(c)} · {describeDuration(c)}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground sm:flex-col sm:items-end sm:gap-1">
                    {link ? (
                      <>
                        <code className="font-mono text-foreground">{link.code}</code>
                        <span>{link._count.clicks} clicks · {link._count.referrals} referrals</span>
                        <Link href="/dashboard/creator/links" className="text-primary hover:underline">
                          Get link & QR
                        </Link>
                      </>
                    ) : (
                      <span>Link issued on approval</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
