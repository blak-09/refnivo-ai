import Link from "next/link";
import { ClockIcon, ReceiptIcon } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, StatusBadge } from "@/components/dashboard/primitives";
import { ContestOrderButton } from "@/components/links/contest-order-button";
import { formatMoney } from "@/lib/money";
import { CONTEST_WINDOW_DAYS, listPartnerConversions, partnerWaitingSummary } from "@/lib/services/conversions";
import { formatDate } from "@/lib/utils/dates";

const DAY = 24 * 60 * 60 * 1000;
const STATUS_LABEL: Record<string, string> = { PURCHASED: "Waiting for brand", VERIFIED: "Verified", REJECTED: "Rejected", REFUNDED: "Refunded" };

function days(from: Date, to: Date) {
  const n = Math.max(0, Math.floor((to.getTime() - from.getTime()) / DAY));
  return n === 0 ? "today" : n === 1 ? "1 day" : `${n} days`;
}

/** Orders attributed to a partner. Shows what they earn — never who bought. */
export async function PartnerConversionsTable({ userId, kind }: { userId: string; kind: "commission" | "reward" }) {
  const [rows, waiting] = await Promise.all([listPartnerConversions(userId), partnerWaitingSummary(userId)]);
  const now = new Date();
  const parts = [
    waiting.orders ? `${waiting.orders} recorded order${waiting.orders === 1 ? "" : "s"} to verify` : null,
    waiting.claims ? `${waiting.claims} buyer claim${waiting.claims === 1 ? "" : "s"} to confirm` : null,
  ].filter(Boolean);
  const waitingNote = parts.length ? (
    <p className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
      <ClockIcon className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
      <span>Waiting for brands: {parts.join(" and ")}. Brands are reminded after 3 and 7 days.</span>
    </p>
  ) : null;

  if (!rows.length) {
    return (
      <div className="space-y-3">
        {waitingNote}
        <EmptyState
          icon={ReceiptIcon}
          title="No conversions yet"
          description="An order appears here when the brand records it with your referral code, or when a buyer confirms their order on the campaign page and the brand accepts it. Clicks alone never create an order."
        />
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {waitingNote}
      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order date</TableHead>
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
              const payableAt = entries.find((e) => e.payableAt)?.payableAt ?? null;
              const c = r.conversion;
              const decidedAt = c?.reversedAt ?? r.updatedAt;
              const canContest =
                (r.status === "REJECTED" || r.status === "REFUNDED") && !!c && !c.contestedAt && now.getTime() - decidedAt.getTime() <= CONTEST_WINDOW_DAYS * DAY;
              let detail: string | null = null;
              if (r.status === "PURCHASED" && c) detail = `For ${days(c.createdAt, now)}`;
              else if (r.status === "VERIFIED" && payableAt && payableAt > now && ledgerStatus !== "PAID" && ledgerStatus !== "REDEEMED") detail = `Payable from ${formatDate(payableAt)}`;
              else if (r.status === "REJECTED" && r.qualifyingEvent && !r.qualifyingEvent.startsWith("Online order") && !r.qualifyingEvent.startsWith("Customer order claim")) detail = r.qualifyingEvent;
              else if (r.status === "REFUNDED" && c?.reversalReason) detail = c.reversalReason;
              return (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap">{formatDate(c?.orderedAt ?? c?.createdAt ?? r.createdAt)}</TableCell>
                  <TableCell>
                    <Link href={`/campaigns/${r.campaign.slug}`} className="hover:underline">
                      {r.campaign.product.name}
                    </Link>
                    <span className="block text-xs text-muted-foreground">
                      {r.campaign.brand.name} · {r.campaign.name}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{c ? formatMoney(c.amount, c.currency) : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {amount ? formatMoney(amount) : "—"}
                    {ledgerStatus ? <span className="block text-[10px] text-muted-foreground uppercase">{ledgerStatus.toLowerCase()}</span> : null}
                  </TableCell>
                  <TableCell className="min-w-44">
                    <StatusBadge status={r.status} label={STATUS_LABEL[r.status]} />
                    {detail ? <span className="mt-1 block text-xs text-muted-foreground">{detail}</span> : null}
                    {c?.contestedAt ? (
                      <span className="mt-1 block text-xs font-medium">
                        {c.contestResolvedAt
                          ? `Contest ${c.contestOutcome === "UPHELD" ? "accepted" : "closed"}${c.contestNote ? `: ${c.contestNote}` : ""}`
                          : "Contest under review by Refnivo"}
                      </span>
                    ) : canContest ? (
                      <div className="mt-1.5">
                        <ContestOrderButton referralId={r.id} refunded={r.status === "REFUNDED"} />
                      </div>
                    ) : null}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
