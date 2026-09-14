import Link from "next/link";
import { CheckIcon } from "lucide-react";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Pricing" };

const tiers = [
  {
    name: "Starter",
    price: "Free",
    tagline: "For a single brand testing affiliate campaigns.",
    features: ["1 brand, unlimited products", "Up to 3 active campaigns", "Unlimited creator & customer partners", "Referral links, QR codes & click tracking", "Manual order verification & ledger"],
    cta: "Start free",
  },
  {
    name: "Growth",
    price: "Coming soon",
    tagline: "For brands running always-on affiliate programs.",
    features: ["Everything in Starter", "Unlimited campaigns", "AI campaign generator, creator matching & insights", "Store integrations (Shopify / WooCommerce, roadmap)", "Priority support"],
    cta: "Join waitlist",
    highlighted: true,
  },
];

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Simple pricing for local growth</h1>
        <p className="mt-3 text-muted-foreground">
          The MVP is free while we validate with early brands. Commissions and rewards you set are paid by you to
          your partners — Refnivo AI does not take a cut in this version.
        </p>
      </div>
      <div className="mt-10 grid gap-6 md:grid-cols-2">
        {tiers.map((t) => (
          <Card key={t.name} className={t.highlighted ? "ring-primary/40" : undefined}>
            <CardHeader>
              <CardTitle className="text-lg">{t.name}</CardTitle>
              <CardDescription>{t.tagline}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <p className="text-3xl font-semibold">{t.price}</p>
              <ul className="space-y-2">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <CheckIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                className="w-full"
                variant={t.highlighted ? "default" : "outline"}
                nativeButton={false} render={<Link href={t.highlighted ? "/contact" : "/auth/register?role=BRAND_OWNER"} />}
              >
                {t.cta}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
