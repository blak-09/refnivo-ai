import Link from "next/link";
import type { Metadata } from "next";
import type { WalletEntryType } from "@prisma/client";
import { ArrowDownLeftIcon, ArrowUpRightIcon, ClockIcon, InfoIcon, PiggyBankIcon, ReceiptIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, KpiCard, PageHeader } from "@/components/dashboard/primitives";
import { PaymentMethodsStrip } from "@/components/payments/payment-methods";
import { WalletTopupForm } from "@/components/payments/wallet-topup";
import { requireBrand } from "@/lib/auth/guards";
import { formatMoney } from "@/lib/money";
import { getWalletSummary, pendingWalletExposure, WALLET_TOPUP_MAX, WALLET_TOPUP_MIN, WALLET_TOPUP_PRESETS, walletEnabled, walletTopupAvailable } from "@/lib/services/wallet";
import { formatDateTime } from "@/lib/utils/dates";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Wallet" };

const ENTRY_LABEL: Record<WalletEntryType, string> = {
  TOPUP: "Top-up",
  TOPUP_REFUND: "Top-up refunded",
  ORDER_DEBIT: "Order verified",
  REVERSAL_CREDIT: "Order refunded",
  ADJUSTMENT: "Adjustment by Refnivo",
};

export default async function BrandWalletPage() {
  const { user, brand } = await requireBrand();
  if (!walletEnabled()) {
    return (
      <div className="space-y-6">
        <PageHeader title="Wallet" description="Pre-paid balance that funds creator commissions and customer rewards." />
        <EmptyState icon={PiggyBankIcon} title="The wallet is not switched on" description="Commissions are settled by the Refnivo AI team for now. You will be told before the wallet is enabled for your brand." />
      </div>
    );
  }

  const [summary, exposure] = await Promise.all([getWalletSummary(brand.id, 100), pendingWalletExposure(brand.id)]);
  const shortfall = Math.max(0, exposure.amount - summary.balance);
  const canTopup = walletTopupAvailable();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Wallet"
        description="Add money once and it pays for your campaigns: when you verify an order, the creator's commission and the customer's reward are taken from this balance. If an order is refunded later, the amount comes back."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard label="Available balance" value={formatMoney(summary.balance, summary.currency)} icon={PiggyBankIcon} />
        <KpiCard
          label="Waiting for verification"
          value={formatMoney(exposure.amount)}
          hint={`${exposure.orders} order${exposure.orders === 1 ? "" : "s"} · debited when you verify`}
          icon={ClockIcon}
        />
        <KpiCard label="Needed to verify all" value={shortfall > 0 ? formatMoney(shortfall) : "Covered"} hint={shortfall > 0 ? "Top up to verify every pending order" : "Your balance covers every pending order"} icon={ReceiptIcon} />
      </div>

      {summary.balance < 0 ? (
        <Card className="border-destructive/40">
          <CardContent className="flex items-start gap-3 py-2 text-sm">
            <InfoIcon className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden />
            <p>Your balance is below zero because a top-up was refunded after it was used. Add money to verify new orders.</p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Add money</CardTitle>
          <CardDescription>
            {canTopup
              ? "Pay with UPI, card, netbanking or a wallet. The balance updates as soon as Razorpay confirms the payment."
              : "Online top-ups are not enabled on this deployment yet. Contact the Refnivo AI team to add funds by bank transfer."}
          </CardDescription>
        </CardHeader>
        {canTopup ? (
          <CardContent className="space-y-6">
            <WalletTopupForm presets={WALLET_TOPUP_PRESETS} minMinor={WALLET_TOPUP_MIN} maxMinor={WALLET_TOPUP_MAX} suggestedMinor={shortfall || undefined} payer={{ name: user.name, email: user.email }} />
            <PaymentMethodsStrip />
          </CardContent>
        ) : null}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Wallet activity</CardTitle>
          <CardDescription>
            Every change to your balance. Top-up receipts are under{" "}
            <Link href="/dashboard/brand/billing" className="text-primary hover:underline">
              Billing
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!summary.entries.length ? (
            <EmptyState icon={PiggyBankIcon} title="No activity yet" description="Top-ups, verified orders and refunds will appear here." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>What</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.entries.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="text-xs whitespace-nowrap">{formatDateTime(e.createdAt)}</TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1.5 text-sm">
                          {e.amount >= 0 ? <ArrowDownLeftIcon className="size-3.5 text-emerald-600" aria-hidden /> : <ArrowUpRightIcon className="size-3.5 text-muted-foreground" aria-hidden />}
                          {ENTRY_LABEL[e.type]}
                        </span>
                        {e.note ? <span className="block max-w-80 truncate text-xs text-muted-foreground" title={e.note}>{e.note}</span> : null}
                      </TableCell>
                      <TableCell className={cn("text-right tabular-nums", e.amount >= 0 ? "text-emerald-600" : undefined)}>
                        {e.amount >= 0 ? "+" : "−"}
                        {formatMoney(Math.abs(e.amount), summary.currency)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground tabular-nums">{formatMoney(e.balanceAfter, summary.currency)}</TableCell>
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
