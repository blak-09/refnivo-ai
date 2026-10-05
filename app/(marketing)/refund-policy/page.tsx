import Link from "next/link";
import type { Metadata } from "next";
import { ReceiptIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Editable, isPlaceholder } from "@/components/marketing/policy-placeholder";
import { CONTACT_EMAIL } from "@/lib/config/contact";
import { PLAN_LIST } from "@/lib/config/plans";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = {
  title: "Refund & Cancellation Policy",
  description: "When payments made to Refnivo are refunded, how to cancel a plan, and how long refunds take.",
};

/**
 * ── OWNER: REVIEW THESE VALUES ─────────────────────────────────────────────
 * The numbers are the business rules this page promises; change them here and
 * the whole page follows. Anything still written as [INSERT …] is shown on the
 * page as "needs to be filled in".
 */
const POLICY = {
  effectiveDate: "5 October 2026",
  lastUpdated: "5 October 2026",
  supportEmail: CONTACT_EMAIL,
  legalEntity: "Refnivo, Hauz Khas, South West Delhi, Delhi 110016, India",
  /** Days after a plan payment during which a full refund can be requested. */
  planRefundWindowDays: 7,
  /** Working days we take to approve and start a refund once requested. */
  initiateWithinWorkingDays: "5–7",
  /** Typical time for the bank / card network to credit it after we start it. */
  bankCreditWorkingDays: "5–7",
};

const SECTIONS = [
  { id: "scope", title: "What this policy covers" },
  { id: "plans", title: "Plan payments" },
  { id: "cancellation", title: "Cancelling a plan" },
  { id: "wallet", title: "Wallet top-ups" },
  { id: "failed-duplicate", title: "Failed or duplicate payments" },
  { id: "how-to-request", title: "How to request a refund" },
  { id: "timelines", title: "Refund timelines" },
  { id: "delivery", title: "Delivery of the service" },
  { id: "not-covered", title: "What is not covered" },
  { id: "contact", title: "Contact us" },
];

function Section({ id, index, title, children }: { id: string; index: number; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 border-t pt-8 first:border-t-0 first:pt-0">
      <h2 className="flex items-baseline gap-3 text-lg font-semibold tracking-tight sm:text-xl">
        <span className="text-sm font-bold text-indigo-500 tabular-nums">{String(index).padStart(2, "0")}</span>
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-[15px] leading-7 text-muted-foreground [&_a]:font-medium [&_a]:text-primary [&_a]:underline-offset-4 hover:[&_a]:underline [&_li]:pl-1 [&_strong]:font-medium [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
        {children}
      </div>
    </section>
  );
}

export default function RefundPolicyPage() {
  const plans = PLAN_LIST.map((p) => `${p.name} (${formatMoney(p.amount, p.currency)} for ${p.periodDays} days)`).join(" and ");
  const days = POLICY.planRefundWindowDays;

  return (
    <>
      <section className="border-b bg-linear-to-b from-violet-50/70 to-background py-12 sm:py-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
            <ol className="flex items-center gap-1.5">
              <li>
                <Link href="/" className="hover:text-foreground">
                  Home
                </Link>
              </li>
              <li aria-hidden>/</li>
              <li className="font-medium text-foreground" aria-current="page">
                Refund &amp; Cancellation Policy
              </li>
            </ol>
          </nav>
          <div className="mt-4 flex flex-col items-start gap-3 sm:flex-row">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 sm:mt-1">
              <ReceiptIcon className="size-5" aria-hidden />
            </span>
            <div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Refund &amp; Cancellation Policy</h1>
              <p className="mt-3 max-w-2xl text-muted-foreground">
                This policy explains when money you pay to Refnivo is refunded, how to cancel, and how long a refund takes to reach you.
              </p>
            </div>
          </div>
          <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-3">
            {[
              { label: "Effective date", value: POLICY.effectiveDate },
              { label: "Last updated", value: POLICY.lastUpdated },
              { label: "Refund requests", value: POLICY.supportEmail },
            ].map((row) => (
              <div key={row.label} className="rounded-xl border bg-card px-3 py-2.5">
                <dt className="text-xs font-medium text-muted-foreground">{row.label}</dt>
                <dd className="mt-1 font-medium break-words">
                  {row.label === "Refund requests" && !isPlaceholder(row.value) ? (
                    <a href={`mailto:${row.value}`} className="text-primary underline-offset-4 hover:underline">
                      {row.value}
                    </a>
                  ) : (
                    <Editable value={row.value} />
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:py-16">
        <div className="lg:grid lg:grid-cols-[220px_1fr] lg:gap-12">
          <nav aria-label="On this page" className="mb-10 lg:sticky lg:top-24 lg:mb-0 lg:self-start">
            <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">On this page</p>
            <ol className="mt-3 space-y-1.5 text-sm">
              {SECTIONS.map((s, i) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="flex gap-2 text-muted-foreground transition-colors hover:text-foreground">
                    <span className="tabular-nums opacity-60">{String(i + 1).padStart(2, "0")}</span>
                    {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="space-y-8">
            <Section id="scope" index={1} title="What this policy covers">
              <p>This policy applies to payments made directly to Refnivo through our payment partner, Razorpay:</p>
              <ul>
                <li>
                  <strong>Plan payments</strong> by brands — currently {plans}.
                </li>
                <li>
                  <strong>Wallet top-ups</strong> by brands, used to pay creator commissions and customer rewards on verified orders.
                </li>
              </ul>
              <p>
                It does not cover products bought from brands through a Refnivo link — see <a href="#not-covered">What is not covered</a>.
              </p>
            </Section>

            <Section id="plans" index={2} title="Plan payments">
              <ul>
                <li>
                  Plans are <strong>prepaid for a fixed period</strong> and <strong>do not renew automatically</strong>. You are only charged when you choose to buy
                  or renew a plan.
                </li>
                <li>
                  You can ask for a <strong>full refund within {days} days</strong> of the payment date. The plan ends when the refund is approved.
                </li>
                <li>
                  After {days} days, plan payments are not refundable, and the plan stays active until the end of the period you paid for.
                </li>
                <li>
                  If we cannot provide the service because of a fault on our side for a significant part of your plan period, contact us and we will refund the
                  affected portion or extend your plan.
                </li>
              </ul>
            </Section>

            <Section id="cancellation" index={3} title="Cancelling a plan">
              <p>
                Because plans do not renew automatically, there is nothing to cancel to avoid future charges — a plan simply ends on the date shown under{" "}
                <strong>Billing &amp; Plan</strong> in your dashboard. To end a plan early with a refund inside the {days}-day window, follow{" "}
                <a href="#how-to-request">How to request a refund</a>.
              </p>
              <p>
                Closing your Refnivo account does not by itself refund a payment; request the refund first if you are eligible.
              </p>
            </Section>

            <Section id="wallet" index={4} title="Wallet top-ups">
              <ul>
                <li>
                  <strong>Unused wallet balance can be refunded at any time</strong> on request, to the original payment method.
                </li>
                <li>
                  Money already used to pay commissions and rewards on orders you verified has been earned by creators and customers, so it is{" "}
                  <strong>not refundable</strong>.
                </li>
                <li>
                  If you mark a verified order as refunded, the commission and reward for that order are returned to your wallet balance automatically; that
                  returned balance can then be refunded like any other unused balance.
                </li>
              </ul>
            </Section>

            <Section id="failed-duplicate" index={5} title="Failed or duplicate payments">
              <ul>
                <li>
                  If a payment fails but money leaves your account, your bank or Razorpay reverses it automatically, usually within{" "}
                  {POLICY.bankCreditWorkingDays} working days. No plan or wallet credit is given for a failed payment.
                </li>
                <li>If you are charged twice for the same plan or top-up, the duplicate is refunded in full — tell us and we will process it.</li>
              </ul>
            </Section>

            <Section id="how-to-request" index={6} title="How to request a refund">
              <p>
                E-mail <a href={`mailto:${POLICY.supportEmail}`} className="font-medium text-primary underline-offset-4 hover:underline">{POLICY.supportEmail}</a> from the e-mail address on your Refnivo account, or use our{" "}
                <Link href="/contact">contact page</Link>, with:
              </p>
              <ul>
                <li>
                  the <strong>payment reference</strong> shown under Billing &amp; Plan (or the Razorpay payment ID from your receipt);
                </li>
                <li>whether it is a plan payment or a wallet top-up, and the amount you want refunded;</li>
                <li>the reason (optional, but it helps us improve).</li>
              </ul>
            </Section>

            <Section id="timelines" index={7} title="Refund timelines">
              <ul>
                <li>
                  We review and, if eligible, start the refund within <strong>{POLICY.initiateWithinWorkingDays} working days</strong> of your request.
                </li>
                <li>
                  Refunds go back to the <strong>original payment method</strong> (UPI, card, netbanking or wallet). Your bank or card network typically credits it
                  within <strong>{POLICY.bankCreditWorkingDays} working days</strong> after that.
                </li>
                <li>Once processed, the refunded amount is shown on the payment under Billing &amp; Plan.</li>
              </ul>
            </Section>

            <Section id="delivery" index={8} title="Delivery of the service">
              <p>
                Refnivo is an online service; nothing is shipped. A plan or wallet top-up is applied to your account as soon as Razorpay confirms the payment —
                usually instantly — and you can see it under Billing &amp; Plan or Wallet. If a confirmed payment has not been applied within 24 hours, contact us
                with the payment reference.
              </p>
            </Section>

            <Section id="not-covered" index={9} title="What is not covered">
              <ul>
                <li>
                  <strong>Products bought from a brand</strong> through a Refnivo link or campaign. You buy from the brand, so returns and refunds follow that
                  brand&apos;s own policy. When a brand records such a refund, the related commission or reward is reversed.
                </li>
                <li>
                  <strong>Creator commissions and customer rewards</strong> are earnings, not payments to Refnivo. Payout questions are handled from your Earnings or
                  Rewards page.
                </li>
              </ul>
            </Section>

            <Section id="contact" index={10} title="Contact us">
              <Card className="rounded-2xl not-prose">
                <CardContent className="space-y-2 text-sm">
                  <p className="text-foreground">
                    Refund and billing questions: <a href={`mailto:${POLICY.supportEmail}`} className="font-medium text-primary underline-offset-4 hover:underline">{POLICY.supportEmail}</a>
                  </p>
                  <p className="text-muted-foreground">
                    Entity and registered address: <Editable value={POLICY.legalEntity} />
                  </p>
                  <p className="text-muted-foreground">
                    See also our <Link href="/terms">Terms of use</Link> and <Link href="/privacy">Privacy Policy</Link>.
                  </p>
                </CardContent>
              </Card>
            </Section>
          </div>
        </div>
      </div>
    </>
  );
}
