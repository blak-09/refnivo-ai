import Link from "next/link";
import type { Metadata } from "next";
import { CheckIcon, CreditCardIcon, InfoIcon, LockIcon, ReceiptIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, KpiCard, PageHeader, StatusBadge } from "@/components/dashboard/primitives";
import { CheckoutButton } from "@/components/payments/checkout-button";
import { PaymentMethodsStrip } from "@/components/payments/payment-methods";
import { requireBrand } from "@/lib/auth/guards";
import { PLAN_LIST } from "@/lib/config/plans";
import { paymentsConfig } from "@/lib/payments";
import { getBrandSubscription, listUserTransactions, subscriptionIsCurrent } from "@/lib/services/payments";
import { PAYMENT_STATUS_LABEL, paymentStatusTone } from "@/lib/utils/payment-labels";
import { formatMoney } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/utils/dates";

export const metadata: Metadata = { title: "Billing & plan" };

export default async function BillingPage() {
  const { user, brand } = await requireBrand();
  const config = paymentsConfig();
  const [subscription, transactions] = await Promise.all([getBrandSubscription(brand.id), listUserTransactions(user.id)]);
  const current = subscriptionIsCurrent(subscription);
  const currentPlan = PLAN_LIST.find((p) => p.key === subscription?.planKey);

  return (
    <div className="space-y-6">
      <PageHeader title="Billing & plan" description="Your Refnivo plan, payments and receipts. Card details are handled by our payment provider and never stored by Refnivo." />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard label="Current plan" value={current && currentPlan ? currentPlan.name : "No active plan"} hint={current && subscription ? `Renews ${formatDate(subscription.currentPeriodEnd)}` : "Early access — nothing to pay yet"} icon={CreditCardIcon} />
        <KpiCard label="Payments made" value={transactions.filter((t) => t.status === "PAID" || t.status === "PARTIALLY_REFUNDED").length} icon={ReceiptIcon} />
        <KpiCard label="Billing status" value={config.enabled ? (config.mode === "live" ? "Live" : "Test mode") : "Not enabled"} hint={config.enabled ? "Payments are processed by Razorpay" : "Checkout is switched off on this deployment"} icon={LockIcon} />
      </div>

      {config.enabled ? <PaymentMethodsStrip /> : null}

      {!config.enabled ? (
        <Card className="border-dashed">
          <CardContent className="flex items-start gap-3 py-2 text-sm">
            <InfoIcon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
            <div>
              <p className="font-medium">Paid plans are not switched on yet</p>
              <p className="mt-1 text-muted-foreground">
                Refnivo is free during early access, so there is nothing to pay. The plans below are what paid access will look like — you will be told well before
                anything changes, and no payment can be taken until billing is enabled on this deployment.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {current && subscription && currentPlan ? (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>{currentPlan.name} plan</CardTitle>
              <Badge>Active</Badge>
            </div>
            <CardDescription>
              {formatMoney(currentPlan.amount)} every {currentPlan.periodDays} days · paid through {formatDate(subscription.currentPeriodEnd)}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {/* Plans */}
      <div className="grid gap-5 md:grid-cols-2">
        {PLAN_LIST.map((plan) => {
          const isCurrent = current && subscription?.planKey === plan.key;
          return (
            <Card key={plan.key} className={plan.highlight ? "ring-2 ring-primary/30" : undefined}>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                  {plan.highlight ? <Badge variant="secondary">Most brands pick this</Badge> : null}
                  {isCurrent ? <Badge>Your plan</Badge> : null}
                </div>
                <CardDescription>{plan.tagline}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Order summary — exactly what will be charged */}
                <div className="rounded-xl border bg-muted/30 p-3 text-sm">
                  <dl className="space-y-1.5">
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">{plan.name} plan · {plan.periodDays} days</dt>
                      <dd className="tabular-nums">{formatMoney(plan.amount, plan.currency)}</dd>
                    </div>
                    <div className="flex justify-between border-t pt-1.5 font-semibold">
                      <dt>Total payable</dt>
                      <dd className="tabular-nums">
                        {formatMoney(plan.amount, plan.currency)} <span className="font-normal text-muted-foreground">{plan.currency}</span>
                      </dd>
                    </div>
                  </dl>
                  <p className="mt-2 text-xs text-muted-foreground">Taxes, if they apply, are shown by the payment provider before you confirm.</p>
                </div>
                <ul className="space-y-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <CheckIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                      <span className="text-muted-foreground">{f}</span>
                    </li>
                  ))}
                </ul>
                {config.enabled ? (
                  <CheckoutButton
                    planKey={plan.key}
                    planName={plan.name}
                    label={isCurrent ? "Renew plan" : `Proceed to payment`}
                    payer={{ name: user.name, email: user.email }}
                    className="w-full justify-center"
                    variant={plan.highlight ? "default" : "outline"}
                  />
                ) : (
                  <Button className="w-full justify-center" variant="outline" disabled>
                    Not available yet
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Transactions */}
      <Card>
        <CardHeader>
          <CardTitle>Payments</CardTitle>
          <CardDescription>Every payment attempt on this account, with its confirmed status.</CardDescription>
        </CardHeader>
        <CardContent>
          {!transactions.length ? (
            <EmptyState icon={ReceiptIcon} title="No payments yet" description="Payments you make appear here with a receipt reference you can quote to support." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Transaction</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="text-xs whitespace-nowrap">{formatDateTime(t.createdAt)}</TableCell>
                      <TableCell>
                        <span className="font-mono text-xs font-medium">{t.reference}</span>
                        <span className="block text-xs text-muted-foreground">{t.purpose === "WALLET_TOPUP" ? "Wallet top-up" : t.planKey ? `${t.planKey} plan` : t.purpose}</span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(t.amount, t.currency)}
                        {t.refundedAmount > 0 ? <span className="block text-xs text-muted-foreground">{formatMoney(t.refundedAmount)} refunded</span> : null}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={paymentStatusTone(t.status)} label={PAYMENT_STATUS_LABEL[t.status]} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" nativeButton={false} render={<Link href={`/dashboard/brand/billing/${t.id}`} />}>
                          View
                        </Button>
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
