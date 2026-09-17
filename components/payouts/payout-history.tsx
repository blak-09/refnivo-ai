import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/dashboard/primitives";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils/dates";

export type PayoutHistoryRow = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  payoutMethod: string;
  payoutReference: string | null;
  adminNote: string | null;
  requestedAt: Date;
  processedAt: Date | null;
};

const STATUS_LABEL: Record<string, string> = {
  REQUESTED: "Requested",
  UNDER_REVIEW: "Under review",
  APPROVED: "Approved — awaiting settlement",
  PROCESSING: "Processing",
  PAID: "Settled",
  REJECTED: "Declined",
  FAILED: "Failed — will be retried",
};

export function PayoutHistory({ rows }: { rows: PayoutHistoryRow[] }) {
  if (!rows.length) return <p className="text-sm text-muted-foreground">No requests yet.</p>;
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Requested</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Method</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Reference / note</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="whitespace-nowrap">{formatDate(r.requestedAt)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatMoney(r.amount, r.currency)}</TableCell>
              <TableCell>{r.payoutMethod}</TableCell>
              <TableCell>
                <StatusBadge status={r.status} label={STATUS_LABEL[r.status]} />
                {r.processedAt ? <span className="block text-xs text-muted-foreground">{formatDate(r.processedAt)}</span> : null}
              </TableCell>
              <TableCell className="max-w-56 text-xs text-muted-foreground">
                {r.payoutReference ? <span className="block font-mono">{r.payoutReference}</span> : null}
                {r.adminNote ? <span className="block">{r.adminNote}</span> : null}
                {!r.payoutReference && !r.adminNote ? "—" : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
