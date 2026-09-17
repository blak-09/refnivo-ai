import Link from "next/link";
import type { Metadata } from "next";
import type { PayoutStatus } from "@prisma/client";
import { WalletIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, PageHeader, StatusBadge } from "@/components/dashboard/primitives";
import { PayoutReview } from "@/components/admin/admin-actions";
import { requireRole } from "@/lib/auth/guards";
import { formatMoney } from "@/lib/money";
import { listPayoutRequests } from "@/lib/services/payouts";
import { formatDate } from "@/lib/utils/dates";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Payouts" };

const FILTERS: { value: PayoutStatus | "OPEN" | "ALL"; label: string }[] = [
  { value: "OPEN", label: "Open" },
  { value: "PAID", label: "Settled" },
  { value: "REJECTED", label: "Declined" },
  { value: "ALL", label: "All" },
];

export default async function AdminPayoutsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireRole("ADMIN");
  const { status } = await searchParams;
  const filter = FILTERS.some((f) => f.value === status) ? (status as PayoutStatus | "OPEN" | "ALL") : "OPEN";
  const rows = await listPayoutRequests(filter);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payouts & redemptions"
        description="Manual settlement queue. Money never moves through the platform: approve, settle off-platform (UPI / bank / voucher), then mark paid with the external reference. Only that step marks commissions PAID and rewards REDEEMED."
      />

      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter by status">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            role="tab"
            aria-selected={filter === f.value}
            href={f.value === "OPEN" ? "/dashboard/admin/payouts" : `/dashboard/admin/payouts?status=${f.value}`}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              filter === f.value ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent",
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {!rows.length ? (
        <EmptyState icon={WalletIcon} title="Nothing to settle" description="Creators and customers can request settlement once their approved balance reaches the minimum." />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Requested</TableHead>
                <TableHead>Requester</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Review</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="whitespace-nowrap text-xs">{formatDate(p.requestedAt)}</TableCell>
                  <TableCell>
                    {p.user.name}
                    <span className="block text-xs text-muted-foreground">{p.user.email}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{p.kind === "COMMISSION" ? "Commission payout" : "Reward redemption"}</Badge>
                    <span className="block text-xs text-muted-foreground">{p._count.items} entr{p._count.items === 1 ? "y" : "ies"}</span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(p.amount, p.currency)}</TableCell>
                  <TableCell className="text-xs">{p.payoutMethod}</TableCell>
                  <TableCell>
                    <StatusBadge status={p.status} />
                    {p.payoutReference ? <span className="block font-mono text-[10px] text-muted-foreground">{p.payoutReference}</span> : null}
                    {p.adminNote ? (
                      <span className="block max-w-48 truncate text-xs text-muted-foreground" title={p.adminNote}>
                        {p.adminNote}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <PayoutReview payoutId={p.id} status={p.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
