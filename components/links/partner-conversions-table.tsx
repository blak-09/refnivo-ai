import Link from "next/link";
import { ReceiptIcon } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, StatusBadge } from "@/components/dashboard/primitives";
import { formatMoney } from "@/lib/money";
import { listPartnerConversions } from "@/lib/services/conversions";
import { formatDate } from "@/lib/utils/dates";

const STATUS_LABEL: Record<string, string> = { PURCHASED: "Pending verification", VERIFIED: "Verified", REJECTED: "Rejected" };

/** Orders attributed to a partner. Shows what they earn — never who bought. */
export async function PartnerConversionsTable({ userId, kind }: { userId: string; kind: "commission" | "reward" }) {
  const rows = await listPartnerConversions(userId);
  if (!rows.length) {
    return (
      <EmptyState
        icon={ReceiptIcon}
        title="No conversions yet"
        description="When a brand records an order that came through your link, it appears here with its verification status."
      />
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Product · brand</TableHead>
            <TableHead className="text-right">Order value</TableHead>
            <TableHead className="text-right">{kind === "commission" ? "Commission" : "Reward"}</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const entries = kind === "commission" ? r.commissions : r.rewards;
            const amount = entries.reduce((s, e) => s + e.amount, 0);
            const ledgerStatus = entries[0]?.status ?? null;
            return (
              <TableRow key={r.id}>
                <TableCell className="whitespace-nowrap">{formatDate(r.conversion?.createdAt ?? r.createdAt)}</TableCell>
                <TableCell>
                  <Link href={`/campaigns/${r.campaign.slug}`} className="hover:underline">
                    {r.campaign.product.name}
                  </Link>
                  <span className="block text-xs text-muted-foreground">
                    {r.campaign.brand.name} · {r.campaign.name}
                  </span>
                </TableCell>
                <TableCell className="text-right tabular-nums">{r.conversion ? formatMoney(r.conversion.amount, r.conversion.currency) : "—"}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {amount ? formatMoney(amount) : "—"}
                  {ledgerStatus ? <span className="block text-[10px] text-muted-foreground uppercase">{ledgerStatus.toLowerCase()}</span> : null}
                </TableCell>
                <TableCell>
                  <StatusBadge status={r.status} label={STATUS_LABEL[r.status]} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
