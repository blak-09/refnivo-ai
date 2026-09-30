import Link from "next/link";
import type { Metadata } from "next";
import { LinkIcon, MousePointerClickIcon, ReceiptIcon, WalletIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, KpiCard, PageHeader, StatusBadge } from "@/components/dashboard/primitives";
import { requireBrand } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { formatMoney } from "@/lib/money";
import { SOURCE_LABEL } from "@/lib/services/channel-links";
import { referralUrl } from "@/lib/services/links";
import { getBrandTrackingLinks } from "@/lib/services/metrics";
import type { LinkSource } from "@prisma/client";

export const metadata: Metadata = { title: "Tracking" };

type Search = { campaign?: string; partner?: string };

/**
 * Every referral link issued on the brand's campaigns, with what it actually
 * produced: recorded clicks, verified conversions, verified revenue and
 * commission. Nothing here is estimated.
 */
export default async function TrackingPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { brand } = await requireBrand();
  const sp = await searchParams;
  const partnerType = sp.partner === "CREATOR" || sp.partner === "CUSTOMER" ? sp.partner : undefined;
  const [rows, campaigns] = await Promise.all([
    getBrandTrackingLinks(brand.id, { campaignId: sp.campaign || undefined, partnerType }),
    prisma.campaign.findMany({ where: { brandId: brand.id }, select: { id: true, name: true }, orderBy: { createdAt: "desc" } }),
  ]);
  const totals = rows.reduce((t, r) => ({ clicks: t.clicks + r.clicks, conversions: t.conversions + r.conversions, revenue: t.revenue + r.revenue, commission: t.commission + r.commission }), {
    clicks: 0,
    conversions: 0,
    revenue: 0,
    commission: 0,
  });
  const filtered = !!(sp.campaign || partnerType);

  return (
    <div className="space-y-6">
      <PageHeader title="Tracking" description="Every referral link on your campaigns and what it produced. Revenue and commission count verified orders only." />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Referral links" value={rows.length} icon={LinkIcon} />
        <KpiCard label="Clicks" value={totals.clicks.toLocaleString("en-IN")} icon={MousePointerClickIcon} />
        <KpiCard label="Verified conversions" value={totals.conversions.toLocaleString("en-IN")} icon={ReceiptIcon} hint={totals.clicks ? `${((totals.conversions / totals.clicks) * 100).toFixed(1)}% of clicks` : undefined} />
        <KpiCard label="Revenue · Commission" value={formatMoney(totals.revenue)} icon={WalletIcon} hint={`${formatMoney(totals.commission)} commission`} />
      </div>

      <Card>
        <CardHeader className="gap-3 sm:flex sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle>Referral links</CardTitle>
            <CardDescription>Highest revenue first.</CardDescription>
          </div>
          <form className="flex flex-col gap-2 sm:flex-row" aria-label="Filter links">
            <NativeSelect name="campaign" defaultValue={sp.campaign ?? ""} aria-label="Campaign" className="sm:w-56">
              <option value="">All campaigns</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect name="partner" defaultValue={partnerType ?? ""} aria-label="Partner type" className="sm:w-40">
              <option value="">All partners</option>
              <option value="CREATOR">Creators</option>
              <option value="CUSTOMER">Customers</option>
            </NativeSelect>
            <Button type="submit" variant="outline">
              Apply
            </Button>
          </form>
        </CardHeader>
        <CardContent>
          {!rows.length ? (
            <EmptyState
              icon={LinkIcon}
              title={filtered ? "No links match these filters" : "No referral links yet"}
              description={filtered ? "Try another campaign or partner type." : "Links appear here as soon as creators and customers join your campaigns."}
              action={
                <Button size="sm" nativeButton={false} render={<Link href={filtered ? "/dashboard/brand/tracking" : "/dashboard/brand/campaigns"} />}>
                  {filtered ? "Clear filters" : "View campaigns"}
                </Button>
              }
            />
          ) : (
            <>
              {/* Phones: one card per link */}
              <ul className="grid gap-3 md:hidden">
                {rows.map((r) => (
                  <li key={r.id} className="rounded-xl border p-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{r.partnerName}</p>
                        <p className="truncate text-xs text-muted-foreground">{r.campaignName}</p>
                      </div>
                      <StatusBadge status={r.status} />
                    </div>
                    <p className="mt-2 truncate font-mono text-xs text-primary">{referralUrl(r.code).replace(/^https?:\/\//, "")}</p>
                    <dl className="mt-2 grid grid-cols-4 gap-2 text-center text-xs">
                      {[
                        ["Clicks", r.clicks.toLocaleString("en-IN")],
                        ["Conv.", r.conversions.toLocaleString("en-IN")],
                        ["Revenue", formatMoney(r.revenue)],
                        ["Comm.", formatMoney(r.commission)],
                      ].map(([k, v]) => (
                        <div key={k} className="rounded-lg bg-muted/50 px-1 py-1.5">
                          <dt className="text-muted-foreground">{k}</dt>
                          <dd className="font-semibold tabular-nums">{v}</dd>
                        </div>
                      ))}
                    </dl>
                  </li>
                ))}
              </ul>
              {/* Tablet and up: table */}
              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Partner</TableHead>
                      <TableHead>Campaign</TableHead>
                      <TableHead>Link</TableHead>
                      <TableHead className="text-right">Clicks</TableHead>
                      <TableHead className="text-right">Conversions</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">Commission</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          {r.partnerUsername ? (
                            <Link href={`/creators/${r.partnerUsername}`} className="font-medium hover:underline">
                              {r.partnerName}
                            </Link>
                          ) : (
                            <span className="font-medium">{r.partnerName}</span>
                          )}
                          <span className="block text-xs text-muted-foreground">{r.partnerType === "CREATOR" ? "Creator" : "Customer"}</span>
                        </TableCell>
                        <TableCell className="max-w-48">
                          <Link href={`/dashboard/brand/campaigns/${r.campaignId}`} className="block truncate hover:underline">
                            {r.campaignName}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-xs">{referralUrl(r.code).replace(/^https?:\/\//, "")}</span>
                          <span className="block text-xs text-muted-foreground">{SOURCE_LABEL[r.source as LinkSource] ?? r.source}</span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{r.clicks.toLocaleString("en-IN")}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.conversions.toLocaleString("en-IN")}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(r.revenue)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(r.commission)}</TableCell>
                        <TableCell>
                          <StatusBadge status={r.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
