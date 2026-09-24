import type { Metadata } from "next";
import {
  ArrowRightIcon,
  BarChart3Icon,
  Building2Icon,
  CheckCircle2Icon,
  CompassIcon,
  GiftIcon,
  HandshakeIcon,
  LayersIcon,
  LinkIcon,
  MegaphoneIcon,
  QrCodeIcon,
  SearchIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TargetIcon,
  TrendingUpIcon,
  UsersIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { CTAButton } from "@/components/marketing/cta-button";

export const metadata: Metadata = {
  title: "About",
  description: "Refnivo is a referral and partnership platform that connects brands, creators and customers through performance-driven referrals.",
};

/** Shared entrance animation; disabled for visitors who prefer reduced motion. */
const RISE = "animate-in fade-in slide-in-from-bottom-3 duration-700 fill-mode-both motion-reduce:animate-none";

const FRICTION: { audience: string; icon: LucideIcon; points: string[] }[] = [
  {
    audience: "What brands run into",
    icon: Building2Icon,
    points: ["Finding creators who actually fit the product", "Running campaigns across spreadsheets, chats and link tools", "No reliable way to tie a recommendation to an order"],
  },
  {
    audience: "What creators run into",
    icon: SearchIcon,
    points: ["Few places to discover brands worth working with", "Unclear terms and inconsistent payouts", "No shared record of what their referrals produced"],
  },
];

const AUDIENCES: { id: string; label: string; icon: LucideIcon; title: string; items: { icon: LucideIcon; text: string }[]; cta: { href: string; label: string } }[] = [
  {
    id: "for-brands",
    label: "For Brands",
    icon: MegaphoneIcon,
    title: "Run referral campaigns without stitching tools together",
    items: [
      { icon: LayersIcon, text: "Create referral and affiliate campaigns" },
      { icon: Building2Icon, text: "Add products, offers and campaign details" },
      { icon: UsersIcon, text: "Discover and collaborate with creators" },
      { icon: QrCodeIcon, text: "Generate unique referral links and QR codes" },
      { icon: BarChart3Icon, text: "Track clicks, referrals, conversions and performance" },
      { icon: HandshakeIcon, text: "Build a network of creators and customers" },
    ],
    cta: { href: "/auth/register?role=BRAND_OWNER", label: "For Brands" },
  },
  {
    id: "for-creators",
    label: "For Creators",
    icon: SparklesIcon,
    title: "Find brand partnerships and see what your referrals earn",
    items: [
      { icon: CompassIcon, text: "Discover brand partnership opportunities" },
      { icon: CheckCircle2Icon, text: "Apply to relevant campaigns" },
      { icon: LinkIcon, text: "Share unique referral links" },
      { icon: BarChart3Icon, text: "Track campaign performance" },
      { icon: WalletIcon, text: "Earn rewards or commissions from successful referrals" },
      { icon: HandshakeIcon, text: "Build long-term relationships with brands" },
    ],
    cta: { href: "/auth/register?role=CREATOR", label: "For Creators" },
  },
  {
    id: "for-customers",
    label: "For Customers",
    icon: GiftIcon,
    title: "Share what you already recommend, and get rewarded",
    items: [
      { icon: CompassIcon, text: "Discover products through trusted recommendations" },
      { icon: UsersIcon, text: "Share products with friends and communities" },
      { icon: QrCodeIcon, text: "Use referral links or QR codes" },
      { icon: GiftIcon, text: "Earn rewards when eligible referrals generate successful results" },
    ],
    cta: { href: "/auth/register?role=CUSTOMER", label: "Join as a customer" },
  },
];

const FLOW = [
  { icon: TrendingUpIcon, who: "Brands", get: "get growth" },
  { icon: SparklesIcon, who: "Creators", get: "get opportunities" },
  { icon: GiftIcon, who: "Customers", get: "get rewards" },
];

export default function AboutPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b bg-linear-to-b from-violet-50/70 to-background py-16 sm:py-24">
        <div aria-hidden className="pointer-events-none absolute -top-32 left-1/2 size-[32rem] -translate-x-1/2 rounded-full bg-violet-300/20 blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:gap-16">
          <div className={RISE}>
            <p className="inline-flex items-center gap-1.5 rounded-full border border-indigo-100 bg-white/80 px-3 py-1 text-xs font-medium text-indigo-700 shadow-xs">
              <SparklesIcon className="size-3.5" aria-hidden />
              About Refnivo
            </p>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              Referrals that connect brands, creators and customers.
            </h1>
            <p className="mt-4 max-w-xl text-lg text-muted-foreground">
              Refnivo is a referral and partnership platform that connects brands, creators and customers through performance-driven referrals.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <CTAButton href="/auth/register">Get Started</CTAButton>
              <CTAButton href="#for-brands" variant="outline">
                For Brands
              </CTAButton>
              <CTAButton href="#for-creators" variant="outline">
                For Creators
              </CTAButton>
            </div>
          </div>

          {/* Visual: the three sides of the network */}
          <ul className="grid gap-3 delay-150 sm:grid-cols-3 lg:grid-cols-1" aria-label="Who Refnivo is for">
            {AUDIENCES.map((a, i) => (
              <li key={a.id} className={RISE} style={{ animationDelay: `${120 + i * 90}ms` }}>
                <Card className="rounded-2xl border-indigo-100/80 shadow-sm transition-shadow hover:shadow-md">
                  <CardContent className="flex items-center gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-violet-600 to-blue-500 text-white shadow-md shadow-indigo-500/20">
                      <a.icon className="size-5" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{a.label}</p>
                      <p className="text-xs text-muted-foreground">{a.items[0].text}</p>
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Why we exist */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold text-indigo-600">Why we exist</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">The pieces of referral marketing sit in different places</h2>
            <p className="mt-3 text-muted-foreground">
              Brands often struggle to find the right creators, manage referral campaigns, track results, and turn customer recommendations into measurable growth.
              Creators, on the other hand, need better opportunities to discover brands, collaborate with them, and earn through genuine recommendations.
              Refnivo brings these parts together in one platform.
            </p>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {FRICTION.map((f) => (
              <Card key={f.audience} className="rounded-2xl">
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    <f.icon className="size-5 text-indigo-600" aria-hidden />
                    <h3 className="font-semibold">{f.audience}</h3>
                  </div>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {f.points.map((p) => (
                      <li key={p} className="flex gap-2">
                        <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-indigo-400" />
                        {p}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* What Refnivo does */}
      <section id="what-we-do" className="scroll-mt-20 bg-linear-to-b from-background to-violet-50/50 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold text-indigo-600">What Refnivo does</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">One workflow, three sides</h2>
            <p className="mt-3 text-muted-foreground">
              Refnivo helps brands launch and manage referral-based campaigns while giving creators and customers a simple way to participate and earn rewards.
            </p>
          </div>
          <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {AUDIENCES.map((a) => (
              <Card key={a.id} id={a.id} className="scroll-mt-24 rounded-2xl transition-shadow hover:shadow-md">
                <CardContent className="flex h-full flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                      <a.icon className="size-5" aria-hidden />
                    </span>
                    <p className="text-sm font-semibold tracking-wide text-indigo-600 uppercase">{a.label}</p>
                  </div>
                  <h3 className="text-lg font-semibold">{a.title}</h3>
                  <ul className="flex-1 space-y-2.5">
                    {a.items.map((item) => (
                      <li key={item.text} className="flex items-start gap-2.5 text-sm">
                        <item.icon className="mt-0.5 size-4 shrink-0 text-indigo-600" aria-hidden />
                        <span className="text-muted-foreground">{item.text}</span>
                      </li>
                    ))}
                  </ul>
                  <CTAButton href={a.cta.href} size="default" variant="outline" className="w-full justify-center">
                    {a.cta.label} <ArrowRightIcon className="size-4" aria-hidden />
                  </CTAButton>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Why Refnivo */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
            <div className="space-y-5">
              <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600">
                <LayersIcon className="size-4" aria-hidden />
                Why Refnivo
              </p>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">One platform. Real connections. Measurable growth.</h2>
              <p className="text-muted-foreground">
                Instead of managing creator partnerships, referral links, tracking and rewards across multiple tools, Refnivo brings the core workflow into one
                platform — from the campaign a brand publishes to the reward a customer receives.
              </p>
              <ul className="grid gap-2 sm:grid-cols-2">
                {["Unique links and QR codes per partner", "Clicks and referrals tracked in one place", "Orders confirmed before anything is owed", "A shared record both sides can see"].map((item) => (
                  <li key={item} className="flex items-start gap-2 rounded-lg border bg-card px-3 py-2 text-sm shadow-xs">
                    <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-indigo-600" aria-hidden />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* The network in one line */}
            <Card className="rounded-3xl border-indigo-100/80 bg-card/80 shadow-sm">
              <CardContent className="space-y-4 py-2">
                <p className="text-xs font-semibold tracking-wider text-indigo-500 uppercase">We are building a network where</p>
                <ul className="space-y-3">
                  {FLOW.map((f, i) => (
                    <li key={f.who}>
                      <div className="flex items-center gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-violet-600 to-blue-500 text-white shadow-sm">
                          <f.icon className="size-4.5" aria-hidden />
                        </span>
                        <p className="text-sm">
                          <span className="font-semibold">{f.who}</span> <span className="text-muted-foreground">{f.get}</span>
                        </p>
                      </div>
                      {i < FLOW.length - 1 ? <ArrowRightIcon aria-hidden className="mt-3 ml-4.5 size-4 -translate-x-1/2 rotate-90 text-indigo-300" /> : null}
                    </li>
                  ))}
                </ul>
                <p className="border-t pt-4 text-sm text-muted-foreground">
                  Each side only works because the other two do — that is the part we are building.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Vision & mission */}
      <section className="pb-4 sm:pb-8">
        <div className="mx-auto grid max-w-6xl gap-5 px-4 sm:px-6 md:grid-cols-2">
          {[
            {
              icon: TargetIcon,
              label: "Our vision",
              body: "We believe the future of marketing is built around real recommendations, creator communities and measurable performance. Our goal is to make referral and creator-led marketing accessible, transparent and easier to manage for businesses of every size.",
            },
            {
              icon: HandshakeIcon,
              label: "Our mission",
              body: "To build a trusted ecosystem where brands can grow through authentic recommendations, and creators and customers can turn their influence and networks into meaningful opportunities.",
            },
          ].map((b) => (
            <Card key={b.label} className="rounded-2xl">
              <CardContent className="space-y-3">
                <p className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600">
                  <b.icon className="size-4" aria-hidden />
                  {b.label}
                </p>
                <p className="text-[15px] leading-7 text-muted-foreground">{b.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Where we are today — honest status, not a claim */}
      <section className="py-10 sm:py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col gap-3 rounded-2xl border border-dashed px-5 py-5 text-sm text-muted-foreground sm:flex-row sm:items-start sm:gap-4">
            <ShieldCheckIcon className="size-5 shrink-0 text-indigo-600" aria-hidden />
            <p>
              <span className="font-medium text-foreground">Where we are today.</span> Refnivo is early and India-first. Orders are confirmed by the brand before
              any commission or reward is released, payouts are processed by our team, and creator audience numbers are self-reported until verified. Every change
              to money is recorded in an audit log.
            </p>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="pb-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="relative overflow-hidden rounded-3xl bg-linear-to-r from-violet-600 to-blue-500 px-8 py-12 text-center text-white shadow-xl shadow-indigo-500/25 sm:px-12 sm:py-16">
            <div aria-hidden className="pointer-events-none absolute -top-20 -right-20 size-64 rounded-full bg-white/10 blur-3xl" />
            <h2 className="relative text-2xl font-bold tracking-tight sm:text-4xl">Brands, creators and customers — in one place</h2>
            <p className="relative mx-auto mt-3 max-w-xl text-white/85">Create a free account and start with a single campaign or a single referral link.</p>
            <div className="relative mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <CTAButton href="/auth/register" variant="light">
                Get Started
              </CTAButton>
              <CTAButton href="/how-it-works" variant="outline" className="border-white/40 bg-transparent text-white hover:bg-white/10">
                How it works
              </CTAButton>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
