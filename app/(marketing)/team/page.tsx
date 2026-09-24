import Link from "next/link";
import type { Metadata } from "next";
import { CompassIcon, MailIcon, SparklesIcon, UsersRoundIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { CTAButton } from "@/components/marketing/cta-button";
import { TeamCard } from "@/components/marketing/team-card";
import { TEAM } from "@/lib/content/team";

export const metadata: Metadata = {
  title: "Team",
  description: "The team building Refnivo — a platform for brands, creators and customers to grow together through referrals.",
};

/** Entrance animation, disabled for visitors who prefer reduced motion. */
const RISE = "animate-in fade-in slide-in-from-bottom-3 duration-700 fill-mode-both motion-reduce:animate-none";

const STORY = [
  "Refnivo started with a simple observation: recommendations have always influenced what people buy, but the systems behind referrals and creator partnerships are often fragmented.",
  "We are building Refnivo to bring brands, creators and customers into a single ecosystem where partnerships and referrals can be managed more simply — one place to publish a campaign, share a link, confirm an order and settle what is owed.",
];

const PRINCIPLES = [
  { title: "Nothing is owed until an order is confirmed", body: "A click is never counted as a sale. Commissions and rewards move only after the brand confirms the order." },
  { title: "Both sides see the same record", body: "Clicks, referrals, confirmations and payouts are written to one ledger, and every decision is audit-logged." },
  { title: "Say what is actually built", body: "Creator audience numbers are self-reported until verified, and payouts are processed by our team. We label that rather than hide it." },
];

export default function TeamPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b bg-linear-to-b from-violet-50/70 to-background py-16 sm:py-24">
        <div aria-hidden className="pointer-events-none absolute -top-32 left-1/2 size-[32rem] -translate-x-1/2 rounded-full bg-violet-300/20 blur-3xl" />
        <div className={`relative mx-auto max-w-3xl px-4 text-center sm:px-6 ${RISE}`}>
          <p className="inline-flex items-center gap-1.5 rounded-full border border-indigo-100 bg-white/80 px-3 py-1 text-xs font-medium text-indigo-700 shadow-xs">
            <UsersRoundIcon className="size-3.5" aria-hidden />
            Team
          </p>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">Meet the team behind Refnivo</h1>
          <p className="mt-4 text-lg text-muted-foreground">Building a better way for brands, creators and customers to grow together.</p>
          <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
            Refnivo is being built with a simple goal: make referral and creator-led marketing easier to discover, manage, track and scale.
          </p>
        </div>
      </section>

      {/* The people */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold text-indigo-600">The people</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Who you are working with</h2>
          </div>

          {TEAM.length ? (
            <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {TEAM.map((member, i) => (
                <li key={member.slug} className={RISE} style={{ animationDelay: `${i * 80}ms` }}>
                  <TeamCard member={member} />
                </li>
              ))}
            </ul>
          ) : (
            /* Honest empty state: profiles are added in lib/content/team.ts. */
            <Card className="mt-8 rounded-2xl border-dashed">
              <CardContent className="flex flex-col items-start gap-4 py-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                    <UsersRoundIcon className="size-5" aria-hidden />
                  </span>
                  <div>
                    <p className="font-semibold">Profiles are on the way</p>
                    <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                      We are a small team working closely with the first brands and creators on Refnivo. Individual profiles will be published here shortly — until
                      then, the fastest way to reach a person is to write to us.
                    </p>
                  </div>
                </div>
                <CTAButton href="/contact" variant="outline" size="default" className="shrink-0">
                  <MailIcon className="size-4" aria-hidden /> Contact us
                </CTAButton>
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      {/* Building Refnivo */}
      <section className="bg-linear-to-b from-background to-violet-50/50 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
            <div className="space-y-5">
              <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600">
                <SparklesIcon className="size-4" aria-hidden />
                Building Refnivo
              </p>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Why we started</h2>
              {STORY.map((p) => (
                <p key={p.slice(0, 24)} className="text-muted-foreground">
                  {p}
                </p>
              ))}
              <p className="text-sm text-muted-foreground">
                Refnivo is early and India-first. You can read how the platform works end to end on the{" "}
                <Link href="/how-it-works" className="font-medium text-primary underline-offset-4 hover:underline">
                  How it works
                </Link>{" "}
                page.
              </p>
            </div>

            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              {PRINCIPLES.map((p) => (
                <li key={p.title}>
                  <Card className="h-full rounded-2xl">
                    <CardContent className="space-y-1.5">
                      <h3 className="font-semibold">{p.title}</h3>
                      <p className="text-sm leading-6 text-muted-foreground">{p.body}</p>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="relative overflow-hidden rounded-3xl bg-linear-to-r from-violet-600 to-blue-500 px-8 py-12 text-center text-white shadow-xl shadow-indigo-500/25 sm:px-12 sm:py-16">
            <div aria-hidden className="pointer-events-none absolute -top-20 -right-20 size-64 rounded-full bg-white/10 blur-3xl" />
            <h2 className="relative text-2xl font-bold tracking-tight sm:text-4xl">Want to grow with Refnivo?</h2>
            <p className="relative mx-auto mt-3 max-w-xl text-white/85">
              Whether you are a brand looking for creators or a creator looking for new opportunities, Refnivo is built to help you connect and grow.
            </p>
            <div className="relative mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <CTAButton href="/auth/register" variant="light">
                Get Started
              </CTAButton>
              <CTAButton href="/campaigns" variant="outline" className="border-white/40 bg-transparent text-white hover:bg-white/10">
                <CompassIcon className="size-4" aria-hidden /> Explore Refnivo
              </CTAButton>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
