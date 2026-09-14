import Link from "next/link";
import type { Metadata } from "next";
import type { ReferralStatus } from "@prisma/client";
import { ShoppingCartIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, KpiCard, PageHeader, StatusBadge } from "@/components/dashboard/primitives";
import { RecordOrderForm } from "@/components/orders/record-order-form";
import { ConversionDecision } from "@/components/orders/conversion-decision";
import { requireBrand } from "@/lib/auth/guards";
import { formatMoney } from "@/lib/money";
import { countOrdersByStatus, listBrandOrders } from "@/lib/services/conversions";
import { formatDate } from "@/lib/utils/dates";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Orders & Conversions" };

const FILTERS: { value: ReferralStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "All orders" },
  { value: "PURCHASED", label: "Pending verification" },
  { value: "VERIFIED", label: "Verified" },
  { value: "REJECTED", label: "Rejected" },
];

const STATUS_LABEL: Record<string, string> = { PURCHASED: "Pending verification", VERIFIED: "Verified", REJECTED: "Rejected" };

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { brand } = await requireBrand();
  const { status } = await searchParams;
  const filter = FILTERS.some((f) => f.value === status) ? (status as ReferralStatus | "ALL") : "ALL";
  const [orders, counts] = await Promise.all([listBrandOrders(brand.id, filter), countOrdersByStatus(brand.id)]);
  const total = Object.values(counts).reduce((s, n) => s + (n ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Orders & Conversions"
        description="Record online orders that carried a referral code, then verify them to release commissions and rewards. A click is never counted as a sale."
      />

      <div className="grid gap-3 sm:grid-cols-4">
        <KpiCard label="Orders recorded" value={total} />
        <KpiCard label="Pending verification" value={counts.PURCHASED ?? 0} />
        <KpiCard label="Verified conversions" value={counts.VERIFIED ?? 0} />
        <KpiCard label="Rejected" value={counts.REJECTED ?? 0} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Record an order</CardTitle>
          <CardDescription>
            Until your store is integrated, add orders here. The referral code identifies the campaign, product and partner automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RecordOrderForm />
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter by status">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={f.value === "ALL" ? "/dashboard/brand/orders" : `/dashboard/brand/orders?status=${f.value}`}
            role="tab"
            aria-selected={filter === f.value}
            className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors", filter === f.value ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted")}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {!orders.length ? (
        <EmptyState icon={ShoppingCartIcon} title="No orders yet" description="Orders appear here once you record them with a partner's referral code." />
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Campaign · product</TableHead>
                <TableHead>Partner</TableHead>
                <TableHead className="text-right">Order value</TableHead>
                <TableHead className="text-right">Owed</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((o) => {
                const r = o.referral;
                const partnerName = r.referrer.creatorProfile?.displayName ?? r.referrer.name;
                const owed = [...r.rewards, ...r.commissions].filter((x) => x.status !== "REJECTED").reduce((s, x) => s + x.amount, 0);
                const owedLabel = r.referralLink.partnerType === "CREATOR" ? `${formatMoney(owed)} commission` : `${formatMoney(owed)} reward`;
                return (
                  <TableRow key={o.id}>
                    <TableCell className="whitespace-nowrap">{formatDate(o.createdAt)}</TableCell>
                    <TableCell>
                      <span className="font-mono text-xs">{o.orderReference}</span>
                      <span className="block font-mono text-[10px] text-muted-foreground">{r.referralLink.code}</span>
                    </TableCell>
                    <TableCell>
                      <Link href={`/dashboard/brand/campaigns/${r.campaign.id}`} className="hover:underline">
                        {r.campaign.name}
                      </Link>
                      <span className="block text-xs text-muted-foreground">{r.campaign.product.name}</span>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1.5">
                        {r.referrer.creatorProfile?.username ? (
                          <Link href={`/creators/${r.referrer.creatorProfile.username}`} className="hover:underline">
                            {partnerName}
                          </Link>
                        ) : (
                          partnerName
                        )}
                        <Badge variant="secondary">{r.referralLink.partnerType === "CREATOR" ? "Creator" : "Customer"}</Badge>
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(o.amount, o.currency)}
                      {o.quantity > 1 ? <span className="block text-xs text-muted-foreground">× {o.quantity}</span> : null}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{owed ? formatMoney(owed) : "—"}</TableCell>
                    <TableCell>
                      <StatusBadge status={r.status} label={STATUS_LABEL[r.status]} />
                    </TableCell>
                    <TableCell>{r.status === "PURCHASED" ? <ConversionDecision referralId={r.id} owedLabel={owedLabel} /> : null}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
