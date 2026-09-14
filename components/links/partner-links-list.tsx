import Link from "next/link";
import { LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, StatusBadge } from "@/components/dashboard/primitives";
import { ReferralLinkCard } from "@/components/links/referral-link-card";
import { ProductThumb } from "@/components/products/product-thumb";
import { prisma } from "@/lib/db/prisma";
import { referralQrDataUrl, referralUrl, shareTargets } from "@/lib/services/links";

/**
 * Server component: all referral links owned by a partner (creator or
 * customer), each with copy / QR / share controls and its live stats.
 */
export async function PartnerLinksList({ userId, emptyDescription }: { userId: string; emptyDescription: string }) {
  const links = await prisma.referralLink.findMany({
    where: { ownerId: userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      code: true,
      status: true,
      campaign: {
        select: {
          name: true,
          slug: true,
          status: true,
          offerTitle: true,
          brand: { select: { name: true } },
          product: { select: { name: true, imageUrl: true, price: true, currency: true } },
        },
      },
      _count: { select: { clicks: true } },
    },
  });
  if (!links.length) {
    return (
      <EmptyState
        icon={LinkIcon}
        title="No referral links yet"
        description={emptyDescription}
        action={
          <Button size="sm" nativeButton={false} render={<Link href="/campaigns" />}>
            Discover campaigns
          </Button>
        }
      />
    );
  }

  const ids = links.map((l) => l.id);
  const [qrScans, verified] = await Promise.all([
    prisma.referralClick.groupBy({ by: ["referralLinkId"], where: { referralLinkId: { in: ids }, source: "QR" }, _count: { _all: true } }),
    prisma.referral.groupBy({ by: ["referralLinkId"], where: { referralLinkId: { in: ids }, status: "VERIFIED" }, _count: { _all: true } }),
  ]);
  const qrMap = new Map(qrScans.map((r) => [r.referralLinkId, r._count._all]));
  const verifiedMap = new Map(verified.map((r) => [r.referralLinkId, r._count._all]));
  const cards = await Promise.all(
    links.map(async (l) => {
      const url = referralUrl(l.code);
      const text = `${l.campaign.product.name} by ${l.campaign.brand.name}${l.campaign.offerTitle ? ` — ${l.campaign.offerTitle}` : ""}`;
      return { l, url, qr: await referralQrDataUrl(l.code), share: shareTargets(url, text), text };
    }),
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {cards.map(({ l, url, qr, share, text }) => (
        <ReferralLinkCard
          key={l.id}
          code={l.code}
          url={url}
          qrDataUrl={qr}
          share={share}
          shareText={text}
          title={
            <div className="flex items-center gap-3">
              <ProductThumb src={l.campaign.product.imageUrl} name={l.campaign.product.name} className="size-10" />
              <div className="min-w-0 flex-1">
                <Link href={`/campaigns/${l.campaign.slug}`} className="block truncate hover:underline">
                  {l.campaign.product.name}
                </Link>
                <p className="truncate text-xs font-normal text-muted-foreground">
                  {l.campaign.brand.name} · {l.campaign.name}
                </p>
              </div>
              <StatusBadge status={l.status === "DISABLED" ? "REJECTED" : l.campaign.status} label={l.status === "DISABLED" ? "Disabled" : undefined} />
            </div>
          }
          stats={{ clicks: l._count.clicks, qrScans: qrMap.get(l.id) ?? 0, conversions: verifiedMap.get(l.id) ?? 0 }}
        />
      ))}
    </div>
  );
}
