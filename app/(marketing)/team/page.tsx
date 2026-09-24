import type { Metadata } from "next";
import { BarChart3Icon, CompassIcon, GiftIcon, HandshakeIcon, MegaphoneIcon, ScaleIcon, SparklesIcon, UsersRoundIcon } from "lucide-react";
import adilPhoto from "@/public/team/adil-khan.jpg";
import arjunPhoto from "@/public/team/arjun-karpathiya.jpg";
import { Card, CardContent } from "@/components/ui/card";
import { CTAButton } from "@/components/marketing/cta-button";
import { FounderCard, type Founder } from "@/components/marketing/founder-card";

export const metadata: Metadata = {
  title: "Meet the Refnivo Team",
  description: "Meet the team behind Refnivo, building a platform that connects brands, creators, and customers through referral-driven growth.",
};

/** Entrance animation; disabled for visitors who prefer reduced motion. */
const RISE = "animate-in fade-in slide-in-from-bottom-3 duration-700 fill-mode-both motion-reduce:animate-none";

const FOUNDERS: Founder[] = [
  {
    name: "Arjun Karpathiya",
    role: "Founder & CMO",
    photo: arjunPhoto,
    alt: "Arjun Karpathiya – Founder & CMO at Refnivo",
    bio: [
      "Arjun Karpathiya is the Founder & CMO of Refnivo, focused on product vision, brand growth, marketing, partnerships, and building the Refnivo ecosystem for brands and creators.",
      "He works across product strategy, marketing, creator partnerships, and community building, with a focus on creating practical tools that connect businesses with creators and customers.",
    ],
    linkedin: "https://www.linkedin.com/in/arjunkumarsingh2017/",
  },
  {
    name: "Adil Khan",
    role: "Co-Founder & CTO",
    photo: adilPhoto,
    alt: "Adil Khan – Co-Founder & CTO at Refnivo",
    bio: [
      "Adil Khan is the Co-Founder & CTO of Refnivo, responsible for the technology, engineering, and technical direction behind the platform.",
      "He focuses on building the technology infrastructure and product systems that power Refnivo's brand, creator, referral, and campaign experiences.",
    ],
    linkedin: "https://www.linkedin.com/in/adilkhanasap/",
  },
];

const SIDES = [
  { icon: MegaphoneIcon, title: "Brands", body: "Launch campaigns, work with creators, and turn referrals into measurable growth." },
  { icon: SparklesIcon, title: "Creators", body: "Discover brand opportunities, share products, and participate in performance-driven partnerships." },
  { icon: GiftIcon, title: "Customers", body: "Discover products through trusted recommendations and participate in referral experiences." },
];

const BELIEFS = [
  { icon: HandshakeIcon, title: "Authentic connections", body: "Real recommendations and meaningful creator-brand relationships matter." },
  { icon: BarChart3Icon, title: "Measurable growth", body: "Partnerships should be trackable, transparent, and focused on real outcomes." },
  { icon: ScaleIcon, title: "Built for everyone", body: "Brands, creators, and customers should all have a simple way to participate." },
];

export default function TeamPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b bg-linear-to-b from-violet-50/70 to-background py-16 sm:py-20">
        <div aria-hidden className="pointer-events-none absolute -top-32 left-1/2 size-[32rem] -translate-x-1/2 rounded-full bg-violet-300/20 blur-3xl" />
        <div className={`relative mx-auto max-w-3xl px-4 text-center sm:px-6 ${RISE}`}>
          <p className="inline-flex items-center gap-1.5 rounded-full border border-indigo-100 bg-white/80 px-3 py-1 text-xs font-medium text-indigo-700 shadow-xs">
            <UsersRoundIcon className="size-3.5" aria-hidden />
            Team
          </p>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">Meet the team behind Refnivo</h1>
          <p className="mt-4 text-lg text-muted-foreground">Building the future of brand, creator, and referral-driven growth.</p>
          <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
            Refnivo is built by a team focused on making brand partnerships, creator collaborations, and referral marketing simpler, more transparent, and more
            accessible.
          </p>
        </div>
      </section>

      {/* Leadership */}
      <section className="py-14 sm:py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <h2 className="sr-only">Leadership</h2>
          <ul className="grid gap-6 md:grid-cols-2">
            {FOUNDERS.map((f, i) => (
              <li key={f.name} className={RISE} style={{ animationDelay: `${i * 100}ms` }}>
                <FounderCard founder={f} priority />
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Founder story */}
      <section className="bg-linear-to-b from-background to-violet-50/50 py-14 sm:py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Building Refnivo together</h2>
          <div className="mt-4 space-y-4 text-[15px] leading-7 text-muted-foreground">
            <p>
              Refnivo brings together business, marketing, and technology with one goal: making referral and creator-led growth easier to build and manage.
            </p>
            <p>
              Arjun focuses on the product vision, marketing, brand, and partnerships, while Adil leads the technical direction and engineering behind the
              platform.
            </p>
            <p>
              Together, they are building Refnivo as a platform where brands can discover growth opportunities, creators can build meaningful partnerships, and
              customers can participate in referral-driven experiences.
            </p>
          </div>
        </div>
      </section>

      {/* What we're building */}
      <section className="py-14 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-indigo-600">What we’re building</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">One platform. Three sides of growth.</h2>
          </div>
          <ul className="mt-8 grid gap-5 md:grid-cols-3">
            {SIDES.map((s) => (
              <li key={s.title}>
                <Card className="h-full rounded-2xl transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
                  <CardContent className="space-y-3">
                    <span className="flex size-11 items-center justify-center rounded-xl bg-linear-to-br from-violet-600 to-blue-500 text-white shadow-md shadow-indigo-500/20">
                      <s.icon className="size-5" aria-hidden />
                    </span>
                    <h3 className="text-lg font-semibold">{s.title}</h3>
                    <p className="text-sm leading-6 text-muted-foreground">{s.body}</p>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* What we believe */}
      <section className="pb-14 sm:pb-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-indigo-600">Our approach</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">What we believe</h2>
          </div>
          <ul className="mt-8 grid gap-5 md:grid-cols-3">
            {BELIEFS.map((b) => (
              <li key={b.title}>
                <Card className="h-full rounded-2xl border-dashed transition-colors hover:border-primary/30">
                  <CardContent className="space-y-2">
                    <b.icon className="size-5 text-indigo-600" aria-hidden />
                    <h3 className="font-semibold">{b.title}</h3>
                    <p className="text-sm leading-6 text-muted-foreground">{b.body}</p>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="pb-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="relative overflow-hidden rounded-3xl bg-linear-to-r from-violet-600 to-blue-500 px-8 py-12 text-center text-white shadow-xl shadow-indigo-500/25 sm:px-12 sm:py-16">
            <div aria-hidden className="pointer-events-none absolute -top-20 -right-20 size-64 rounded-full bg-white/10 blur-3xl" />
            <h2 className="relative text-2xl font-bold tracking-tight sm:text-4xl">Want to build with us?</h2>
            <p className="relative mx-auto mt-3 max-w-xl text-white/85">
              Whether you’re a brand, creator, customer, or potential partner, we’d love to have you be part of the Refnivo journey.
            </p>
            <div className="relative mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <CTAButton href="/auth/register" variant="light">
                Get Started
              </CTAButton>
              <CTAButton href="/contact" variant="outline" className="border-white/40 bg-transparent text-white hover:bg-white/10">
                <CompassIcon className="size-4" aria-hidden /> Contact Us
              </CTAButton>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
