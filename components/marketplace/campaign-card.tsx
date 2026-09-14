import Link from "next/link";
import { BadgeCheckIcon, UsersIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BrandLogo, ProductThumb } from "@/components/products/product-thumb";
import { shortCommission, shortReward } from "@/components/campaigns/campaign-summary";
import { formatMoney } from "@/lib/money";
import type { MarketplaceCampaign } from "@/lib/services/campaigns";
import { formatDate } from "@/lib/utils/dates";

export function CampaignCard({ c }: { c: MarketplaceCampaign }) {
  const creatorsAllowed = c.campaignType !== "CUSTOMER_REFERRAL";
  const customersAllowed = c.campaignType !== "CREATOR_AFFILIATE";
  return (
    <Card size="sm" className="flex h-full flex-col transition-shadow hover:shadow-md">
      <CardContent className="flex flex-1 flex-col gap-3">
        <Link href={`/campaigns/${c.slug}`} className="block">
          <ProductThumb src={c.product.imageUrl} name={c.product.name} className="aspect-[4/3] w-full" />
        </Link>
        <div className="flex items-center gap-2">
          <BrandLogo src={c.brand.logoUrl} name={c.brand.name} className="size-6 text-[10px]" />
          <Link href={`/brands/${c.brand.slug}`} className="truncate text-xs font-medium text-muted-foreground hover:text-foreground">
            {c.brand.name}
          </Link>
          {c.brand.verificationStatus === "VERIFIED" ? <BadgeCheckIcon className="size-3.5 text-primary" aria-label="Verified brand" /> : null}
        </div>
        <div className="min-w-0">
          <Link href={`/campaigns/${c.slug}`} className="line-clamp-2 text-sm font-semibold hover:underline">
            {c.product.name}
          </Link>
          <p className="truncate text-xs text-muted-foreground">{c.name}</p>
          <p className="mt-1 text-sm font-medium">{formatMoney(c.product.price, c.product.currency)}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {creatorsAllowed ? <Badge>Creators earn {shortCommission(c)}</Badge> : null}
          {customersAllowed ? <Badge variant="secondary">Customers get {shortReward(c)}</Badge> : null}
        </div>
        <div className="mt-auto flex items-center justify-between text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <UsersIcon className="size-3.5" /> {c._count.partnerApplications} creator{c._count.partnerApplications === 1 ? "" : "s"}
          </span>
          <span>{c.endDate ? `Ends ${formatDate(c.endDate)}` : "No end date"}</span>
        </div>
        <Button size="sm" className="w-full" nativeButton={false} render={<Link href={`/campaigns/${c.slug}`} />}>
          View campaign
        </Button>
      </CardContent>
    </Card>
  );
}
