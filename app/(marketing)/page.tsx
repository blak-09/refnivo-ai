import Link from "next/link";
import {
  ArrowRightIcon,
  BadgeCheckIcon,
  CheckIcon,
  ClapperboardIcon,
  HeartHandshakeIcon,
  MegaphoneIcon,
  ScrollTextIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UsersIcon,
  XIcon,
} from "lucide-react";
import { HowItWorksStepper } from "@/components/marketing/home/how-it-works-stepper";
import { HomeFaq } from "@/components/marketing/home/faq";
import { BrandMockup, CreatorMockup, PartnersMockup, UgcMockup } from "@/components/marketing/home/mockups";
import { HeroShowcase, PhotoFrame, PHOTOS, type Photo } from "@/components/marketing/home/photos";
import { ActionLink, CheckList, Emph, SectionHeader } from "@/components/marketing/home/primitives";
import { Reveal } from "@/components/marketing/home/reveal";
import { CommunityHomeBand } from "@/components/community/community-ui";
import { ProductThumb } from "@/components/products/product-thumb";
import { shortCommission } from "@/components/campaigns/campaign-summary";
import { FREE_CAMPAIGN_LIMIT, PLANS } from "@/lib/config/plans";
import { formatMoney } from "@/lib/money";
import { getLandingData, getMarketplaceQr } from "@/lib/services/landing";
import { cn } from "@/lib/utils";

/*
 * Positioning (docs/POSITIONING.md): Refnivo is a creator commerce platform for
 * Indian product brands — three ways to work with creators (sell, create,
 * partner) on one verified record. Every figure in a mockup is an example.
 */

const PRODUCTS = [
  {
    id: "affiliate",
    n: "01",
    verb: "Sell",
    icon: MegaphoneIcon,
    name: "Affiliate & referrals",
    pitch: "Creators and customers share your products with their own link and QR code.",
    pay: "Commission per verified sale",
  },
  {
    id: "ugc",
    n: "02",
    verb: "Create",
    icon: ClapperboardIcon,
    name: "UGC collaborations",
    pitch: "Brief creators for photos and videos you can run on your own pages and ads.",
    pay: "Fixed fee after you approve",
  },
  {
    id: "partners",
    n: "03",
    verb: "Partner",
    icon: HeartHandshakeIcon,
    name: "Creator partnerships",
    pitch: "Every creator you work with, what each one produced, and your private notes.",
    pay: "Included in every plan",
  },
] as const;

type Deep = {
  id: (typeof PRODUCTS)[number]["id"];
  eyebrow: string;
  title: React.ReactNode;
  lede: string;
  points: string[];
  photo: Photo;
  position: string;
  mockup: React.ReactNode;
};

const DEEP: Deep[] = [
  {
    id: "affiliate",
    eyebrow: "01 · Sell — Affiliate & referrals",
    title: (
      <>
        Turn creators and customers into your <Emph>sales team</Emph>.
      </>
    ),
    lede: "Launch a campaign for each product with its own commission and customer reward. Approve the creators who apply, and pay only for orders you confirm in your store.",
    points: [
      "Multi-step campaign builder: product, rewards, rules, budget",
      "Unique links and QR codes for every partner",
      "Orders verified by you before any commission is owed",
      "A commission ledger both sides can see",
    ],
    photo: PHOTOS.brandOwner,
    position: "50% 20%",
    mockup: <BrandMockup />,
  },
  {
    id: "ugc",
    eyebrow: "02 · Create — UGC collaborations",
    title: (
      <>
        Content you can use, at a <Emph>price you set</Emph>.
      </>
    ),
    lede: "Post a brief with the fee, deliverables and how you will use the content. Pick from creators' pitches, review their photos and videos, and approve the final cut.",
    points: [
      "Fee, deliverables and usage rights fixed in the brief",
      "Creator pitches with portfolio links",
      "Photo uploads and video links, up to two revision rounds",
      "Approval and payment record — Refnivo takes no cut",
    ],
    photo: PHOTOS.creatorFilming,
    position: "24% 45%",
    mockup: <UgcMockup />,
  },
  {
    id: "partners",
    eyebrow: "03 · Partner — Creator partnerships",
    title: (
      <>
        Every creator relationship, and what it <Emph>produced</Emph>.
      </>
    ),
    lede: "One list of every creator you work with — from campaigns, connections or UGC — with their clicks, verified sales, commission and content in one place.",
    points: [
      "Results per creator from verified sales only",
      "Campaign and UGC history side by side",
      "Private notes your team keeps about each partner",
      "Best-performing partners first, with search",
    ],
    photo: PHOTOS.partnersLaptop,
    position: "50% 20%",
    mockup: <PartnersMockup />,
  },
];

const COMPARE = [
  { topic: "Finding creators", before: "Cold DMs and spreadsheets", after: "Creators apply to your campaign with their profile" },
  { topic: "Proof of sales", before: "Guessing from coupon codes", after: "Every order tied to the partner who sent it" },
  { topic: "Content", before: "Negotiating each reel in chat", after: "Briefs with a fixed fee and usage rights" },
  { topic: "Paying creators", before: "Unclear amounts, late payouts", after: "A shared ledger with every rupee and status" },
  { topic: "Relationships", before: "Scattered across apps and people", after: "One partner hub with results and notes" },
] as const;

const FOR_CREATORS = [
  "Commission on every verified sale, shown before you join",
  "Paid UGC briefs with the fee and usage rights up front",
  "Your own link and QR code to share anywhere",
  "Pending, approved and paid money at a glance",
];

const TRUST = [
  { icon: BadgeCheckIcon, title: "A click is never a sale", body: "Commission is owed only on orders the brand verifies." },
  { icon: UsersIcon, title: "One record, both sides", body: "Brands and creators see the same orders, fees and statuses." },
  { icon: ScrollTextIcon, title: "Every change is logged", body: "Approvals, refunds and payouts are audit-logged with who did what." },
  { icon: ShieldCheckIcon, title: "Payments by Razorpay", body: "UPI, card and netbanking details never touch Refnivo." },
];

const PRICING = [
  {
    name: "Free",
    price: "₹0",
    note: `${FREE_CAMPAIGN_LIMIT} campaign launches`,
    items: ["Affiliate & referral campaigns", "Creator partnerships", "Links, QR codes and order verification"],
  },
  {
    name: PLANS.starter.name,
    price: formatMoney(PLANS.starter.amount),
    note: `per ${PLANS.starter.periodDays} days`,
    items: ["Unlimited campaign launches", "UGC collaborations", "Everything in Free"],
  },
  {
    name: PLANS.growth.name,
    price: formatMoney(PLANS.growth.amount),
    note: `per ${PLANS.growth.periodDays} days`,
    items: ["Everything in Starter", "Analytics dashboard", "CSV exports", "Priority support"],
    highlight: true,
  },
];

export default async function LandingPage() {
  // Cached for 60 s and bounded to what is shown (lib/services/landing.ts); renders even if the database is down.
  const [{ campaigns }, qrDataUrl] = await Promise.all([getLandingData(), getMarketplaceQr()]);
  const liveCampaigns = campaigns.slice(0, 3);

  return (
    <>
      {/* ── 1. Hero ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden" aria-labelledby="hero-heading">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[44rem] bg-linear-to-b from-violet-50 via-indigo-50/50 to-background dark:from-violet-950/25 dark:via-background" />
        <div aria-hidden className="pointer-events-none absolute top-24 left-1/2 -z-10 h-72 w-[48rem] max-w-full -translate-x-1/2 rounded-full bg-violet-300/25 blur-3xl dark:bg-violet-700/15" />
        <div className="mx-auto max-w-4xl px-4 pt-14 text-center sm:px-6 sm:pt-20 lg:pt-24">
          <p className="inline-flex items-center gap-1.5 rounded-full border border-primary/15 bg-background/80 px-3 py-1 text-xs font-medium text-accent-foreground shadow-xs">
            <SparklesIcon className="size-3.5" aria-hidden />
            Creator commerce platform · built for India
          </p>
          <h1 id="hero-heading" className="text-display mt-6 text-foreground">
            Grow with creators. Pay only for <Emph>results</Emph>.
          </h1>
          <p className="text-lede mx-auto mt-6 max-w-2xl text-muted-foreground">
            Refnivo is where product brands work with creators and customers — affiliate campaigns that pay on verified sales, UGC at a fixed fee, and every
            partnership in one place.
          </p>
          <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
            <ActionLink href="/get-started">
              Start free <ArrowRightIcon className="size-4" aria-hidden />
            </ActionLink>
            <ActionLink href="#products" variant="outline">
              See the products
            </ActionLink>
          </div>
          <ul className="mt-7 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
            {[`${FREE_CAMPAIGN_LIMIT} campaigns free`, "Commission only on verified orders", "No cut of creator fees"].map((t) => (
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

      {/* ── 2. The suite: three ways to grow ────────────────────────────── */}
      <section id="products" aria-labelledby="products-heading" className="scroll-mt-20 pb-20 sm:pb-28">
        <span id="product" className="sr-only" aria-hidden />
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeader
            id="products-heading"
            eyebrow="One platform"
            align="center"
            title={
              <>
                Three ways to grow with <Emph>creators</Emph>.
              </>
            }
            lede="Pay for sales, pay for content, and keep every relationship — on one record you and your creators both trust."
          />
          <ul className="mt-12 grid gap-5 md:grid-cols-3">
            {PRODUCTS.map((p, i) => (
              <li key={p.id}>
                <Reveal delay={i * 80} className="h-full">
                  <Link
                    href={`#${p.id}`}
                    className={cn(
                      "group flex h-full flex-col rounded-3xl p-6 transition-[transform,box-shadow] hover:-translate-y-1 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:p-8",
                      i === 0 ? "bg-ink text-ink-foreground shadow-xl shadow-indigo-950/20" : "border bg-card hover:shadow-lg",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className={cn("flex size-11 items-center justify-center rounded-2xl", i === 0 ? "bg-white/10 text-violet-200" : "bg-primary/10 text-primary")}>
                        <p.icon className="size-5" aria-hidden />
                      </span>
                      <span className={cn("text-sm font-bold tracking-wide tabular-nums", i === 0 ? "text-violet-300" : "text-primary")}>
                        {p.n} · {p.verb}
                      </span>
                    </div>
                    <h3 className="mt-6 text-xl font-semibold tracking-tight">{p.name}</h3>
                    <p className={cn("mt-2 text-[15px] leading-6", i === 0 ? "text-white/75" : "text-muted-foreground")}>{p.pitch}</p>
                    <p className={cn("mt-auto flex items-center justify-between gap-2 pt-6 text-sm font-semibold", i === 0 ? "text-white" : "text-foreground")}>
                      <span className={cn("rounded-full px-3 py-1 text-xs", i === 0 ? "bg-white/10" : "bg-muted")}>{p.pay}</span>
                      <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                    </p>
                  </Link>
                </Reveal>
              </li>
            ))}
          </ul>
          <p className="mt-5 flex items-center justify-center gap-2 rounded-2xl bg-gradient-brand px-5 py-4 text-center text-[15px] font-semibold text-white">
            <BadgeCheckIcon className="size-5 shrink-0" aria-hidden />
            All three run on verified attribution: links, QR codes, order checks and a shared ledger.
          </p>
        </div>
      </section>

      {/* ── 3. Product deep-dives ───────────────────────────────────────── */}
      <div id="brands" className="scroll-mt-20">
        {DEEP.map((d, i) => {
          const flip = i % 2 === 1;
          return (
            <section key={d.id} id={d.id} aria-labelledby={`${d.id}-heading`} className={cn("section-y scroll-mt-20", i % 2 === 0 && "bg-muted/40")}>
              <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16">
                <div className={cn(flip && "lg:order-2")}>
                  <SectionHeader id={`${d.id}-heading`} eyebrow={d.eyebrow} title={d.title} lede={d.lede} />
                  <CheckList items={d.points} className="mt-8" />
                  <div className="mt-9">
                    <ActionLink href="/auth/register?role=BRAND_OWNER" variant="ink">
                      Start as a brand <ArrowRightIcon className="size-4" aria-hidden />
                    </ActionLink>
                  </div>
                </div>
                <Reveal className={cn("relative mx-auto w-full max-w-xl sm:pb-16 lg:max-w-none", flip && "lg:order-1")}>
                  <PhotoFrame
                    photo={d.photo}
                    className={cn("aspect-[4/5] w-[78%] shadow-xl shadow-indigo-950/10 sm:aspect-[5/6]", flip && "ml-auto")}
                    sizes="(min-width: 1024px) 440px, 78vw"
                    position={d.position}
                  />
                  <div className={cn("relative z-10 -mt-16 w-[92%] sm:absolute sm:bottom-0 sm:mt-0 sm:w-[72%]", flip ? "sm:left-0" : "ml-auto sm:right-0")}>{d.mockup}</div>
                </Reveal>
              </div>
            </section>
          );
        })}
      </div>

      {/* ── 4. Before / after ───────────────────────────────────────────── */}
      <section aria-labelledby="compare-heading" className="section-y bg-muted/40">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <SectionHeader
            id="compare-heading"
            eyebrow="Why one platform"
            align="center"
            title={
              <>
                Creator marketing without the <Emph>chaos</Emph>.
              </>
            }
            lede="Most brands run creators from DMs, spreadsheets and coupon codes. Refnivo replaces the guesswork with one shared record."
          />
          <div className="mt-12 overflow-hidden rounded-3xl border bg-card">
            <div className="hidden grid-cols-[0.8fr_1fr_1fr] border-b bg-muted/50 px-6 py-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase sm:grid">
              <span />
              <span>Without Refnivo</span>
              <span className="text-primary">With Refnivo</span>
            </div>
            <ul className="divide-y">
              {COMPARE.map((c) => (
                <li key={c.topic} className="grid gap-2 px-6 py-4 sm:grid-cols-[0.8fr_1fr_1fr] sm:items-center sm:gap-4">
                  <span className="font-semibold tracking-tight">{c.topic}</span>
                  <span className="flex items-start gap-2 text-[15px] text-muted-foreground">
                    <XIcon className="mt-0.5 size-4 shrink-0 text-rose-500" aria-hidden />
                    <span>
                      <span className="sr-only">Without Refnivo: </span>
                      {c.before}
                    </span>
                  </span>
                  <span className="flex items-start gap-2 text-[15px]">
                    <CheckIcon className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
                    <span>
                      <span className="sr-only">With Refnivo: </span>
                      {c.after}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── 5. For creators & customers ─────────────────────────────────── */}
      <section id="creators" aria-labelledby="creators-heading" className="section-y scroll-mt-20">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16">
          <Reveal className="relative mx-auto w-full max-w-xl sm:pb-16 lg:order-1 lg:max-w-none">
            <PhotoFrame photo={PHOTOS.creatorLaptop} className="ml-auto aspect-[4/5] w-[78%] shadow-xl shadow-indigo-950/10 sm:aspect-[5/6]" sizes="(min-width: 1024px) 440px, 78vw" position="50% 30%" />
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
                  Two ways to earn. <Emph>One</Emph> dashboard.
                </>
              }
              lede="Earn commission when your audience buys, and get paid a fixed fee to make content for brands. Every term is shown before you start, and every rupee is tracked."
            />
            <CheckList items={FOR_CREATORS} className="mt-8" />
            <div className="mt-6 flex items-center gap-4 rounded-2xl border bg-card p-3 pr-4">
              <PhotoFrame photo={PHOTOS.festiveFriends} className="size-16 shrink-0 rounded-xl" sizes="64px" position="50% 45%" />
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
            <p className="mt-4 text-sm text-muted-foreground">Free for creators and customers, always.</p>
          </div>
        </div>
      </section>

      {/* ── 6. How a campaign works ─────────────────────────────────────── */}
      <section id="how-it-works" aria-labelledby="hiw-heading" className="section-y scroll-mt-20 bg-muted/40">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeader
            id="hiw-heading"
            eyebrow="How a campaign works"
            title={
              <>
                From link to <Emph>verified</Emph> commission in three steps.
              </>
            }
            lede={
              <>
                The same verified record powers UGC and partnerships.{" "}
                <Link href="/how-it-works" className="font-medium text-primary hover:underline">
                  See every flow
                </Link>
                .
              </>
            }
            className="mb-12"
          />
          <HowItWorksStepper />
        </div>
      </section>

      {/* ── 7. Trust ────────────────────────────────────────────────────── */}
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
        <div className="mt-16">
          <CommunityHomeBand />
        </div>
      </section>

      {/* ── 8. Live campaigns (real, from the database) ─────────────────── */}
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

      {/* ── 9. Pricing / business model ─────────────────────────────────── */}
      <section aria-labelledby="pricing-heading" className="section-y">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeader
            id="pricing-heading"
            eyebrow="Pricing"
            align="center"
            title={
              <>
                Brands pay a plan. Creators keep <Emph>every rupee</Emph>.
              </>
            }
            lede={`Start free with ${FREE_CAMPAIGN_LIMIT} campaign launches. Refnivo never takes a cut of creator commission or UGC fees.`}
          />
          <ul className="mt-12 grid gap-5 md:grid-cols-3">
            {PRICING.map((p) => (
              <li key={p.name} className={cn("flex flex-col rounded-3xl p-6 sm:p-8", p.highlight ? "bg-ink text-ink-foreground shadow-xl shadow-indigo-950/20" : "border bg-card")}>
                <p className={cn("text-sm font-semibold", p.highlight ? "text-violet-200" : "text-primary")}>{p.name}</p>
                <p className="mt-3 flex items-baseline gap-2">
                  <span className="text-4xl font-bold tracking-tight">{p.price}</span>
                  <span className={cn("text-sm", p.highlight ? "text-white/70" : "text-muted-foreground")}>{p.note}</span>
                </p>
                <ul className="mt-6 space-y-2.5 text-[15px]">
                  {p.items.map((it) => (
                    <li key={it} className="flex items-start gap-2.5">
                      <CheckIcon className={cn("mt-0.5 size-4 shrink-0", p.highlight ? "text-violet-200" : "text-primary")} aria-hidden />
                      {it}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <ActionLink href="/auth/register?role=BRAND_OWNER">Create a brand account</ActionLink>
            <ActionLink href="/pricing" variant="outline">
              Compare plans
            </ActionLink>
          </div>
        </div>
      </section>

      {/* ── 10. FAQ ─────────────────────────────────────────────────────── */}
      <section id="faq" aria-labelledby="faq-heading" className="section-y scroll-mt-20 bg-muted/40">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr]">
          <SectionHeader id="faq-heading" eyebrow="FAQ" title="Questions brands and creators ask." lede={<>Still unsure? <Link href="/contact" className="font-medium text-primary hover:underline">Talk to us</Link>.</>} />
          <HomeFaq />
        </div>
      </section>

      {/* ── 11. Closing CTA ─────────────────────────────────────────────── */}
      <section aria-labelledby="cta-heading" className="py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="relative overflow-hidden rounded-[2rem] bg-ink px-6 py-14 text-center text-ink-foreground sm:px-12 sm:py-20">
            <div aria-hidden className="pointer-events-none absolute -top-32 left-1/2 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-violet-600/30 blur-3xl" />
            <div aria-hidden className="absolute inset-x-0 bottom-0 h-1.5 bg-gradient-brand" />
            <h2 id="cta-heading" className="text-headline relative mx-auto max-w-3xl text-white">
              Creators who sell. Content you own.{" "}
              <span className="bg-linear-to-r from-violet-300 to-sky-300 bg-clip-text text-transparent">Partners you keep.</span>
            </h2>
            <p className="text-lede relative mx-auto mt-4 max-w-xl text-white/75">
              Start free with {FREE_CAMPAIGN_LIMIT} campaign launches, or join as a creator and find brands to work with.
            </p>
            <div className="relative mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <ActionLink href="/get-started" variant="light">
                Start free <ArrowRightIcon className="size-4" aria-hidden />
              </ActionLink>
              <ActionLink href="/campaigns" variant="ghost-light">
                Explore campaigns
              </ActionLink>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
