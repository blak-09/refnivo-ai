import Link from "next/link";
import {
  ArrowRightIcon,
  BadgeCheckIcon,
  CheckIcon,
  ClipboardListIcon,
  CompassIcon,
  FileSpreadsheetIcon,
  ScrollTextIcon,
  SearchXIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UnlinkIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";
import { HowItWorksStepper } from "@/components/marketing/home/how-it-works-stepper";
import { HomeFaq } from "@/components/marketing/home/faq";
import { BrandMockup, CreatorMockup } from "@/components/marketing/home/mockups";
import { AudienceCards, HeroShowcase, PhotoFrame, PHOTOS } from "@/components/marketing/home/photos";
import { ActionLink, CheckList, Emph, SectionHeader, StatCard, StatusPill } from "@/components/marketing/home/primitives";
import { CountUp, Reveal } from "@/components/marketing/home/reveal";
import { CommunityHomeBand } from "@/components/community/community-ui";
import { ProductThumb } from "@/components/products/product-thumb";
import { shortCommission } from "@/components/campaigns/campaign-summary";
import { formatMoney } from "@/lib/money";
import { getLandingData, getMarketplaceQr } from "@/lib/services/landing";

const PROBLEMS = {
  brands: [
    { icon: SearchXIcon, title: "Finding the right creators", body: "It is hard to find creators who actually fit the product." },
    { icon: FileSpreadsheetIcon, title: "Campaigns spread across tools", body: "Briefs, links and payouts live across spreadsheets, chats and separate link tools." },
    { icon: UnlinkIcon, title: "No proof of sales", body: "There is no reliable way to tie a recommendation to a real order." },
  ],
  creators: [
    { icon: CompassIcon, title: "Few brands worth working with", body: "There are few places to discover brands with clear, fair offers." },
    { icon: WalletIcon, title: "Unclear terms and payouts", body: "Rates change, terms are vague and payouts arrive late — or not at all." },
    { icon: ClipboardListIcon, title: "No shared record", body: "Nothing shows both sides what a creator's referrals actually produced." },
  ],
} as const;

const SOLUTIONS = [
  { n: "01", title: "Referral & affiliate campaigns", body: "Launch a campaign per product with its own commission, customer reward and rules. Partners share unique links and QR codes.", status: "live" as const },
  { n: "02", title: "Creator partnerships", body: "Review creator applications, approve the right partners and keep every collaboration and its results in one place.", status: "early" as const },
  { n: "03", title: "UGC collaborations", body: "Brief creators for content you can use in your own marketing, with the same transparent terms.", status: "next" as const },
];

const FOR_BRANDS = [
  "Multi-step campaign builder: product, rewards, rules",
  "Creator applications and approval",
  "Link and QR attribution for every partner",
  "Tracking and analytics by date range",
  "Commission and reward ledger, with CSV export",
];

const FOR_CREATORS = [
  "Discover live campaigns with the commission shown up front",
  "Join in one click and get your unique link and QR code",
  "Click and conversion analytics for every link",
  "Pending, approved and paid commission at a glance",
];

const TRUST = [
  { icon: BadgeCheckIcon, title: "Orders confirmed before anything is owed", body: "A click is never a sale. The brand verifies each order first." },
  { icon: UsersIcon, title: "A shared record both sides can see", body: "Brands and partners see the same orders, statuses and amounts." },
  { icon: ScrollTextIcon, title: "Every change to money is audit-logged", body: "Approvals, refunds and payouts are recorded with who did what." },
  { icon: ShieldCheckIcon, title: "Payments secured by Razorpay", body: "Card, UPI and netbanking details never touch Refnivo." },
];

const INCLUDED = [
  "Unlimited products, campaigns and partners",
  "Unique referral links and QR codes",
  "Order verification and a commission ledger",
  "Creator discovery, applications and analytics",
  "CSV exports and in-app notifications",
];

export default async function LandingPage() {
  // Cached for 60 s and bounded to what is shown (lib/services/landing.ts); renders even if the database is down.
  const [{ campaigns }, qrDataUrl] = await Promise.all([getLandingData(), getMarketplaceQr()]);
  const liveCampaigns = campaigns.slice(0, 3);

  return (
    <>
      {/* ── 1. Hero (centred headline over a full-bleed photo strip) ──────── */}
      <section className="relative overflow-hidden" aria-labelledby="hero-heading">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[44rem] bg-linear-to-b from-violet-50 via-indigo-50/50 to-background dark:from-violet-950/25 dark:via-background" />
        <div aria-hidden className="pointer-events-none absolute top-24 left-1/2 -z-10 h-72 w-[48rem] max-w-full -translate-x-1/2 rounded-full bg-violet-300/25 blur-3xl dark:bg-violet-700/15" />
        <div className="mx-auto max-w-4xl px-4 pt-14 text-center sm:px-6 sm:pt-20 lg:pt-24">
          <p className="inline-flex items-center gap-1.5 rounded-full border border-primary/15 bg-background/80 px-3 py-1 text-xs font-medium text-accent-foreground shadow-xs">
            <SparklesIcon className="size-3.5" aria-hidden />
            India-first referral &amp; affiliate platform
          </p>
          <h1 id="hero-heading" className="text-display mt-6 text-foreground">
            The referral and affiliate platform for brands that grow on <Emph>verified</Emph> sales.
          </h1>
          <p className="text-lede mx-auto mt-6 max-w-2xl text-muted-foreground">
            Brands, creators and customers in one workflow — launch campaigns, share unique links and QR codes, and record commission only on orders
            the brand confirms.
          </p>
          <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
            <ActionLink href="/auth/register">
              Get Started <ArrowRightIcon className="size-4" aria-hidden />
            </ActionLink>
            <ActionLink href="/campaigns" variant="outline">
              Explore Campaigns
            </ActionLink>
          </div>
          <ul className="mt-7 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
            {["Free during early access", "Commission only on verified orders", "Links and QR codes"].map((t) => (
              <li key={t} className="inline-flex items-center gap-1.5">
                <CheckIcon className="size-4 text-emerald-600" aria-hidden />
                {t}
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-14 pb-16 sm:mt-16 sm:pb-24">
          <HeroShowcase qrDataUrl={qrDataUrl} />
        </div>
      </section>

      {/* ── Who it is for (photo cards) ─────────────────────────────────── */}
      <section aria-labelledby="audience-heading" className="pb-20 sm:pb-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeader
            id="audience-heading"
            eyebrow="Built for everyone in the sale"
            align="center"
            title={
              <>
                Brands, creators and customers — <Emph>one</Emph> platform.
              </>
            }
            className="mb-12"
          />
          <AudienceCards />
        </div>
      </section>

      {/* ── 2. Problem ──────────────────────────────────────────────────── */}
      <section id="product" aria-labelledby="problem-heading" className="section-y scroll-mt-20 bg-muted/40">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeader
            id="problem-heading"
            eyebrow="The problem"
            align="center"
            title={
              <>
                Referral marketing is scattered. Refnivo puts it in <Emph>one place</Emph>.
              </>
            }
          />
          <div className="mt-14 grid gap-6 md:grid-cols-2">
            {(["brands", "creators"] as const).map((side) => (
              <Reveal key={side} className="rounded-3xl border bg-card p-6 sm:p-8">
                <p className="eyebrow">{side === "brands" ? "For brands" : "For creators"}</p>
                <ul className="mt-5 grid gap-4">
                  {PROBLEMS[side].map((p) => (
                    <li key={p.title} className="flex gap-4">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                        <p.icon className="size-5" aria-hidden />
                      </span>
                      <span>
                        <span className="block font-semibold">{p.title}</span>
                        <span className="mt-0.5 block text-[15px] leading-6 text-muted-foreground">{p.body}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── 3. Solution ─────────────────────────────────────────────────── */}
      <section aria-labelledby="solution-heading" className="section-y">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeader
            id="solution-heading"
            eyebrow="The solution"
            title={
              <>
                One platform for campaigns, partners and <Emph>verified</Emph> sales.
              </>
            }
            lede="Brands launch campaigns, creators and customers promote with unique links and QR codes, and commission is recorded only after the brand verifies the order."
          />
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {SOLUTIONS.map((s, i) => (
              <Reveal
                key={s.n}
                delay={i * 80}
                className={
                  i === 0
                    ? "flex flex-col rounded-3xl bg-ink p-6 text-ink-foreground shadow-xl shadow-indigo-950/20 transition-transform hover:-translate-y-1 sm:p-8"
                    : "flex flex-col rounded-3xl border bg-card p-6 transition-[transform,box-shadow] hover:-translate-y-1 hover:shadow-lg sm:p-8"
                }
              >
                <div className="flex items-center justify-between">
                  <span className={i === 0 ? "text-sm font-bold text-violet-300 tabular-nums" : "text-sm font-bold text-primary tabular-nums"}>{s.n}</span>
                  <StatusPill status={s.status} className={i === 0 ? "bg-emerald-400/15 text-emerald-300 ring-emerald-400/30" : undefined} />
                </div>
                <h3 className="mt-6 text-xl font-semibold tracking-tight">{s.title}</h3>
                <p className={i === 0 ? "mt-2 text-[15px] leading-6 text-white/75" : "mt-2 text-[15px] leading-6 text-muted-foreground"}>{s.body}</p>
              </Reveal>
            ))}
          </div>
          <p className="mt-5 flex items-center justify-center gap-2 rounded-2xl bg-gradient-brand px-5 py-4 text-center text-[15px] font-semibold text-white">
            <BadgeCheckIcon className="size-5 shrink-0" aria-hidden />
            Commission is owed only when a verified sale happens.
          </p>
        </div>
      </section>

      {/* ── 4. For brands ───────────────────────────────────────────────── */}
      <section id="brands" aria-labelledby="brands-heading" className="section-y scroll-mt-20 bg-muted/40">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16">
          <div>
            <SectionHeader
              id="brands-heading"
              eyebrow="For brands"
              title={
                <>
                  Launch campaigns. Pay commission on <Emph>real</Emph> orders.
                </>
              }
              lede="Create a campaign for each product, approve the creators who apply, and see exactly which partner drove which order."
            />
            <CheckList items={FOR_BRANDS} className="mt-8" />
            <div className="mt-9">
              <ActionLink href="/auth/register?role=BRAND_OWNER" variant="ink">
                Start as a brand <ArrowRightIcon className="size-4" aria-hidden />
              </ActionLink>
            </div>
          </div>
          <Reveal className="relative mx-auto w-full max-w-xl sm:pb-16 lg:max-w-none">
            <PhotoFrame photo={PHOTOS.brandOwner} className="aspect-[4/5] w-[78%] shadow-xl shadow-indigo-950/10 sm:aspect-[5/6]" sizes="(min-width: 1024px) 440px, 78vw" position="72% 30%" />
            <div className="relative z-10 -mt-16 ml-auto w-[92%] sm:absolute sm:right-0 sm:bottom-0 sm:mt-0 sm:w-[72%]">
              <BrandMockup />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── 5. For creators & customers ─────────────────────────────────── */}
      <section id="creators" aria-labelledby="creators-heading" className="section-y scroll-mt-20">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16">
          <Reveal className="relative mx-auto w-full max-w-xl sm:pb-16 lg:order-1 lg:max-w-none">
            <PhotoFrame photo={PHOTOS.creatorStudio} className="ml-auto aspect-[4/5] w-[78%] shadow-xl shadow-indigo-950/10 sm:aspect-[5/6]" sizes="(min-width: 1024px) 440px, 78vw" position="60% 40%" />
            <div className="relative z-10 -mt-16 w-[92%] sm:absolute sm:bottom-0 sm:left-0 sm:mt-0 sm:w-[72%]">
              <CreatorMockup />
            </div>
          </Reveal>
          <div className="lg:order-2">
            <SectionHeader
              id="creators-heading"
              eyebrow="For creators and customers"
              title={
                <>
                  Promote brands you like. See <Emph>every</Emph> rupee you earn.
                </>
              }
              lede="Find live campaigns with clear terms, share your link or QR code anywhere, and follow each order from click to payout."
            />
            <CheckList items={FOR_CREATORS} className="mt-8" />
            <div className="mt-6 flex items-center gap-4 rounded-2xl border bg-card p-3 pr-4">
              <PhotoFrame photo={PHOTOS.familySelfie} className="size-16 shrink-0 rounded-xl" sizes="64px" position="55% 40%" />
              <p className="text-[15px] leading-6">
                <span className="font-semibold">Customers can earn too.</span>{" "}
                <span className="text-muted-foreground">Share a product you love with friends — no follower count needed.</span>
              </p>
            </div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ActionLink href="/auth/register?role=CREATOR" variant="ink">
                Start as a creator <ArrowRightIcon className="size-4" aria-hidden />
              </ActionLink>
              <ActionLink href="/auth/register?role=CUSTOMER" variant="outline">
                Join as a customer
              </ActionLink>
            </div>
          </div>
        </div>
      </section>

      {/* ── 6. How it works ─────────────────────────────────────────────── */}
      <section id="how-it-works" aria-labelledby="hiw-heading" className="section-y scroll-mt-20 bg-muted/40">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeader
            id="hiw-heading"
            eyebrow="How it works"
            title={
              <>
                Three steps from campaign to <Emph>verified</Emph> commission.
              </>
            }
            className="mb-12"
          />
          <HowItWorksStepper />
        </div>
      </section>

      {/* ── 7. Trust & transparency ─────────────────────────────────────── */}
      <section aria-labelledby="trust-heading" className="py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 id="trust-heading" className="sr-only">
            Trust and transparency
          </h2>
          <ul className="grid gap-px overflow-hidden rounded-3xl border bg-border sm:grid-cols-2 lg:grid-cols-4">
            {TRUST.map((t) => (
              <li key={t.title} className="bg-card p-6">
                <t.icon className="size-6 text-primary" aria-hidden />
                <p className="mt-4 font-semibold tracking-tight">{t.title}</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{t.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── 8. Proof (example data, labelled) + community ───────────────── */}
      <section aria-labelledby="proof-heading" className="pb-20 sm:pb-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHeader
              id="proof-heading"
              eyebrow="What you will see"
              title={
                <>
                  Every click and order, <Emph>measured</Emph>.
                </>
              }
            />
            <p className="rounded-full border bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground">Example dashboard · last 30 days</p>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            <StatCard value={<CountUp value={4820} />} label="Link clicks" hint="Attributed to the partner who shared" />
            <StatCard value={<CountUp value={212} />} label="Verified conversions" hint="Orders the brand confirmed" dark />
            <StatCard value={<CountUp value={3.4} prefix="₹" suffix="L" decimals={1} />} label="Revenue from verified orders" hint="Commission recorded per order" />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Illustrative numbers showing what the dashboard reports — not customer results.</p>
        </div>
        <div className="mt-16">
          <CommunityHomeBand />
        </div>
      </section>

      {/* ── 9. Live campaigns (real, from the database) ─────────────────── */}
      <section aria-labelledby="live-heading" className="section-y bg-muted/40">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHeader
              id="live-heading"
              eyebrow="Live on Refnivo"
              title={
                <>
                  Campaigns you can <Emph>join today</Emph>.
                </>
              }
            />
            <Link href="/campaigns" className="inline-flex min-h-11 items-center gap-1 rounded-lg px-1 text-sm font-semibold text-primary hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
              Browse all campaigns <ArrowRightIcon className="size-4" aria-hidden />
            </Link>
          </div>
          {liveCampaigns.length ? (
            <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {liveCampaigns.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/campaigns/${c.slug}`}
                    className="group flex h-full flex-col overflow-hidden rounded-3xl border bg-card transition-[transform,box-shadow] hover:-translate-y-1 hover:shadow-lg focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    <ProductThumb src={c.product.imageUrl} name={c.product.name} className="aspect-[16/10] w-full rounded-none border-0 border-b" sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw" />
                    <div className="flex flex-1 flex-col p-5">
                      <p className="text-xs font-medium text-muted-foreground">{c.brand.name}</p>
                      <p className="mt-1 line-clamp-2 font-semibold tracking-tight group-hover:text-primary">{c.product.name}</p>
                      <div className="mt-auto flex items-end justify-between gap-3 pt-5">
                        <span className="text-sm text-muted-foreground tabular-nums">{formatMoney(c.product.price, c.product.currency)}</span>
                        {c.campaignType !== "CUSTOMER_REFERRAL" ? (
                          <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground">{shortCommission(c)} commission</span>
                        ) : (
                          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">Customer rewards</span>
                        )}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-10 rounded-3xl border border-dashed bg-card p-10 text-center text-muted-foreground">New campaigns appear here as soon as brands publish them.</p>
          )}
        </div>
      </section>

      {/* ── 10. Pricing teaser ──────────────────────────────────────────── */}
      <section aria-labelledby="pricing-heading" className="section-y">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_1.1fr]">
          <SectionHeader
            id="pricing-heading"
            eyebrow="Pricing"
            title={
              <>
                <Emph>Free</Emph> during early access.
              </>
            }
            lede="Everything the platform does today, for every brand. Paid plans will be announced in advance, and nothing changes without your agreement."
          />
          <div className="rounded-3xl border bg-card p-6 sm:p-8">
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-bold tracking-tight">₹0</span>
              <span className="text-muted-foreground">during early access</span>
            </div>
            <CheckList items={INCLUDED} className="mt-6" />
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ActionLink href="/auth/register?role=BRAND_OWNER">Create a brand account</ActionLink>
              <ActionLink href="/pricing" variant="outline">
                See pricing details
              </ActionLink>
            </div>
          </div>
        </div>
      </section>

      {/* ── 11. FAQ ─────────────────────────────────────────────────────── */}
      <section id="faq" aria-labelledby="faq-heading" className="section-y scroll-mt-20 bg-muted/40">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr]">
          <SectionHeader id="faq-heading" eyebrow="FAQ" title="Questions brands and creators ask." lede={<>Still unsure? <Link href="/contact" className="font-medium text-primary hover:underline">Talk to us</Link>.</>} />
          <HomeFaq />
        </div>
      </section>

      {/* ── 12. Closing CTA ─────────────────────────────────────────────── */}
      <section aria-labelledby="cta-heading" className="py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="relative overflow-hidden rounded-[2rem] bg-ink px-6 py-14 text-center text-ink-foreground sm:px-12 sm:py-20">
            <div aria-hidden className="pointer-events-none absolute -top-32 left-1/2 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-violet-600/30 blur-3xl" />
            <div aria-hidden className="absolute inset-x-0 bottom-0 h-1.5 bg-gradient-brand" />
            <h2 id="cta-heading" className="text-headline relative mx-auto max-w-3xl text-white">
              One platform. Real connections. <span className="bg-linear-to-r from-violet-300 to-sky-300 bg-clip-text text-transparent">Measurable growth.</span>
            </h2>
            <p className="text-lede relative mx-auto mt-4 max-w-xl text-white/75">Launch a campaign, find brands to promote, or share products you love. Free during early access.</p>
            <div className="relative mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <ActionLink href="/auth/register" variant="light">
                Get Started <ArrowRightIcon className="size-4" aria-hidden />
              </ActionLink>
              <ActionLink href="/campaigns" variant="ghost-light">
                Explore Campaigns
              </ActionLink>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
