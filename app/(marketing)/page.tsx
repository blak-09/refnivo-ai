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
import { HeroSection } from "@/components/marketing/hero-section";
import { TrustedBrands, type LogoItem } from "@/components/marketing/trusted-brands";
import { LaunchSection } from "@/components/marketing/launch-section";
import { CampaignBuilderVisual, ProgramListVisual, SplitSection, type ProgramRow } from "@/components/marketing/landing-visuals";
import { CTAButton } from "@/components/marketing/cta-button";
import { ProductShowcase } from "@/components/marketing/product-showcase";
import { shortCommission } from "@/components/campaigns/campaign-summary";
import { campaignCategory, campaignCommission } from "@/lib/services/directory";
import { getLandingData, getMarketplaceQr } from "@/lib/services/landing";
import { CircleCallout, CommunityHomeBand } from "@/components/community/community-ui";

const FEATURES = [
  { icon: MegaphoneIcon, title: "Referral campaigns", body: "Launch a campaign per product with its own commission, customer reward and approval rules." },
  { icon: HandshakeIcon, title: "Creator partnerships", body: "Review creator applications, approve the right partners and keep every collaboration in one place." },
  { icon: CompassIcon, title: "Campaign marketplace", body: "Creators discover live Refnivo campaigns, see the commission up front and join in a click." },
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

function SectionHeading({ id, eyebrow, title, body, center = false }: { id: string; eyebrow: string; title: string; body?: string; center?: boolean }) {
  return (
    <div className={center ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">{eyebrow}</p>
      <h2 id={id} className="mt-1 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
        {title}
      </h2>
      {body ? <p className="mt-3 text-lg text-muted-foreground">{body}</p> : null}
    </div>
  );
}

export default async function LandingPage() {
  // Cached for 60 s and bounded to what is shown (lib/services/landing.ts); renders even if the database is down.
  const [{ campaigns, brands, creators }, qrDataUrl] = await Promise.all([getLandingData(), getMarketplaceQr()]);

  const hero = campaigns[0] ?? null;
  const showcaseCreators = creators.slice(0, 2).map((c) => ({ name: c.displayName, imageUrl: c.profileImageUrl }));

  // Logo strip: verified Refnivo brands with a real logo, in a stable mixed order (not A–Z).
  const mixKey = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const logos: LogoItem[] = brands
    .filter((b) => b.logoUrl && b.slug && b.verificationStatus === "VERIFIED")
    .map((b) => ({ key: `b-${b.slug}`, name: b.name, logoUrl: b.logoUrl!, href: `/brands/${b.slug}` }))
    .sort((a, b) => mixKey(a.key) - mixKey(b.key));

  // Creator visual: a few live Refnivo campaigns, one per brand.
  const campaignBrands = new Set<string>();
  const programRows: ProgramRow[] = campaigns
    .filter((c) => !campaignBrands.has(c.brand.name) && !!campaignBrands.add(c.brand.name))
    .slice(0, 4)
    .map((c) => ({
      key: `c-${c.id}`,
      name: c.brand.name,
      logoUrl: c.brand.logoUrl,
      detail: `${campaignCategory(c)} · ${campaignCommission(c)}`,
      href: `/campaigns/${c.slug}`,
    }));

  return (
    <>
      <HeroSection />

      <TrustedBrands items={logos} />

      {/* One platform, multiple growth channels */}
      <section id="product" aria-labelledby="platform-heading" className="scroll-mt-20 py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading
            id="platform-heading"
            eyebrow="The platform"
            title="One Platform. Multiple Growth Channels."
            body="Refnivo connects brands and creators through affiliate campaigns, referrals and performance-based partnerships."
            center
          />
          <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-card p-6 transition-colors hover:bg-muted/40">
                <span className="flex size-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300">
                  <f.icon className="size-5" aria-hidden />
                </span>
                <h3 className="mt-4 font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <SplitSection
        id="brands"
        icon={MegaphoneIcon}
        eyebrow="For Brands"
        title="Launch campaigns and grow with creators you choose"
        body="Create a campaign for each product, approve the creators who apply, and pay commission only on orders you verify."
        points={["Multi-step campaign builder", "Creator applications & approval", "Link & QR attribution", "Tracking & analytics by date range"]}
        cta={{ href: "/auth/register?role=BRAND_OWNER", label: "Start as a brand" }}
        visual={<CampaignBuilderVisual />}
        tinted
        extra={<CircleCallout audience="BRAND" placement="home-brands" className="mt-8" />}
      />

      <SplitSection
        id="creators"
        icon={UsersIcon}
        eyebrow="For Creators"
        title="Find brands to promote and track what you earn"
        body="Join Refnivo campaigns in one click, share your link and QR code, then follow clicks, conversions and earnings in one dashboard."
        points={["Live Refnivo campaigns", "Unique links and QR codes", "Click & conversion analytics", "Pending, approved & paid commissions"]}
        cta={{ href: "/auth/register?role=CREATOR", label: "Start as a creator" }}
        visual={<ProgramListVisual rows={programRows} />}
        reverse
        extra={<CircleCallout audience="CREATOR" placement="home-creators" className="mt-8" />}
      />

      {/* Track every conversion */}
      <section id="how-it-works" aria-labelledby="flow-heading" className="scroll-mt-20 overflow-hidden py-20 sm:py-24">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
          <div>
            <SectionHeading
              id="flow-heading"
              eyebrow="Attribution"
              title="Track Every Conversion"
              body="Each partner shares a unique link. Refnivo attributes the click, the brand verifies the order, and only then is the commission recorded."
            />
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

      {/* Product-launch video */}
      <LaunchSection />

      {/* Customers */}
      <section id="customers" aria-labelledby="customers-heading" className="scroll-mt-20 pb-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col gap-6 rounded-2xl border bg-card p-6 sm:p-8 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300">
                <GiftIcon className="size-5" aria-hidden />
              </span>
              <div>
                <h2 id="customers-heading" className="text-lg font-semibold tracking-tight">
                  Customers can earn too
                </h2>
                <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                  Share a product you love with a personal link and get rewarded when a friend&apos;s order is verified. No follower count required.
                </p>
              </div>
            </div>
            <CTAButton href="/auth/register?role=CUSTOMER" size="default" variant="outline" className="shrink-0">
              Create a free account
            </CTAButton>
          </div>
        </div>
      </section>

      {/* Refnivo Network (community) */}
      <CommunityHomeBand />

      {/* Final CTA */}
      <section className="pb-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="relative overflow-hidden rounded-3xl bg-linear-to-r from-violet-600 to-blue-500 px-6 py-12 text-center text-white shadow-xl shadow-indigo-500/25 sm:px-12 sm:py-16">
            <div aria-hidden className="pointer-events-none absolute -top-20 -right-20 size-64 rounded-full bg-white/10 blur-3xl" />
            <h2 className="relative text-2xl font-bold tracking-tight sm:text-4xl">Start growing with Refnivo</h2>
            <p className="relative mx-auto mt-3 max-w-xl text-white/85">Launch a campaign, find brands to promote, or share products you love. Free during early access.</p>
            <div className="relative mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <CTAButton href="/auth/register" variant="light">
                Get Started
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
