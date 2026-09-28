import type { Metadata } from "next";
import { CreditCardIcon, InfoIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, KpiCard, PageHeader, StatusBadge } from "@/components/dashboard/primitives";
import { RefundAction } from "@/components/payments/refund-action";
import { requireRole } from "@/lib/auth/guards";
import { paymentsConfig } from "@/lib/payments";
import { listAllTransactions } from "@/lib/services/payments";
import { PAYMENT_STATUS_LABEL, paymentStatusTone } from "@/lib/utils/payment-labels";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/utils/dates";

export const metadata: Metadata = { title: "Payments" };

/**
 * Admin oversight of inbound payments. Identifiers and status only — no card
 * data exists anywhere in the system, so there is none to show or leak.
 */
export default async function AdminPaymentsPage() {
  await requireRole("ADMIN");
  const config = paymentsConfig();
  const rows = await listAllTransactions();

  const paid = rows.filter((r) => r.status === "PAID" || r.status === "PARTIALLY_REFUNDED");
  const collected = paid.reduce((sum, r) => sum + r.amount - r.refundedAmount, 0);
  const inFlight = rows.filter((r) => ["CREATED", "PENDING", "PROCESSING"].includes(r.status)).length;

  return (
    <div className="space-y-6">
      <PageHeader title="Payments" description="Inbound payments for brand plans. A refund is recorded only once the provider confirms it." />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Net collected" value={formatMoney(collected)} hint="Paid minus refunded" icon={CreditCardIcon} />
        <KpiCard label="Paid transactions" value={paid.length} />
        <KpiCard label="In flight" value={inFlight} hint="Awaiting confirmation" />
        <KpiCard label="Provider" value={config.enabled ? `Razorpay · ${config.mode}` : "Not enabled"} hint={config.enabled ? undefined : config.reason} />
      </div>

      {!config.enabled ? (
        <Card className="border-dashed">
          <CardContent className="flex items-start gap-3 py-2 text-sm">
            <InfoIcon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
            <p className="text-muted-foreground">
              Payments are switched off on this deployment ({config.reason}), so no checkout is offered and no refund can be issued. Existing records stay visible.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>All transactions</CardTitle>
          <CardDescription>Newest first, up to 200.</CardDescription>
        </CardHeader>
        <CardContent>
          {!rows.length ? (
            <EmptyState icon={CreditCardIcon} title="No payments yet" description="Brand plan payments appear here as soon as the first checkout is started." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Brand / user</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Provider IDs</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Refund</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs whitespace-nowrap">{formatDateTime(r.createdAt)}</TableCell>
                      <TableCell>
                        <span className="font-mono text-xs font-medium">{r.reference}</span>
                        <span className="block text-xs text-muted-foreground">{r.planKey ?? r.purpose}</span>
                      </TableCell>
                      <TableCell className="text-xs">
                        {r.brand?.name ?? "—"}
                        <span className="block text-muted-foreground">{r.user.email}</span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(r.amount, r.currency)}
                        {r.refundedAmount > 0 ? <span className="block text-xs text-muted-foreground">−{formatMoney(r.refundedAmount)}</span> : null}
                      </TableCell>
                      <TableCell className="font-mono text-[10px] text-muted-foreground">
                        <span className="block">{r.providerOrderId ?? "—"}</span>
                        <span className="block">{r.providerPaymentId ?? "—"}</span>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={paymentStatusTone(r.status)} label={PAYMENT_STATUS_LABEL[r.status]} />
                        {r.failureCode ? <span className="block text-[10px] text-muted-foreground">{r.failureCode}</span> : null}
                      </TableCell>
                      <TableCell className="text-right">
                        {config.enabled && (r.status === "PAID" || r.status === "PARTIALLY_REFUNDED") ? (
                          <RefundAction transactionId={r.id} reference={r.reference} remaining={r.amount - r.refundedAmount} />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
