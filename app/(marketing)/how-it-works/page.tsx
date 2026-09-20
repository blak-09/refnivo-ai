import Link from "next/link";
import type { Metadata } from "next";
import { LinkIcon, PackageIcon, QrCodeIcon, ShoppingCartIcon, UsersIcon, WalletIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "How it works" };

const STEPS = [
  {
    icon: PackageIcon,
    who: "Brand",
    title: "List products and create a campaign",
    body: "Add your product (name, image, price, purchase URL), then set a creator commission (e.g. 10% of order value) and a customer referral reward. Choose whether creators need approval, set rules, budget and dates, and publish.",
  },
  {
    icon: UsersIcon,
    who: "Creators & customers",
    title: "Discover and join",
    body: "Campaigns appear in the public marketplace with filters for category, commission and trending. Creators apply with their profile (followers, engagement, audience — self-reported); customers join instantly.",
  },
  {
    icon: LinkIcon,
    who: "Platform",
    title: "Unique link and QR code",
    body: "Every partner gets a human-readable code like ARJUN-BOAT-4K7Q, a link (/r/CODE) and a downloadable QR code. Share it on WhatsApp, Instagram, YouTube, X or anywhere else.",
  },
  {
    icon: QrCodeIcon,
    who: "Shopper",
    title: "Click, scan, buy",
    body: "Clicks and QR scans are recorded against an anonymous visitor id with a last-click attribution window (default 30 days). The shopper lands on the campaign page and continues to the brand's store with ?ref=CODE.",
  },
  {
    icon: ShoppingCartIcon,
    who: "Brand",
    title: "Record and verify orders",
    body: "After buying on the brand's store, the customer confirms their order number on the campaign page. The brand matches it in its store and confirms it — that records and verifies the order in one step. Brands can also record orders by hand. Duplicate order numbers, self-referrals and paused campaigns are blocked.",
  },
  {
    icon: WalletIcon,
    who: "Everyone",
    title: "Commissions and rewards",
    body: "Verification releases the creator's commission or the customer's reward into the ledger — pending → approved → paid. Payouts are processed by the platform team; every step is audit-logged.",
  },
];

export default function HowItWorksPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
      <div className="text-center">
        <p className="text-sm font-semibold text-primary">How it works</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">From product listing to verified sales</h1>
        <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
          Refnivo AI is affiliate infrastructure for product brands — with both creators and everyday customers as referral partners.
        </p>
      </div>
      <ol className="mt-10 space-y-4">
        {STEPS.map((s, i) => (
          <li key={s.title}>
            <Card>
              <CardContent className="flex gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <s.icon className="size-5" aria-hidden />
                </span>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">
                    STEP {i + 1} · {s.who}
                  </p>
                  <h2 className="mt-0.5 font-semibold">{s.title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ol>
      <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
        <Button nativeButton={false} render={<Link href="/auth/register?role=BRAND_OWNER" />}>
          List your brand
        </Button>
        <Button variant="outline" nativeButton={false} render={<Link href="/campaigns" />}>
          Browse campaigns
        </Button>
      </div>
    </div>
  );
}
