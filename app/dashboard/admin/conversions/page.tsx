import type { Metadata } from "next";
import { ReceiptIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, KpiCard, PageHeader, StatusBadge } from "@/components/dashboard/primitives";
import { requireRole } from "@/lib/auth/guards";
import { formatMoney } from "@/lib/money";
import { listAllConversions } from "@/lib/services/admin";
import { formatDate } from "@/lib/utils/dates";

export const metadata: Metadata = { title: "Conversions" };

const STATUS_LABEL: Record<string, string> = { PURCHASED: "Pending verification", VERIFIED: "Verified", REJECTED: "Rejected", REFUNDED: "Refunded" };

export default async function AdminConversionsPage() {
  await requireRole("ADMIN");
  const rows = await listAllConversions();
  const verified = rows.filter((r) => r.referral.status === "VERIFIED");
  const revenue = verified.reduce((s, r) => s + r.amount, 0);
  const refunded = rows.filter((r) => r.referral.status === "REFUNDED").length;
  const pending = rows.filter((r) => r.referral.status === "PURCHASED").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Conversions"
        description="Read-only oversight of every recorded order. Brands verify, reject and refund their own orders; anything suspicious can be followed up in the audit log or by moderating the campaign."
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Orders (latest 200)" value={rows.length} />
        <KpiCard label="Pending verification" value={pending} />
        <KpiCard label="Verified revenue" value={formatMoney(revenue)} />
        <KpiCard label="Refunded" value={refunded} />
      </div>
      {!rows.length ? (
        <EmptyState icon={ReceiptIcon} title="No orders recorded yet" />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Brand / campaign</TableHead>
                <TableHead>Order ref · code</TableHead>
                <TableHead>Partner</TableHead>
                <TableHead className="text-right">Order value</TableHead>
                <TableHead className="text-right">Owed</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((o) => {
                const r = o.referral;
                const owed = [...r.commissions, ...r.rewards].filter((x) => x.status !== "REJECTED" && x.status !== "REVERSED").reduce((s, x) => s + x.amount, 0);
                return (
                  <TableRow key={o.id}>
                    <TableCell className="whitespace-nowrap text-xs">{formatDate(o.createdAt)}</TableCell>
                    <TableCell>
                      {o.brand.name}
                      <span className="block text-xs text-muted-foreground">{r.campaign.name}</span>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {o.orderReference}
                      <span className="block text-[10px] text-muted-foreground">{r.referralLink.code}</span>
                    </TableCell>
                    <TableCell>
                      {r.referrer.name} <Badge variant="secondary">{r.referralLink.partnerType === "CREATOR" ? "Creator" : "Customer"}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(o.amount, o.currency)}</TableCell>
                    <TableCell className="text-right tabular-nums">{owed ? formatMoney(owed) : "—"}</TableCell>
                    <TableCell>
                      <StatusBadge status={r.status} label={STATUS_LABEL[r.status]} />
                      {o.reversedAt ? <span className="block text-xs text-muted-foreground">Reversed {formatDate(o.reversedAt)}</span> : null}
                    </TableCell>
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
