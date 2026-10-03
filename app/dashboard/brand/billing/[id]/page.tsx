import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { PaymentStatus } from "@prisma/client";
import { AlertCircleIcon, ArrowLeftIcon, CheckCircle2Icon, ClockIcon, Loader2Icon, XCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader, StatusBadge } from "@/components/dashboard/primitives";
import { PaymentStatusWatcher } from "@/components/payments/payment-status";
import { CheckoutButton } from "@/components/payments/checkout-button";
import { requireBrand } from "@/lib/auth/guards";
import { getPlan } from "@/lib/config/plans";
import { paymentsEnabled } from "@/lib/payments";
import { getUserTransaction, isOpen } from "@/lib/services/payments";
import { PAYMENT_STATUS_LABEL, paymentStatusTone } from "@/lib/utils/payment-labels";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/utils/dates";

export const metadata: Metadata = { title: "Payment" };

/** Headline, tone and copy for each outcome. Never announces success on its own. */
function present(status: PaymentStatus) {
  switch (status) {
    case "PAID":
      return { icon: CheckCircle2Icon, tone: "text-emerald-600", title: "Payment successful", body: "Your payment has been successfully confirmed." };
    case "PARTIALLY_REFUNDED":
      return { icon: CheckCircle2Icon, tone: "text-emerald-600", title: "Payment successful", body: "Part of this payment has since been refunded." };
    case "REFUNDED":
      return { icon: AlertCircleIcon, tone: "text-muted-foreground", title: "Payment refunded", body: "This payment was refunded in full." };
    case "FAILED":
      return { icon: XCircleIcon, tone: "text-destructive", title: "Payment failed", body: "We couldn't complete your payment. Nothing was charged to your plan or wallet." };
    case "CANCELLED":
      return { icon: XCircleIcon, tone: "text-muted-foreground", title: "Payment cancelled", body: "Your payment was cancelled. No successful payment was recorded." };
    case "EXPIRED":
      return { icon: ClockIcon, tone: "text-muted-foreground", title: "Checkout expired", body: "This checkout was not completed in time. You can start a new one." };
    default:
      return {
        icon: Loader2Icon,
        tone: "text-primary",
        title: "Processing payment…",
        body: "Please don't close or refresh this window while we confirm your payment. If you have already closed the payment window, this page updates by itself.",
      };
  }
}

export default async function PaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requireBrand();
  const { id } = await params;
  // Ownership is part of the query: another brand's transaction is simply not found.
  const payment = await getUserTransaction(user.id, id);
  if (!payment) notFound();

  const view = present(payment.status);
  const open = isOpen(payment.status);
  const plan = getPlan(payment.planKey);
  const isTopup = payment.purpose === "WALLET_TOPUP";
  const canRetry = ["FAILED", "CANCELLED", "EXPIRED"].includes(payment.status) && (!!plan || isTopup) && paymentsEnabled();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Payment"
        description={<Link href="/dashboard/brand/billing" className="inline-flex items-center gap-1 text-xs text-primary hover:underline"><ArrowLeftIcon className="size-3" aria-hidden /> Back to billing</Link>}
      />

      <Card>
        <CardContent className="space-y-6 py-4 text-center">
          <view.icon className={`mx-auto size-12 ${view.tone} ${open ? "animate-spin motion-reduce:animate-none" : ""}`} aria-hidden />
          <div>
            <h2 className="text-xl font-semibold tracking-tight">{view.title}</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{view.body}</p>
          </div>

          <dl className="mx-auto max-w-sm space-y-2 rounded-xl border bg-muted/30 p-4 text-left text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Amount</dt>
              <dd className="font-semibold tabular-nums">{formatMoney(payment.amount, payment.currency)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Reference</dt>
              <dd className="font-mono text-xs">{payment.reference}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Transaction ID</dt>
              <dd className="font-mono text-xs break-all">{payment.id}</dd>
            </div>
            {payment.providerPaymentId ? (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Payment ID</dt>
                <dd className="font-mono text-xs break-all">{payment.providerPaymentId}</dd>
              </div>
            ) : null}
            {isTopup ? (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">For</dt>
                <dd>Wallet top-up</dd>
              </div>
            ) : plan ? (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Plan</dt>
                <dd>{plan.name}</dd>
              </div>
            ) : null}
            {payment.method ? (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Method</dt>
                <dd className="uppercase">{payment.method}</dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{payment.paidAt ? "Paid at" : "Started"}</dt>
              <dd>{formatDateTime(payment.paidAt ?? payment.createdAt)}</dd>
            </div>
            {payment.refundedAmount > 0 ? (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Refunded</dt>
                <dd className="tabular-nums">{formatMoney(payment.refundedAmount, payment.currency)}</dd>
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-4 border-t pt-2">
              <dt className="text-muted-foreground">Status</dt>
              <dd>
                <StatusBadge status={paymentStatusTone(payment.status)} label={PAYMENT_STATUS_LABEL[payment.status]} />
              </dd>
            </div>
          </dl>

          {payment.status === "FAILED" ? (
            // Deliberately generic: provider detail stays in the server log.
            <p className="text-xs text-muted-foreground">If money left your account, your bank returns it automatically — usually within a few working days.</p>
          ) : null}

          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <Button nativeButton={false} render={<Link href={isTopup ? "/dashboard/brand/wallet" : "/dashboard/brand"} />} variant={payment.status === "PAID" ? "default" : "outline"} className="w-full sm:w-auto">
              {isTopup ? "Go to wallet" : "Go to dashboard"}
            </Button>
            <Button nativeButton={false} render={<Link href="/dashboard/brand/billing" />} variant="outline" className="w-full sm:w-auto">
              View transactions
            </Button>
            {canRetry && isTopup ? (
              <CheckoutButton topupAmountMinor={payment.amount} label="Retry payment" payer={{ name: user.name, email: user.email }} className="w-full sm:w-auto" />
            ) : canRetry && plan ? (
              <CheckoutButton planKey={plan.key} planName={plan.name} label="Retry payment" payer={{ name: user.name, email: user.email }} className="w-full sm:w-auto" />
            ) : null}
            <PaymentStatusWatcher transactionId={payment.id} open={open} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
