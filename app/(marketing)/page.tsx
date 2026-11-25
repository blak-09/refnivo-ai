import Link from "next/link";
import {
  ArrowRightIcon,
  BadgeCheckIcon,
  BarChart3Icon,
  CheckIcon,
  HeartHandshakeIcon,
  LinkIcon,
  ScrollTextIcon,
  SearchIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";
import { HowItWorksStepper } from "@/components/marketing/home/how-it-works-stepper";
import { HomeFaq } from "@/components/marketing/home/faq";
import { BrandMockup, CreatorMockup, PartnersMockup, UgcMockup } from "@/components/marketing/home/mockups";
import { HeroShowcase, PhotoFrame, PHOTOS, type Photo } from "@/components/marketing/home/photos";
import { ActionLink, CheckList, Emph, SectionHeader } from "@/components/marketing/home/primitives";
import { ProductTabs, type ProductPanel } from "@/components/marketing/home/product-tabs";
import { CommunityHomeBand } from "@/components/community/community-ui";
import { CampaignCard } from "@/components/marketplace/campaign-card";
import { FREE_CAMPAIGN_LIMIT, PLANS } from "@/lib/config/plans";
import { formatMoney } from "@/lib/money";
import { getLandingData, getMarketplaceQr } from "@/lib/services/landing";
import { cn } from "@/lib/utils";

/*
 * Positioning (docs/POSITIONING.md, docs/REDESIGN_PLAN.md): Refnivo helps product
 * brands sell through creators and customers. Every figure in a mockup is an
 * example and is labelled as one; live campaigns come from the database.
 */

/** The hard parts of creator marketing, and what Refnivo does about each (no claims beyond the product). */
const PROBLEMS = [
  { icon: SearchIcon, title: "Finding the right creators", body: "Creators apply to your campaign with their profile, and you approve who joins." },
  { icon: HeartHandshakeIcon, title: "Managing partnerships", body: "Every creator, what they produced and your private notes in one list." },
  { icon: LinkIcon, title: "Tracking referral sales", body: "A unique link and QR code per partner; buyers can confirm their order too." },
  { icon: WalletIcon, title: "Managing commissions", body: "A shared ledger with every rupee and status, paid from your Refnivo wallet." },
  { icon: BarChart3Icon, title: "Seeing what works", body: "Clicks, verified sales and commission for each campaign and creator." },
] as const;

type Deep = {
  id: ProductPanel["id"];
  name: string;
  verb: string;
  pay: string;
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
    name: "Affiliate & referrals",
    verb: "Sell",
    pay: "Commission per verified sale",
    title: (
      <>
        Grow with creators. Pay only for <Emph>results</Emph>.
      </>
    ),
    lede: "Launch a campaign for each product with its own commission and customer reward. Approve the creators who apply, and pay only for orders you confirm in your store.",
    points: [
      "Guided campaign builder: product, rewards, rules, budget",
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
    name: "UGC collaborations",
    verb: "Create",
    pay: "Fixed fee after you approve",
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
    name: "Creator partnerships",
    verb: "Partner",
    pay: "Included in every plan",
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

const FOR_CREATORS = [
  "Discover campaigns with the commission shown before you join",
  "Join brand partnerships and paid UGC briefs",
  "Promote with your own link and QR code, anywhere",
  "Track pending, approved and paid earnings at a glance",
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

function DeepPanel({ d, flip }: { d: Deep; flip: boolean }) {
  return (
    <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
      <div className={cn(flip && "lg:order-2")}>
        <SectionHeader as="h3" id={`${d.id}-heading`} title={d.title} lede={d.lede} />
        <CheckList items={d.points} className="mt-8" />
        <div className="mt-9">
          <ActionLink href="/auth/register?role=BRAND_OWNER" variant="ink">
            Start your brand <ArrowRightIcon className="size-4" aria-hidden />
          </ActionLink>
        </div>
      </div>
      <div className={cn("relative mx-auto w-full max-w-xl sm:pb-16 lg:max-w-none", flip && "lg:order-1")}>
        <PhotoFrame
          photo={d.photo}
          className={cn("aspect-[4/5] w-[78%] shadow-xl shadow-ink/10 sm:aspect-[5/6]", flip && "ml-auto")}
          sizes="(min-width: 1024px) 440px, 78vw"
          position={d.position}
        />
        <div className={cn("relative z-10 -mt-16 w-[92%] sm:absolute sm:bottom-0 sm:mt-0 sm:w-[72%]", flip ? "sm:left-0" : "ml-auto sm:right-0")}>{d.mockup}</div>
      </div>
    </div>
  );
}

export default async function LandingPage() {
  // Cached for 60 s and bounded to what is shown (lib/services/landing.ts); renders even if the database is down.
  const [{ campaigns }, qrDataUrl] = await Promise.all([getLandingData(), getMarketplaceQr()]);
  const liveCampaigns = campaigns.slice(0, 3);
  const panels: ProductPanel[] = DEEP.map((d, i) => ({ id: d.id, name: d.name, verb: d.verb, pay: d.pay, content: <DeepPanel d={d} flip={i % 2 === 1} /> }));

  return (
    <>
      {/* ── 1. Hero ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden" aria-labelledby="hero-heading">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[44rem] bg-linear-to-b from-accent via-accent/50 to-background dark:via-background" />
        <div aria-hidden className="pointer-events-none absolute top-24 left-1/2 -z-10 h-72 w-[48rem] max-w-full -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
        <div className="mx-auto max-w-4xl px-4 pt-14 text-center sm:px-6 sm:pt-20 lg:pt-24">
          <p className="inline-flex items-center gap-1.5 rounded-full border border-primary/15 bg-background/80 px-3 py-1 text-xs font-medium text-accent-foreground shadow-xs">
            <SparklesIcon className="size-3.5" aria-hidden />
            Creator commerce platform · built for India
          </p>
          <h1 id="hero-heading" className="text-display mt-6 text-foreground">
            Turn your customers &amp; creators into your <Emph>sales team</Emph>.
          </h1>
          <p className="text-lede mx-auto mt-6 max-w-2xl text-muted-foreground">
            Launch referral campaigns, connect with creators, and track sales from one platform. You pay commission only on orders you verify.
          </p>
          <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
            <ActionLink href="/auth/register?role=BRAND_OWNER">
              Start your brand <ArrowRightIcon className="size-4" aria-hidden />
            </ActionLink>
            <ActionLink href="/campaigns" variant="outline">
              Explore campaigns
            </ActionLink>
          </div>
          <ul className="mt-7 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
            {[`${FREE_CAMPAIGN_LIMIT} campaigns free`, "Commission only on verified orders", "No cut of creator fees"].map((t) => (
              <li key={t} className="inline-flex items-center gap-1.5">
                <CheckIcon className="size-4 text-success" aria-hidden />
                {t}
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-14 pb-16 sm:mt-16 sm:pb-20">
          <HeroShowcase qrDataUrl={qrDataUrl} />
        </div>
      </section>

      {/* ── 2. The problem ──────────────────────────────────────────────── */}
      <section aria-labelledby="problem-heading" className="pb-16 sm:pb-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeader
            id="problem-heading"
            eyebrow="Why Refnivo"
            align="center"
            title={
              <>
                Creator marketing, without the <Emph>spreadsheets</Emph>.
              </>
            }
            lede="Most brands run creators from DMs, coupon codes and sheets. These are the parts that break, and how Refnivo handles them."
          />
          <ul className="mt-12 grid gap-px overflow-hidden rounded-3xl border bg-border sm:grid-cols-2 lg:grid-cols-5">
            {PROBLEMS.map((p) => (
              <li key={p.title} className="bg-card p-5">
                <p.icon className="size-5 text-primary" aria-hidden />
                <p className="mt-3 font-semibold tracking-tight">{p.title}</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{p.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── 3. How it works ─────────────────────────────────────────────── */}
      <section id="how-it-works" aria-labelledby="hiw-heading" className="section-y scroll-mt-20 bg-muted/40">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeader
            id="hiw-heading"
            eyebrow="How it works"
            title={
              <>
                From campaign to <Emph>verified</Emph> sale in three steps.
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

      {/* ── 4. Products, for brands (tabs; /#affiliate, /#ugc, /#partners open a tab) ── */}
      <section id="brands" aria-labelledby="products-heading" className="section-y scroll-mt-20">
        <span id="products" className="sr-only" aria-hidden />
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeader
            id="products-heading"
            eyebrow="For brands"
            align="center"
            title={
              <>
                Three ways to grow with <Emph>creators</Emph>.
              </>
            }
            lede="Pay for sales, pay for content, and keep every relationship — all on orders you confirm, with links, QR codes, buyer order claims and a shared ledger."
            className="mb-12"
          />
          <ProductTabs panels={panels} />
        </div>
      </section>

      {/* ── 5. For creators & customers ─────────────────────────────────── */}
      <section id="creators" aria-labelledby="creators-heading" className="section-y scroll-mt-20 bg-muted/40">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16">
          <div className="relative mx-auto w-full max-w-xl sm:pb-16 lg:order-1 lg:max-w-none">
            <PhotoFrame photo={PHOTOS.creatorLaptop} className="ml-auto aspect-[4/5] w-[78%] shadow-xl shadow-ink/10 sm:aspect-[5/6]" sizes="(min-width: 1024px) 440px, 78vw" position="50% 30%" />
            <div className="relative z-10 -mt-16 w-[92%] sm:absolute sm:bottom-0 sm:left-0 sm:mt-0 sm:w-[72%]">
              <CreatorMockup />
            </div>
          </div>
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
                Join as a creator <ArrowRightIcon className="size-4" aria-hidden />
              </ActionLink>
              <ActionLink href="/auth/register?role=CUSTOMER" variant="outline">
                Join as a customer
              </ActionLink>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">Free for creators and customers, always.</p>
          </div>
        </div>
      </section>

      {/* ── 6. Live campaigns (real, from the database) + trust ──────────── */}
      <section aria-labelledby="live-heading" className="section-y">
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
                  <CampaignCard c={c} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-10 rounded-3xl border border-dashed bg-card p-10 text-center text-muted-foreground">New campaigns appear here as soon as brands publish them.</p>
          )}

          <h2 id="trust-heading" className="sr-only">
            Trust and transparency
          </h2>
          <ul aria-labelledby="trust-heading" className="mt-16 grid gap-px overflow-hidden rounded-3xl border bg-border sm:grid-cols-2 lg:grid-cols-4">
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

      {/* ── 7. Pricing ──────────────────────────────────────────────────── */}
      <section aria-labelledby="pricing-heading" className="section-y bg-muted/40">
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
              <li key={p.name} className={cn("flex flex-col rounded-3xl p-6 sm:p-8", p.highlight ? "bg-ink text-ink-foreground shadow-xl shadow-ink/20" : "border bg-card")}>
                <p className={cn("text-sm font-semibold", p.highlight ? "text-ink-foreground/80" : "text-primary")}>{p.name}</p>
                <p className="mt-3 flex items-baseline gap-2">
                  <span className="text-4xl font-bold tracking-tight">{p.price}</span>
                  <span className={cn("text-sm", p.highlight ? "text-ink-foreground/70" : "text-muted-foreground")}>{p.note}</span>
                </p>
                <ul className="mt-6 space-y-2.5 text-[15px]">
                  {p.items.map((it) => (
                    <li key={it} className="flex items-start gap-2.5">
                      <CheckIcon className={cn("mt-0.5 size-4 shrink-0", p.highlight ? "text-ink-foreground/80" : "text-primary")} aria-hidden />
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

      {/* ── 8. FAQ ──────────────────────────────────────────────────────── */}
      <section id="faq" aria-labelledby="faq-heading" className="section-y scroll-mt-20">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr]">
          <SectionHeader id="faq-heading" eyebrow="FAQ" title="Questions brands and creators ask." lede={<>Still unsure? <Link href="/contact" className="font-medium text-primary hover:underline">Talk to us</Link>.</>} />
          <HomeFaq />
        </div>
      </section>

      {/* ── 9. Closing CTA ──────────────────────────────────────────────── */}
      <section aria-labelledby="cta-heading" className="pb-16 sm:pb-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="relative overflow-hidden rounded-[2rem] bg-ink px-6 py-14 text-center text-ink-foreground sm:px-12 sm:py-20">
            <div aria-hidden className="pointer-events-none absolute -top-32 left-1/2 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-brand-from/30 blur-3xl" />
            <div aria-hidden className="absolute inset-x-0 bottom-0 h-1.5 bg-gradient-brand" />
            <h2 id="cta-heading" className="text-headline relative mx-auto max-w-3xl text-ink-foreground">
              Creators who sell. Content you own. <span className="text-gradient-brand-light">Partners you keep.</span>
            </h2>
            <p className="text-lede relative mx-auto mt-4 max-w-xl text-ink-foreground/75">
              Start free with {FREE_CAMPAIGN_LIMIT} campaign launches, or join as a creator and find brands to work with.
            </p>
            <div className="relative mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <ActionLink href="/get-started" variant="light">
                Create your free account <ArrowRightIcon className="size-4" aria-hidden />
              </ActionLink>
              <ActionLink href="/campaigns" variant="ghost-light">
                Explore campaigns
              </ActionLink>
            </div>
          </div>
        </div>
      </section>

      {/* Community band sits with the footer: useful, but not part of the main story. */}
      <div className="pb-16 sm:pb-20">
        <CommunityHomeBand />
      </div>
    </>
  );
}
