import Link from "next/link";
import { CheckIcon } from "lucide-react";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Pricing" };

/** What the platform actually does today — no roadmap features are sold here. */
const INCLUDED = [
  "One brand workspace with unlimited products",
  "Unlimited campaigns, creator and customer partners",
  "Unique referral links and QR codes with click tracking",
  "Order recording, verification, refunds and a commission / reward ledger",
  "Creator discovery, applications and performance analytics",
  "Manual payout and redemption workflow reviewed by our team",
  "In-app notifications and CSV exports",
];

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Free during early access</h1>
        <p className="mt-3 text-muted-foreground">
          Refnivo AI is free while we onboard early brands. The commissions and rewards you configure are paid by you to your partners —
          the platform does not take a cut and does not process payments.
        </p>
      </div>
      <div className="mt-10 grid gap-6 md:grid-cols-[1.4fr_1fr]">
        <Card className="ring-primary/40">
          <CardHeader>
            <CardTitle className="text-lg">Early access</CardTitle>
            <CardDescription>Everything the platform offers today, for every brand.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="text-3xl font-semibold">₹0</p>
            <ul className="space-y-2">
              {INCLUDED.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <CheckIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  {f}
                </li>
              ))}
            </ul>
            <Button className="w-full" nativeButton={false} render={<Link href="/auth/register?role=BRAND_OWNER" />}>
              Create a brand account
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Need something specific?</CardTitle>
            <CardDescription>Store integrations, higher volumes or a dedicated onboarding session.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 text-sm text-muted-foreground">
            <p>
              Paid plans will be announced once early access ends; existing brands are told in advance and nothing changes without your
              agreement. Talk to us about your requirements now.
            </p>
            <Button className="w-full" variant="outline" nativeButton={false} render={<Link href="/contact" />}>
              Contact us
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
