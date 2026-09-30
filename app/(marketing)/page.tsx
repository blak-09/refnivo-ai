import Link from "next/link";
import {
  BarChart3Icon,
  CompassIcon,
  GiftIcon,
  HandshakeIcon,
  LinkIcon,
  MegaphoneIcon,
  MousePointerClickIcon,
  ReceiptIcon,
  ShoppingCartIcon,
  UserIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { CampaignCard } from "@/components/marketplace/campaign-card";
import { HeroSection } from "@/components/marketing/hero-section";
import { TrustedBrands } from "@/components/marketing/trusted-brands";
import { LaunchSection } from "@/components/marketing/launch-section";
import { ProgramTypeBadge } from "@/components/affiliate/program-badge";
import { BenefitSection } from "@/components/marketing/benefit-section";
import { CTAButton } from "@/components/marketing/cta-button";
import { FloatingProfile, ProductShowcase } from "@/components/marketing/product-showcase";
import { shortCommission } from "@/components/campaigns/campaign-summary";
import { EmptyState } from "@/components/dashboard/primitives";
import { getLandingData, getMarketplaceQr } from "@/lib/services/landing";

const FEATURES = [
  { icon: MegaphoneIcon, title: "Referral campaigns", body: "Launch a campaign per product with its own commission, customer reward and approval rules." },
  { icon: HandshakeIcon, title: "Creator partnerships", body: "Review creator applications, approve the right partners and keep every collaboration in one place." },
  { icon: CompassIcon, title: "Affiliate discovery", body: "Creators find Refnivo campaigns and brands' own external affiliate programs in one directory." },
  { icon: LinkIcon, title: "Links & QR codes", body: "Every partner gets a unique referral link and QR code to share on social, video or WhatsApp." },
  { icon: ReceiptIcon, title: "Conversion tracking", body: "Clicks are attributed to partners; orders become commissions only after they are verified." },
  { icon: BarChart3Icon, title: "Performance analytics", body: "See clicks, verified conversions and revenue by partner, campaign and date range." },
];

const FLOW = [
  { icon: UserIcon, title: "Creator", body: "Joins a campaign and gets a unique link and QR code." },
  { icon: LinkIcon, title: "Referral Link", body: "Shared on Instagram, YouTube, WhatsApp or a blog." },
  { icon: MousePointerClickIcon, title: "Customer", body: "Clicks through, and the visit is attributed to the partner." },
  { icon: ShoppingCartIcon, title: "Purchase", body: "The order is recorded and verified by the brand." },
  { icon: WalletIcon, title: "Commission", body: "Earned at the rate fixed when the order was placed." },
];

export default async function LandingPage() {
  // Cached for 60 s and bounded to what is shown (lib/services/landing.ts); renders even if the database is down.
  const [{ campaigns, brands, creators, stats }, qrDataUrl] = await Promise.all([getLandingData(), getMarketplaceQr()]);

  const featured = campaigns.slice(0, 4);
  const hero = campaigns[0] ?? null;
  const showcaseCreators = creators.slice(0, 2).map((c) => ({ name: c.displayName, imageUrl: c.profileImageUrl }));

  return (
    <>
      <HeroSection />

      <TrustedBrands brands={brands.slice(0, 8).map((b) => ({ name: b.name, slug: b.slug, logoUrl: b.logoUrl }))} />

      {/* One platform, multiple growth channels */}
      <section id="product" aria-labelledby="platform-heading" className="scroll-mt-20 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold text-indigo-600">The platform</p>
            <h2 id="platform-heading" className="mt-1 text-2xl font-bold tracking-tight text-balance sm:text-4xl">
              One Platform. Multiple Growth Channels.
            </h2>
            <p className="mt-3 text-muted-foreground">Refnivo connects brands and creators through affiliate campaigns, referrals and performance-based partnerships.</p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="group rounded-2xl border bg-card p-5 transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
                <span className="flex size-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 transition-colors group-hover:bg-indigo-600 group-hover:text-white dark:bg-indigo-950/50">
                  <f.icon className="size-5" aria-hidden />
                </span>
                <h3 className="mt-4 font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits for brands */}
      <BenefitSection
        id="brands"
        eyebrow="For Brands"
        title="Launch campaigns and grow with creators you choose."
        description="Create a campaign for each product, approve the creators who apply, and pay commission only on verified orders. See which partners and campaigns drive revenue."
        items={[
          "Multi-step campaign builder",
          "Commission & customer reward per product",
          "Creator applications & connections",
          "Link & QR attribution",
          "Order verification & ledger",
          "Tracking & analytics by date range",
        ]}
        cta={{ href: "/auth/register?role=BRAND_OWNER", label: "Get Started as a brand" }}
        icon={MegaphoneIcon}
        tinted
        visual={
          <div className="grid grid-cols-2 gap-4">
            {[
              { icon: MousePointerClickIcon, label: "Clicks & QR scans", value: "Tracked" },
              { icon: ShoppingCartIcon, label: "Orders", value: "Verified" },
              { icon: BarChart3Icon, label: "Active campaigns", value: stats ? String(stats.activeCampaigns) : "—" },
              { icon: UsersIcon, label: "Creators on Refnivo", value: stats ? String(stats.creatorCount) : "—" },
            ].map((m) => (
              <Card key={m.label} size="sm" className="rounded-2xl border-indigo-100/80 shadow-sm">
                <CardContent className="space-y-2">
                  <m.icon className="size-5 text-indigo-600" aria-hidden />
                  <p className="text-2xl font-bold tracking-tight text-foreground tabular-nums">{m.value}</p>
                  <p className="text-xs text-muted-foreground">{m.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        }
      />

      {/* Benefits for creators */}
      <BenefitSection
        id="creators"
        eyebrow="For Creators"
        title="Find brands to promote and track what you earn."
        description="Discover Refnivo campaigns and external affiliate programs, join in a click, and share your link and QR code. Track clicks, conversions and earnings in one dashboard."
        items={["Program directory with filters", "Unique referral links & QR codes", "Click & conversion analytics", "Pending, approved & paid commissions"]}
        cta={{ href: "/auth/register?role=CREATOR", label: "Get Started as a creator" }}
        icon={UsersIcon}
        reverse
        visual={
          <Card className="rounded-2xl border-indigo-100/80 shadow-md">
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">Creators already on Refnivo</p>
                <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">{stats ? stats.creatorCount : "—"}</span>
              </div>
              {creators.length ? (
                <div className="flex flex-wrap gap-4">
                  {creators.slice(0, 4).map((c) => (
                    <Link key={c.username} href={`/creators/${c.username}`} className="flex flex-col items-center gap-2 text-center">
                      <FloatingProfile creator={{ name: c.displayName, imageUrl: c.profileImageUrl }} className="size-16" />
                      <span className="max-w-20 truncate text-xs font-medium text-foreground">{c.displayName}</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Be one of the first creators to join.</p>
              )}
              <div className="rounded-xl bg-linear-to-r from-violet-600 to-blue-500 p-4 text-white shadow-md shadow-indigo-500/20">
                <p className="text-xs opacity-80">Example rate (illustrative)</p>
                <p className="text-2xl font-bold">12% per verified order</p>
                <p className="text-xs opacity-80">Each campaign sets its own rate. Commissions are fixed at order time.</p>
              </div>
            </CardContent>
          </Card>
        }
      />

      {/* Affiliate discovery: Refnivo campaigns vs brands' external affiliate programmes */}
      <section id="discovery" aria-labelledby="discovery-heading" className="scroll-mt-20 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-indigo-600">Affiliate Discovery</p>
            <h2 id="discovery-heading" className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
              Find programs worth promoting
            </h2>
            <p className="mt-2 text-muted-foreground">
              The directory lists two kinds of programs, always labelled so you know who runs the tracking and pays the commission.
            </p>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-indigo-100 bg-card p-5 dark:border-indigo-900/50">
              <ProgramTypeBadge type="REFNIVO" />
              <h3 className="mt-3 font-semibold">Refnivo Campaign</h3>
              <p className="mt-1 text-sm text-muted-foreground">Run on Refnivo end to end: join, share your link, and Refnivo tracks verified orders and your commission.</p>
              <CTAButton href="/affiliate-programs?kind=refnivo" size="default" variant="outline" className="mt-4">
                Browse Refnivo campaigns
              </CTAButton>
            </div>
            <div className="rounded-2xl border bg-card p-5">
              <ProgramTypeBadge type="EXTERNAL" />
              <h3 className="mt-3 font-semibold">External Affiliate Program</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                A brand&apos;s own program, listed for discovery. You apply on the brand&apos;s official page; the brand handles approval, tracking and payouts.
              </p>
              <CTAButton href="/affiliate-programs?kind=external" size="default" variant="outline" className="mt-4">
                Explore external programs
              </CTAButton>
            </div>
          </div>
        </div>
      </section>

      {/* Track every conversion */}
      <section id="how-it-works" aria-labelledby="flow-heading" className="scroll-mt-20 overflow-hidden bg-linear-to-b from-violet-50/60 to-background py-16 sm:py-20 dark:from-violet-950/20">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold text-indigo-600">Attribution</p>
            <h2 id="flow-heading" className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
              Track Every Conversion
            </h2>
            <p className="mt-3 text-muted-foreground">
              Each partner shares a unique link. Refnivo attributes the click, the brand verifies the order, and only then is the commission recorded.
            </p>
            <ol className="mt-8 grid gap-3">
              {FLOW.map((step, i) => (
                <li key={step.title} className="relative flex gap-4">
                  {i < FLOW.length - 1 ? <span aria-hidden className="absolute top-11 left-5 h-[calc(100%-2rem)] w-px bg-indigo-200 dark:bg-indigo-900" /> : null}
                  <span className="relative flex size-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-violet-600 to-blue-500 text-white shadow-md shadow-indigo-500/20">
                    <step.icon className="size-5" aria-hidden />
                  </span>
                  <div className="pb-2">
                    <p className="font-semibold">
                      <span className="mr-1.5 text-xs font-bold text-indigo-500 tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                      {step.title}
                    </p>
                    <p className="text-sm text-muted-foreground">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <ProductShowcase
            product={hero ? { name: hero.product.name, imageUrl: hero.product.imageUrl, price: hero.product.price, currency: hero.product.currency } : null}
            brand={hero ? { name: hero.brand.name, logoUrl: hero.brand.logoUrl } : null}
            commissionLabel={hero && hero.campaignType !== "CUSTOMER_REFERRAL" ? `${shortCommission(hero)} commission` : null}
            creators={showcaseCreators}
            qrDataUrl={qrDataUrl}
            href={hero ? `/campaigns/${hero.slug}` : "/campaigns"}
          />
        </div>
      </section>

      {/* Live Refnivo campaigns (real data only) */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Live Refnivo campaigns</h2>
              <p className="mt-1 text-muted-foreground">Products brands want promoted right now.</p>
            </div>
            <Link href="/campaigns" className="shrink-0 text-sm font-semibold text-indigo-600 hover:underline">
              See all
            </Link>
          </div>
          {featured.length ? (
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {featured.map((c) => (
                <CampaignCard key={c.id} c={c} />
              ))}
            </div>
          ) : (
            <EmptyState
              className="mt-8"
              icon={MegaphoneIcon}
              title="No live campaigns yet"
              description="Brands are onboarding. Check back soon or list your own product campaign."
              action={
                <CTAButton href="/auth/register?role=BRAND_OWNER" size="default">
                  List your brand
                </CTAButton>
              }
            />
          )}
        </div>
      </section>

      {/* Product-launch video */}
      <LaunchSection />

      {/* Customer referral */}
      <section id="customers" className="scroll-mt-20 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid items-center gap-8 rounded-3xl border border-indigo-100 bg-linear-to-br from-violet-50 via-white to-blue-50 p-6 shadow-sm sm:p-12 lg:grid-cols-[1fr_auto] dark:border-indigo-900/50 dark:from-violet-950/30 dark:via-background dark:to-blue-950/30">
            <div className="max-w-2xl">
              <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600">
                <GiftIcon className="size-4" aria-hidden />
                For Customers
              </p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Share products with friends. Get rewarded.</h2>
              <p className="mt-3 text-muted-foreground">
                Love a product? Get your personal link, share it on WhatsApp, and earn a reward every time a friend&apos;s order is verified. No follower
                count required.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <CTAButton href="/auth/register?role=CUSTOMER">Create a free account</CTAButton>
              <CTAButton href="/campaigns" variant="outline">
                Browse campaigns
              </CTAButton>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="pb-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="relative overflow-hidden rounded-3xl bg-linear-to-r from-violet-600 to-blue-500 px-6 py-12 text-center text-white shadow-xl shadow-indigo-500/25 sm:px-12 sm:py-16">
            <div aria-hidden className="pointer-events-none absolute -top-20 -right-20 size-64 rounded-full bg-white/10 blur-3xl" />
            <h2 className="relative text-2xl font-bold tracking-tight sm:text-4xl">Start growing with Refnivo</h2>
            <p className="relative mx-auto mt-3 max-w-xl text-white/85">
              {stats ? `${stats.brandCount} brands and ${stats.creatorCount} creators are already here.` : "Brands, creators and customers — all in one place."} Join free today.
            </p>
            <div className="relative mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <CTAButton href="/auth/register" variant="light">
                Get Started
              </CTAButton>
              <CTAButton href="/affiliate-programs" variant="outline" className="border-white/40 bg-transparent text-white hover:bg-white/10">
                Explore Affiliate Programs
              </CTAButton>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
