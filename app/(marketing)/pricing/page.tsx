import Link from "next/link";
import { CheckIcon } from "lucide-react";
import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FREE_CAMPAIGN_LIMIT, PLAN_LIST } from "@/lib/config/plans";
import { formatMoney } from "@/lib/money";
import { getCurrentUser } from "@/lib/auth/guards";

export const metadata: Metadata = {
  title: "Pricing",
  description: `Start free with ${FREE_CAMPAIGN_LIMIT} campaign launches. Upgrade for unlimited campaigns and UGC collaborations.`,
};

const FREE_FEATURES = [
  `${FREE_CAMPAIGN_LIMIT} campaign launches`,
  "Unlimited drafts and products",
  "Unique referral links and QR codes",
  "Order verification and a commission / reward ledger",
  "Creator discovery and applications",
];

const SIGN_UP = "/auth/register?role=BRAND_OWNER";

export default async function PricingPage() {
  // A signed-in brand buys (or switches) a plan from Billing; everyone else signs up first.
  const user = await getCurrentUser();
  const isBrand = user?.role === "BRAND_OWNER";
  const planHref = isBrand ? "/dashboard/brand/billing" : SIGN_UP;
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Start free. Upgrade when you grow.</h1>
        <p className="mt-3 text-muted-foreground">
          Every brand can launch its first {FREE_CAMPAIGN_LIMIT} campaigns for free. After that, a monthly plan unlocks unlimited campaign launches and UGC collaborations; Partners is included on every plan. Creators and
          customers never pay, and Refnivo takes no cut of the commissions, rewards or UGC fees you pay your partners.
        </p>
      </div>

      <div className="mt-10 grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Free</CardTitle>
            <CardDescription>Try Refnivo with your first campaigns.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <p>
              <span className="text-3xl font-semibold">{formatMoney(0)}</span> <span className="text-sm text-muted-foreground">no card needed</span>
            </p>
            <FeatureList items={FREE_FEATURES} />
            <Button className="w-full" variant="outline" nativeButton={false} render={<Link href={isBrand ? "/dashboard/brand/campaigns/new" : SIGN_UP} />}>
              {isBrand ? "Create a campaign" : "Start for free"}
            </Button>
          </CardContent>
        </Card>

        {PLAN_LIST.map((plan) => (
          <Card key={plan.key} className={plan.highlight ? "ring-2 ring-primary/40" : undefined}>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-lg">{plan.name}</CardTitle>
                {plan.highlight ? <Badge variant="secondary">Most brands pick this</Badge> : null}
              </div>
              <CardDescription>{plan.tagline}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <p>
                <span className="text-3xl font-semibold">{formatMoney(plan.amount, plan.currency)}</span>{" "}
                <span className="text-sm text-muted-foreground">/ {plan.periodDays} days</span>
              </p>
              <FeatureList items={plan.features} />
              <Button className="w-full" variant={plan.highlight ? "default" : "outline"} nativeButton={false} render={<Link href={planHref} />}>
                {isBrand ? `Choose ${plan.name}` : "Get started"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mx-auto mt-10 max-w-3xl space-y-2 text-center text-sm text-muted-foreground">
        <p>
          A launch is counted when a campaign is published for the first time. Pausing and resuming a campaign does not use another launch, and live campaigns keep
          running if a plan ends. Plans are paid in advance through Razorpay and do not auto-renew.
        </p>
        <p>
          Need store integrations, higher volumes or a dedicated onboarding session?{" "}
          <Link href="/contact" className="text-primary hover:underline">
            Talk to us
          </Link>
          . See the{" "}
          <Link href="/refund-policy" className="text-primary hover:underline">
            refund &amp; cancellation policy
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

function FeatureList({ items }: { items: readonly string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((f) => (
        <li key={f} className="flex items-start gap-2 text-sm">
          <CheckIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          {f}
        </li>
      ))}
    </ul>
  );
}
