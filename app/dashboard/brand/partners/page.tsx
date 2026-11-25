import Link from "next/link";
import type { Metadata } from "next";
import { HeartHandshakeIcon, SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, KpiCard, PageHeader } from "@/components/dashboard/primitives";
import { CreatorLine } from "@/components/ugc/parts";
import { requireBrand } from "@/lib/auth/guards";
import { formatMoney } from "@/lib/money";
import { listBrandPartners } from "@/lib/services/partnerships";
import { formatDate } from "@/lib/utils/dates";

export const metadata: Metadata = { title: "Partners" };

export default async function PartnersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const { brand } = await requireBrand();
  const query = q?.trim().slice(0, 80) ?? "";
  const [all, rows] = await Promise.all([listBrandPartners(brand.id), query ? listBrandPartners(brand.id, query) : null]);
  const list = rows ?? all;
  const total = all.reduce(
    (s, r) => ({ revenue: s.revenue + r.stats.revenue, verified: s.verified + r.stats.verified, paid: s.paid + r.stats.commission + r.stats.ugcFees }),
    { revenue: 0, verified: 0, paid: 0 },
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Partners"
        description="Every creator you work with — through campaigns, connections or UGC — and what each partnership produced. Results come from verified sales only."
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Creator partners" value={all.length} />
        <KpiCard label="Verified sales" value={total.verified} />
        <KpiCard label="Sales value" value={formatMoney(total.revenue)} />
        <KpiCard label="Commission + UGC fees" value={formatMoney(total.paid)} hint="Commission on verified sales plus approved UGC fees" />
      </div>

      {!all.length ? (
        <EmptyState
          icon={HeartHandshakeIcon}
          title="No partners yet"
          description="A creator becomes a partner when you approve their campaign application, accept a connection, or accept them on a UGC brief."
          action={
            <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/dashboard/brand/creators" />}>
              Review creator applications
            </Button>
          }
        />
      ) : (
        <Card>
          <CardContent className="space-y-4">
            <form className="relative max-w-sm" role="search">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input name="q" defaultValue={query} placeholder="Search by name or @username" className="pl-9" aria-label="Search partners" />
            </form>
            {!list.length ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No partner matches “{query}”.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Creator</TableHead>
                      <TableHead className="text-right">Campaigns</TableHead>
                      <TableHead className="text-right">UGC</TableHead>
                      <TableHead className="text-right">Clicks</TableHead>
                      <TableHead className="text-right">Verified sales</TableHead>
                      <TableHead className="text-right">Sales value</TableHead>
                      <TableHead>Partner since</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {list.map((r) => (
                      <TableRow key={r.creator.id}>
                        <TableCell className="max-w-64">
                          <CreatorLine creator={r.creator} href={`/dashboard/brand/partners/${r.creator.id}`} compact />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{r.stats.campaigns}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.stats.ugc}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.stats.clicks}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.stats.verified}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(r.stats.revenue)}</TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(r.since)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
