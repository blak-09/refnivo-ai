import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRightIcon, CameraIcon, ExternalLinkIcon, HandshakeIcon, MailIcon, MessageCircleQuestionIcon, PlayIcon, SparklesIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CTAButton } from "@/components/marketing/cta-button";
import { ContactForm } from "@/components/marketing/contact-form";
import { CONTACT_EMAIL, mailto, SOCIALS } from "@/lib/config/contact";

export const metadata: Metadata = {
  title: "Contact Refnivo | Get in Touch",
  description:
    "Contact the Refnivo team about brand partnerships, creator collaborations, referral campaigns or general questions. Email refnivo45@gmail.com or send us a message.",
};

/** Entrance animation, disabled for visitors who prefer reduced motion. */
const RISE = "animate-in fade-in slide-in-from-bottom-3 duration-700 fill-mode-both motion-reduce:animate-none";

const OPTIONS = [
  {
    key: "general",
    icon: MessageCircleQuestionIcon,
    eyebrow: "General enquiries",
    title: "Have a question?",
    body: "For general questions, feedback, or information about Refnivo, reach out to our team.",
    cta: "Email Us",
    subject: undefined,
  },
  {
    key: "brands",
    icon: HandshakeIcon,
    eyebrow: "Brands & partnerships",
    title: "Partner with Refnivo",
    body: "Are you a brand looking to work with creators, launch referral campaigns, or build a performance-driven partnership? Let’s talk.",
    cta: "Start a Conversation",
    subject: "Brand Partnership Inquiry – Refnivo",
  },
  {
    key: "creators",
    icon: SparklesIcon,
    eyebrow: "Creators",
    title: "For Creators",
    body: "Looking for brand collaborations and referral opportunities? Connect with Refnivo and discover new opportunities.",
    cta: "Contact Refnivo",
    subject: "Creator Partnership Inquiry – Refnivo",
  },
];

// This lucide version ships no brand glyphs; the platform is named in the card title and button.
const SOCIAL_ICON = { youtube: PlayIcon, instagram: CameraIcon } as const;

const FAQS = [
  {
    q: "How can I contact Refnivo?",
    a: (
      <>
        You can contact the Refnivo team at{" "}
        <a href={mailto()} className="font-medium text-primary underline-offset-4 hover:underline">
          {CONTACT_EMAIL}
        </a>{" "}
        or use the contact form on this page.
      </>
    ),
  },
  {
    q: "I am a brand. Can I partner with Refnivo?",
    a: <>Yes. Brands can contact us to discuss referral campaigns, creator partnerships, and other collaboration opportunities.</>,
  },
  {
    q: "I am a creator. How can I work with brands through Refnivo?",
    a: <>Creators can use Refnivo to discover relevant brand opportunities and participate in referral or partnership campaigns.</>,
  },
  {
    q: "Where can I follow Refnivo?",
    a: <>Follow Refnivo on YouTube and Instagram for updates and announcements.</>,
  },
];

export default function ContactPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b bg-linear-to-b from-violet-50/70 to-background py-16 sm:py-20">
        <div aria-hidden className="pointer-events-none absolute -top-32 left-1/2 size-[32rem] -translate-x-1/2 rounded-full bg-violet-300/20 blur-3xl" />
        <div className={`relative mx-auto max-w-3xl px-4 text-center sm:px-6 ${RISE}`}>
          <p className="inline-flex items-center gap-1.5 rounded-full border border-indigo-100 bg-white/80 px-3 py-1 text-xs font-medium text-indigo-700 shadow-xs">
            <MailIcon className="size-3.5" aria-hidden />
            Contact
          </p>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">Let’s connect</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Have a question, want to partner with Refnivo, or looking to grow your brand through creators and referrals? We’d love to hear from you.
          </p>
          <p className="mt-5 text-sm text-muted-foreground">
            Straight to the inbox:{" "}
            <a href={mailto()} className="font-medium break-all text-primary underline-offset-4 hover:underline">
              {CONTACT_EMAIL}
            </a>
          </p>
        </div>
      </section>

      {/* Contact options */}
      <section className="py-14 sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <ul className="grid gap-5 lg:grid-cols-3">
            {OPTIONS.map((o, i) => (
              <li key={o.key} className={RISE} style={{ animationDelay: `${i * 80}ms` }}>
                <Card className="h-full rounded-2xl transition-shadow hover:shadow-md">
                  <CardContent className="flex h-full flex-col gap-4">
                    <span className="flex size-11 items-center justify-center rounded-xl bg-linear-to-br from-violet-600 to-blue-500 text-white shadow-md shadow-indigo-500/20">
                      <o.icon className="size-5" aria-hidden />
                    </span>
                    <div>
                      <p className="text-xs font-semibold tracking-wide text-indigo-600 uppercase">{o.eyebrow}</p>
                      <h2 className="mt-1 text-lg font-semibold">{o.title}</h2>
                    </div>
                    <p className="flex-1 text-sm leading-6 text-muted-foreground">{o.body}</p>
                    <a href={mailto(o.subject)} className="text-sm font-medium break-all text-primary underline-offset-4 hover:underline">
                      {CONTACT_EMAIL}
                    </a>
                    <Button nativeButton={false} render={<a href={mailto(o.subject)} />} className="w-full justify-center rounded-xl font-semibold" variant="outline">
                      {o.cta} <ArrowRightIcon className="size-4" aria-hidden />
                    </Button>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Form */}
      <section id="message" className="scroll-mt-20 bg-linear-to-b from-background to-violet-50/50 py-14 sm:py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Send us a message</h2>
            <p className="mt-2 text-muted-foreground">Fill out the form and our team will get back to you.</p>
          </div>
          <Card className="mt-8 rounded-2xl">
            <CardContent className="py-2">
              <ContactForm />
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Social */}
      <section className="py-14 sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Follow Refnivo</h2>
            <p className="mt-2 text-muted-foreground">
              Stay connected with Refnivo for product updates, creator opportunities, brand partnerships, and the latest news.
            </p>
          </div>
          <ul className="mt-6 grid gap-5 md:grid-cols-2">
            {SOCIALS.map((s) => {
              const Icon = SOCIAL_ICON[s.key];
              return (
                <li key={s.key}>
                  <Card className="h-full rounded-2xl transition-shadow hover:shadow-md">
                    <CardContent className="flex h-full flex-col gap-4 sm:flex-row sm:items-center">
                      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                        <Icon className="size-5" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold">{s.name}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">{s.description}</p>
                      </div>
                      <Button
                        nativeButton={false}
                        render={<a href={s.href} target="_blank" rel="noreferrer noopener" aria-label={`${s.cta} (opens in a new tab)`} />}
                        variant="outline"
                        className="w-full shrink-0 justify-center rounded-xl font-semibold sm:w-auto"
                      >
                        {s.cta} <ExternalLinkIcon className="size-4" aria-hidden />
                      </Button>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* Prefer email */}
      <section className="pb-14 sm:pb-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Card className="rounded-3xl border-indigo-100/80 bg-linear-to-br from-violet-50 to-blue-50/60 dark:from-violet-950/30 dark:to-blue-950/20">
            <CardContent className="flex flex-col items-start gap-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white text-indigo-600 shadow-sm dark:bg-slate-900">
                  <MailIcon className="size-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold">Prefer email?</h2>
                  <p className="mt-1 text-sm text-muted-foreground">We’re always happy to hear from brands, creators, customers, and potential partners.</p>
                  <a href={mailto()} className="mt-2 inline-block font-medium break-all text-primary underline-offset-4 hover:underline">
                    {CONTACT_EMAIL}
                  </a>
                </div>
              </div>
              <CTAButton href={mailto()} size="default" className="w-full shrink-0 justify-center sm:w-auto">
                Email Refnivo
              </CTAButton>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* FAQ */}
      <section className="pb-14 sm:pb-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Frequently asked</h2>
          <dl className="mt-6 divide-y rounded-2xl border bg-card">
            {FAQS.map((f) => (
              <div key={f.q} className="px-5 py-4">
                <dt className="font-medium">{f.q}</dt>
                <dd className="mt-1.5 text-sm leading-6 text-muted-foreground">{f.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Final CTA */}
      <section className="pb-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="relative overflow-hidden rounded-3xl bg-linear-to-r from-violet-600 to-blue-500 px-8 py-12 text-center text-white shadow-xl shadow-indigo-500/25 sm:px-12 sm:py-16">
            <div aria-hidden className="pointer-events-none absolute -top-20 -right-20 size-64 rounded-full bg-white/10 blur-3xl" />
            <h2 className="relative text-2xl font-bold tracking-tight sm:text-4xl">Let’s build something together</h2>
            <p className="relative mx-auto mt-3 max-w-xl text-white/85">
              Whether you’re a brand, creator, customer, or potential partner, we’re always open to meaningful conversations.
            </p>
            <div className="relative mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <CTAButton href="/auth/register" variant="light">
                Get Started
              </CTAButton>
              <CTAButton href="#message" variant="outline" className="border-white/40 bg-transparent text-white hover:bg-white/10">
                Contact Us
              </CTAButton>
            </div>
            <p className="relative mt-6 text-sm text-white/75">
              Already have an account?{" "}
              <Link href="/dashboard" className="font-medium underline underline-offset-4">
                Open your dashboard
              </Link>
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
