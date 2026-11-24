import Link from "next/link";
import type { Metadata } from "next";
import { HeartHandshakeIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, KpiCard, PageHeader } from "@/components/dashboard/primitives";
import { BrandLogo } from "@/components/products/product-thumb";
import { requireCreator } from "@/lib/auth/guards";
import { formatMoney } from "@/lib/money";
import { listCreatorPartnerships } from "@/lib/services/partnerships";
import { formatDate } from "@/lib/utils/dates";

export const metadata: Metadata = { title: "Partnerships" };

export default async function CreatorPartnershipsPage() {
  const { user } = await requireCreator();
  const rows = await listCreatorPartnerships(user.id);
  const total = rows.reduce((s, r) => ({ commission: s.commission + r.stats.commission, ugc: s.ugc + r.stats.ugcFees, verified: s.verified + r.stats.verified }), { commission: 0, ugc: 0, verified: 0 });

  return (
    <div className="space-y-6">
      <PageHeader title="Partnerships" description="The brands you work with and what each partnership has earned you. Only verified sales and approved UGC count." />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Brand partners" value={rows.length} />
        <KpiCard label="Verified sales" value={total.verified} />
        <KpiCard label="Commission earned" value={formatMoney(total.commission)} />
        <KpiCard label="UGC fees (approved)" value={formatMoney(total.ugc)} />
      </div>

      {!rows.length ? (
        <EmptyState
          icon={HeartHandshakeIcon}
          title="No partnerships yet"
          description="A brand becomes your partner when they approve you on a campaign, accept a connection, or select you for a UGC brief."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button size="sm" nativeButton={false} render={<Link href="/dashboard/creator/discover" />}>
                Find campaigns
              </Button>
              <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/dashboard/creator/ugc" />}>
                Browse UGC briefs
              </Button>
            </div>
          }
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((r) => (
            <Card key={r.brand.id}>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <BrandLogo src={r.brand.logoUrl} name={r.brand.name} className="size-11" />
                  <div className="min-w-0 flex-1">
                    <Link href={`/brands/${r.brand.slug}`} className="block truncate font-medium hover:underline">
                      {r.brand.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {r.brand.industry ? `${r.brand.industry} · ` : ""}since {formatDate(r.since)}
                    </p>
                  </div>
                  {r.connected ? <Badge variant="secondary">Connected</Badge> : null}
                </div>
                <dl className="grid grid-cols-2 gap-2 text-sm xl:grid-cols-4">
                  <Stat label="Campaigns" value={r.stats.campaigns} />
                  <Stat label="Verified sales" value={r.stats.verified} />
                  <Stat label="Commission" value={formatMoney(r.stats.commission)} />
                  <Stat label="UGC" value={r.stats.ugc ? `${r.stats.ugc} · ${formatMoney(r.stats.ugcFees)}` : "0"} />
                </dl>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-muted/50 px-2.5 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}
