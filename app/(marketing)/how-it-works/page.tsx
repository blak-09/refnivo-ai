import Link from "next/link";
import type { Metadata } from "next";
import { BadgeCheckIcon, ClapperboardIcon, FileTextIcon, HeartHandshakeIcon, LinkIcon, NotebookPenIcon, PackageIcon, QrCodeIcon, SendIcon, ShoppingCartIcon, UsersIcon, WalletIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CircleCallout } from "@/components/community/community-ui";

export const metadata: Metadata = {
  title: "How it works",
  description: "How Refnivo works: affiliate and referral campaigns paid on verified sales, fixed-fee UGC collaborations, and creator partnerships in one place.",
};

const AFFILIATE_STEPS = [
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
    body: "After buying on the brand's store, the customer confirms their order number on the campaign page. The brand matches it in its store and confirms it — that records and verifies the order in one step. Brands can also record orders by hand. Duplicate order numbers and self-referrals are blocked. Orders placed while a campaign was running can still be recorded for 30 days after it ends or is paused.",
  },
  {
    icon: WalletIcon,
    who: "Everyone",
    title: "Commissions and rewards",
    body: "Brands prepay into their Refnivo wallet. Verifying an order takes the commission or reward from that wallet and approves it in the ledger — pending → approved → paid. After the campaign's refund window, Refnivo pays it to the creator or customer. Partners can contest a rejected or refunded order; every step is audit-logged.",
  },
];

const UGC_STEPS = [
  {
    icon: FileTextIcon,
    who: "Brand",
    title: "Write a brief",
    body: "Describe the content, the deliverables per creator, the fee, how many creators you need and how you will use the content (your own pages or ads, and for how long). Save it as a draft, then publish — publishing needs the Starter or Growth plan.",
  },
  {
    icon: UsersIcon,
    who: "Creators",
    title: "Apply with a pitch",
    body: "Creators see the fee, deliverables and usage rights before they apply, and send a short pitch with portfolio links. The brand accepts the creators it wants; the fee is fixed at that moment.",
  },
  {
    icon: SendIcon,
    who: "Creator",
    title: "Deliver the content",
    body: "Upload photos or share video links (Google Drive, unlisted YouTube and so on). The brand approves or asks for changes — each collaboration includes the first delivery and up to two revision rounds.",
  },
  {
    icon: WalletIcon,
    who: "Brand & creator",
    title: "Approve, pay, confirm",
    body: "After approval the brand pays the creator directly (UPI or bank) and marks the fee as paid with a reference; the creator confirms they received it. Refnivo records it and takes no cut.",
  },
];

const PARTNER_STEPS = [
  {
    icon: HeartHandshakeIcon,
    who: "Automatic",
    title: "Creators become partners",
    body: "When you approve a creator on a campaign, accept a connection or accept them on a UGC brief, they appear in Partners — no manual list to keep.",
  },
  {
    icon: BadgeCheckIcon,
    who: "Platform",
    title: "Results from the ledger",
    body: "Each partner shows clicks, verified sales, sales value, commission and approved UGC fees, per campaign and in total. Only verified orders count; nothing is estimated.",
  },
  {
    icon: NotebookPenIcon,
    who: "Brand",
    title: "Keep private notes",
    body: "Write notes about each creator — what worked, how they like to be paid, what to send next. Notes are visible to your team only, never to the creator.",
  },
];

const FLOWS = [
  { id: "affiliate", icon: LinkIcon, name: "Affiliate & referral campaigns", pay: "Commission per verified sale", steps: AFFILIATE_STEPS },
  { id: "ugc", icon: ClapperboardIcon, name: "UGC collaborations", pay: "Fixed fee after approval", steps: UGC_STEPS },
  { id: "partners", icon: HeartHandshakeIcon, name: "Creator partnerships", pay: "Included in every plan", steps: PARTNER_STEPS },
];

export default function HowItWorksPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
      <div className="text-center">
        <p className="text-sm font-semibold text-primary">How it works</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">Three ways to grow with creators</h1>
        <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
          Refnivo is a creator commerce platform for product brands: pay creators and customers for verified sales, pay creators a fixed fee for content, and keep
          every partnership in one place.
        </p>
        <nav aria-label="Flows" className="mt-6 flex flex-wrap justify-center gap-2">
          {FLOWS.map((f) => (
            <a key={f.id} href={`#${f.id}`} className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium hover:bg-muted">
              <f.icon className="size-4 text-primary" aria-hidden /> {f.name}
            </a>
          ))}
        </nav>
      </div>
      {FLOWS.map((f) => (
        <section key={f.id} id={f.id} aria-labelledby={`${f.id}-title`} className="mt-14 scroll-mt-24">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2 id={`${f.id}-title`} className="flex items-center gap-2 text-xl font-semibold tracking-tight">
              <f.icon className="size-5 text-primary" aria-hidden /> {f.name}
            </h2>
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">{f.pay}</span>
          </div>
          <ol className="mt-5 space-y-4">
            {f.steps.map((s, i) => (
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
                      <h3 className="mt-0.5 font-semibold">{s.title}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ol>
        </section>
      ))}
      <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
        <Button nativeButton={false} render={<Link href="/auth/register?role=BRAND_OWNER" />}>
          List your brand
        </Button>
        <Button variant="outline" nativeButton={false} render={<Link href="/campaigns" />}>
          Browse campaigns
        </Button>
      </div>
      <div className="mx-auto mt-12 grid max-w-4xl gap-3 md:grid-cols-2">
        <CircleCallout audience="CREATOR" placement="how-it-works" />
        <CircleCallout audience="BRAND" placement="how-it-works" />
      </div>
    </div>
  );
}
