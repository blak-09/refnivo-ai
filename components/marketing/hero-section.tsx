import { SparklesIcon } from "lucide-react";
import { CTAButton } from "@/components/marketing/cta-button";
import { ProductShowcase, type ProductShowcaseProps } from "@/components/marketing/product-showcase";

/** Homepage hero: copy on the left, live product/referral composition on the right. */
export function HeroSection({ showcase }: { showcase: ProductShowcaseProps }) {
  return (
    <section className="relative overflow-hidden bg-linear-to-b from-violet-50/70 via-background to-background">
      <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 h-[28rem] w-[60rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(124,58,237,0.12),transparent)]" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pt-14 pb-16 sm:px-6 lg:grid-cols-2 lg:gap-8 lg:pt-20 lg:pb-24">
        <div className="max-w-xl">
          <p className="inline-flex items-center gap-1.5 rounded-full border border-indigo-100 bg-white/80 px-3 py-1 text-xs font-medium text-indigo-700 shadow-xs">
            <SparklesIcon className="size-3.5" aria-hidden />
            Affiliate &amp; Referral Growth Platform
          </p>
          <h1 className="mt-5 text-4xl leading-[1.08] font-bold tracking-tight text-balance text-foreground sm:text-5xl lg:text-[3.6rem]">
            Brands launch.
            <br />
            Creators share.
            <br />
            <span className="bg-linear-to-r from-violet-600 to-blue-500 bg-clip-text text-transparent">Customers earn.</span>
          </h1>
          <p className="mt-6 max-w-lg text-lg text-pretty text-muted-foreground">
            Refnivo helps brands grow through creators and customers with trackable referral links and QR codes.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <CTAButton href="/campaigns">Explore Campaigns</CTAButton>
            <CTAButton href="/how-it-works" variant="outline">
              How It Works
            </CTAButton>
          </div>
        </div>
        <div className="w-full">
          <ProductShowcase {...showcase} />
        </div>
      </div>
    </section>
  );
}
