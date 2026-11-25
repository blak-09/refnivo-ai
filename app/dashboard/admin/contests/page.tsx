import Link from "next/link";
import type { Metadata } from "next";
import { ScaleIcon } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, PageHeader, StatusBadge } from "@/components/dashboard/primitives";
import { ContestResolution } from "@/components/admin/admin-actions";
import { requireRole } from "@/lib/auth/guards";
import { formatMoney } from "@/lib/money";
import { listContests } from "@/lib/services/conversions";
import { formatDate, formatDateTime } from "@/lib/utils/dates";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Contests" };

export default async function AdminContestsPage({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  await requireRole("ADMIN");
  const { state: raw } = await searchParams;
  const state = raw === "resolved" ? "RESOLVED" : "OPEN";
  const rows = await listContests(state);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contests"
        description="Orders a creator or customer disputes after the brand rejected or refunded them. Check the brand's proof (refund, cancellation, store record), then uphold or dismiss. Both sides see your note; every decision is audited."
      />
      <div className="flex gap-2 text-sm">
        {[
          { key: "OPEN", label: "Open", href: "/dashboard/admin/contests" },
          { key: "RESOLVED", label: "Resolved", href: "/dashboard/admin/contests?state=resolved" },
        ].map((t) => (
          <Link key={t.key} href={t.href} className={cn("rounded-full border px-3 py-1", state === t.key ? "border-primary bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:text-foreground")}>
            {t.label}
          </Link>
        ))}
      </div>
      {!rows.length ? (
        <EmptyState icon={ScaleIcon} title={state === "OPEN" ? "No open contests" : "No resolved contests yet"} />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Partner</TableHead>
                <TableHead>Brand decision</TableHead>
                <TableHead>Partner says</TableHead>
                <TableHead>{state === "OPEN" ? "Decide" : "Outcome"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.referral.id} className="align-top">
                  <TableCell>
                    <span className="font-mono font-medium">{r.orderReference}</span>
                    <span className="block text-xs text-muted-foreground">
                      {r.brand.name} · {r.referral.campaign.name}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {formatMoney(r.amount, r.currency)} · ordered {formatDate(r.orderedAt ?? r.createdAt)}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs">
                    {r.referral.referrer.name}
                    <span className="block text-muted-foreground">
                      {r.referral.referralLink.partnerType === "CREATOR" ? "Creator" : "Customer"} · <span className="font-mono">{r.referral.referralLink.code}</span>
                    </span>
                  </TableCell>
                  <TableCell className="max-w-56 text-xs">
                    <StatusBadge status={r.referral.status} />
                    <span className="mt-1 block text-muted-foreground">{r.reversalReason ?? r.referral.qualifyingEvent ?? "No reason given"}</span>
                  </TableCell>
                  <TableCell className="max-w-72 text-xs whitespace-pre-line">
                    {r.contestReason}
                    <span className="mt-1 block text-muted-foreground">{r.contestedAt ? formatDateTime(r.contestedAt) : null}</span>
                  </TableCell>
                  <TableCell>
                    {state === "OPEN" ? (
                      <ContestResolution referralId={r.referral.id} status={r.referral.status} />
                    ) : (
                      <span className="text-xs">
                        <span className="font-medium">{r.contestOutcome === "UPHELD" ? "Upheld" : "Dismissed"}</span>
                        {r.contestResolvedAt ? ` · ${formatDate(r.contestResolvedAt)}` : null}
                        {r.contestNote ? <span className="block text-muted-foreground">{r.contestNote}</span> : null}
                      </span>
                    )}
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
