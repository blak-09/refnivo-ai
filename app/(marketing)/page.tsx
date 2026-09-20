import Link from "next/link";
import {
  BarChart3Icon,
  GiftIcon,
  LinkIcon,
  MegaphoneIcon,
  MousePointerClickIcon,
  PackageIcon,
  ShoppingCartIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { CampaignCard } from "@/components/marketplace/campaign-card";
import { HeroSection } from "@/components/marketing/hero-section";
import { TrustedBrands } from "@/components/marketing/trusted-brands";
import { LaunchSection } from "@/components/marketing/launch-section";
import { BenefitSection } from "@/components/marketing/benefit-section";
import { CTAButton } from "@/components/marketing/cta-button";
import { FloatingProfile } from "@/components/marketing/product-showcase";
import { shortCommission } from "@/components/campaigns/campaign-summary";
import { EmptyState } from "@/components/dashboard/primitives";
import { getLandingData, getMarketplaceQr } from "@/lib/services/landing";

export default async function LandingPage() {
  // Cached for 60 s and bounded to what is shown (lib/services/landing.ts); renders even if the database is down.
  const [{ campaigns, brands, creators, stats }, qrDataUrl] = await Promise.all([getLandingData(), getMarketplaceQr()]);

  const featured = campaigns.slice(0, 4);
  const hero = campaigns[0] ?? null;
  const showcaseCreators = creators.slice(0, 2).map((c) => ({ name: c.displayName, imageUrl: c.profileImageUrl }));

  return (
    <>
      <HeroSection
        showcase={{
          product: hero ? { name: hero.product.name, imageUrl: hero.product.imageUrl, price: hero.product.price, currency: hero.product.currency } : null,
          brand: hero ? { name: hero.brand.name, logoUrl: hero.brand.logoUrl } : null,
          commissionLabel: hero && hero.campaignType !== "CUSTOMER_REFERRAL" ? `${shortCommission(hero)} commission` : null,
          creators: showcaseCreators,
          qrDataUrl,
          href: hero ? `/campaigns/${hero.slug}` : "/campaigns",
        }}
      />

      <TrustedBrands brands={brands.slice(0, 8).map((b) => ({ name: b.name, slug: b.slug, logoUrl: b.logoUrl }))} />

      {/* Product-launch video — directly under the brands strip */}
      <LaunchSection />

      {/* Featured campaigns */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Featured campaigns</h2>
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

      {/* How Refnivo works */}
      <section id="how-it-works" className="scroll-mt-20 bg-linear-to-b from-violet-50/60 to-background py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">How Refnivo works</h2>
            <p className="mt-3 text-muted-foreground">Three steps from a product listing to verified, attributed sales.</p>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {[
              { icon: PackageIcon, step: "01", title: "Brands launch", body: "List a product, set a creator commission and a customer reward, and publish the campaign." },
              { icon: LinkIcon, step: "02", title: "Creators & customers share", body: "Partners get a unique referral link and QR code to share on Instagram, YouTube or WhatsApp." },
              { icon: WalletIcon, step: "03", title: "Everyone earns", body: "Clicks and orders are attributed to the partner. Verified orders release commissions and rewards." },
            ].map((s) => (
              <Card key={s.step} className="rounded-2xl border-indigo-100/80 shadow-sm transition-shadow hover:shadow-md">
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-linear-to-br from-violet-600 to-blue-500 text-white shadow-md shadow-indigo-500/20">
                      <s.icon className="size-5" aria-hidden />
                    </span>
                    <span className="text-xs font-bold tracking-wider text-indigo-500">STEP {s.step}</span>
                  </div>
                  <h3 className="font-semibold text-foreground">{s.title}</h3>
                  <p className="text-sm text-muted-foreground">{s.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits for brands */}
      <BenefitSection
        id="brands"
        eyebrow="For Brands"
        title="Your own affiliate network for every product."
        description="Run performance campaigns without an agency. Pay only for verified orders and see exactly which creators, products and campaigns drive revenue."
        items={["Product catalogue & brand profile", "Commission & reward per product", "Creator applications with audience data", "Link & QR attribution", "Order verification & ledger", "Campaign analytics"]}
        cta={{ href: "/auth/register?role=BRAND_OWNER", label: "Create a brand account" }}
        icon={MegaphoneIcon}
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
        title="Earn commissions on products you actually like."
        description="Browse campaigns by category and commission, apply in one click, and get a link and QR code to share. Track clicks, orders and earnings in one dashboard."
        items={["Campaign marketplace with filters", "Unique referral links & QR codes", "Click, order & sales tracking", "Pending, approved & paid commissions"]}
        cta={{ href: "/auth/register?role=CREATOR", label: "Join as a creator" }}
        icon={UsersIcon}
        reverse
        tinted
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
                <p className="text-xs opacity-80">Example payout</p>
                <p className="text-2xl font-bold">12% per verified order</p>
                <p className="text-xs opacity-80">Commissions are fixed at order time — never changed later.</p>
              </div>
            </CardContent>
          </Card>
        }
      />

      {/* Customer referral */}
      <section id="customers" className="scroll-mt-20 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid items-center gap-8 rounded-3xl border border-indigo-100 bg-linear-to-br from-violet-50 via-white to-blue-50 p-8 shadow-sm sm:p-12 lg:grid-cols-[1fr_auto]">
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
          <div className="relative overflow-hidden rounded-3xl bg-linear-to-r from-violet-600 to-blue-500 px-8 py-12 text-center text-white shadow-xl shadow-indigo-500/25 sm:px-12 sm:py-16">
            <div aria-hidden className="pointer-events-none absolute -top-20 -right-20 size-64 rounded-full bg-white/10 blur-3xl" />
            <h2 className="relative text-2xl font-bold tracking-tight sm:text-4xl">Start growing with Refnivo</h2>
            <p className="relative mx-auto mt-3 max-w-xl text-white/85">
              {stats ? `${stats.brandCount} brands and ${stats.creatorCount} creators are already here.` : "Brands, creators and customers — all in one place."} Join free today.
            </p>
            <div className="relative mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <CTAButton href="/auth/register" variant="light">
                Sign Up
              </CTAButton>
              <CTAButton href="/campaigns" variant="outline" className="border-white/40 bg-transparent text-white hover:bg-white/10">
                Explore Campaigns
              </CTAButton>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
