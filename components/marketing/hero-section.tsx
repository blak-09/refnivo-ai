import { CheckIcon, SparklesIcon } from "lucide-react";
import { CTAButton } from "@/components/marketing/cta-button";
import { DemoDashboard } from "@/components/marketing/demo-dashboard";

/** Homepage hero: positioning copy on the left, a demo-labelled dashboard preview on the right. */
export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-linear-to-b from-violet-50/70 via-background to-background dark:from-violet-950/20">
      <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 h-[28rem] w-[60rem] max-w-[200vw] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(124,58,237,0.12),transparent)]" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pt-12 pb-16 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:pt-20 lg:pb-24">
        <div className="max-w-xl">
          <p className="inline-flex items-center gap-1.5 rounded-full border border-indigo-100 bg-white/80 px-3 py-1 text-xs font-medium text-indigo-700 shadow-xs dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-200">
            <SparklesIcon className="size-3.5" aria-hidden />
            Affiliate, referral &amp; creator partnerships
          </p>
          <h1 className="mt-5 text-4xl leading-[1.08] font-bold tracking-tight text-balance text-foreground sm:text-5xl lg:text-[3.4rem]">
            Turn Referrals and Creator Partnerships Into{" "}
            <span className="bg-linear-to-r from-violet-600 to-blue-500 bg-clip-text text-transparent">Revenue</span>
          </h1>
          <p className="mt-6 max-w-lg text-lg text-pretty text-muted-foreground">
            Refnivo helps brands launch referral campaigns, connect with creators, track conversions and manage performance from one platform.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <CTAButton href="/auth/register">Get Started</CTAButton>
            <CTAButton href="/affiliate-programs" variant="outline">
              Explore Affiliate Programs
            </CTAButton>
          </div>
          <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
            {["Free during early access", "Commission on verified conversions", "Links & QR codes"].map((t) => (
              <li key={t} className="inline-flex items-center gap-1.5">
                <CheckIcon className="size-4 text-emerald-600" aria-hidden />
                {t}
              </li>
            ))}
          </ul>
        </div>
        <div className="w-full">
          <DemoDashboard />
        </div>
      </div>
    </section>
  );
}
