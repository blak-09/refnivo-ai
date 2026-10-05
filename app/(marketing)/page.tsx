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
import { commissionText, NOT_DISCLOSED, ProgramTypeBadge } from "@/components/affiliate/program-badge";
import { CampaignBuilderVisual, ProgramListVisual, SplitSection, type ProgramRow } from "@/components/marketing/landing-visuals";
import { CTAButton } from "@/components/marketing/cta-button";
import { ProductShowcase } from "@/components/marketing/product-showcase";
import { shortCommission } from "@/components/campaigns/campaign-summary";
import { programBrandName } from "@/lib/services/affiliate-programs";
import { campaignCategory, campaignCommission } from "@/lib/services/directory";
import { getLandingData, getMarketplaceQr } from "@/lib/services/landing";
import { cn } from "@/lib/utils";
import { CircleCallout, CommunityHomeBand } from "@/components/community/community-ui";

const FEATURES = [
  { icon: MegaphoneIcon, title: "Referral campaigns", body: "Launch a campaign per product with its own commission, customer reward and approval rules." },
  { icon: HandshakeIcon, title: "Creator partnerships", body: "Review creator applications, approve the right partners and keep every collaboration in one place." },
  { icon: CompassIcon, title: "Affiliate discovery", body: "Creators find Refnivo campaigns and brands' own external affiliate programs in one directory." },
  { icon: LinkIcon, title: "Links & QR codes", body: "Every partner gets a unique referral link and QR code to share on social, video or WhatsApp." },
  { icon: ReceiptIcon, title: "Conversion tracking", body: "Clicks are attributed to partners; orders become commissions only after they are verified." },
  { icon: BarChart3Icon, title: "Performance analytics", body: "See clicks, verified conversions and revenue by partner, campaign and date range." },
];

const PROGRAM_TYPES: { type: "REFNIVO" | "EXTERNAL"; title: string; body: string; facts: [string, string][]; href: string; cta: string }[] = [
  {
    type: "REFNIVO",
    title: "Refnivo Campaign",
    body: "Run on Refnivo end to end. Join in one click and Refnivo tracks every verified order and commission.",
    facts: [
      ["Join", "On Refnivo"],
      ["Tracking", "Refnivo links & QR codes"],
      ["Commission", "Recorded on Refnivo"],
      ["Analytics", "Clicks, conversions, earnings"],
    ],
    href: "/affiliate-programs?kind=refnivo",
    cta: "Browse Refnivo campaigns",
  },
  {
    type: "EXTERNAL",
    title: "External Affiliate Program",
    body: "A brand's own program, listed for discovery. The brand handles approval, tracking and payouts.",
    facts: [
      ["Join", "On the official program page"],
      ["Tracking", "The brand's network"],
      ["Commission", "Paid by the brand"],
      ["Analytics", "Link clicks on Refnivo"],
    ],
    href: "/affiliate-programs?kind=external",
    cta: "Explore external programs",
  },
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
  const [{ campaigns, brands, creators, programs, stats }, qrDataUrl] = await Promise.all([getLandingData(), getMarketplaceQr()]);

  const hero = campaigns[0] ?? null;
  const showcaseCreators = creators.slice(0, 2).map((c) => ({ name: c.displayName, imageUrl: c.profileImageUrl }));

  // Logo strip: verified Refnivo brands and published external programmes with a real logo,
  // one entry per brand name, in a stable mixed order (not A–Z) so the strip never starts "A, A, A".
  const seen = new Set<string>();
  const mixKey = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const logos: LogoItem[] = [
    ...brands
      .filter((b) => b.logoUrl && b.slug && b.verificationStatus === "VERIFIED")
      .map((b) => ({ key: `b-${b.slug}`, name: b.name, logoUrl: b.logoUrl!, href: `/brands/${b.slug}` })),
    ...programs.flatMap((p) => {
      const logoUrl = p.logoUrl ?? p.brand?.logoUrl;
      return logoUrl ? [{ key: `p-${p.slug}`, name: programBrandName(p), logoUrl, href: `/affiliate-programs/${p.slug}` }] : [];
    }),
  ]
    .filter((l) => {
      const k = l.name.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => mixKey(a.key) - mixKey(b.key));

  // Creator visual: a few real listings — Refnivo campaigns first (one per brand), then external programmes.
  const campaignBrands = new Set<string>();
  const programRows: ProgramRow[] = [
    ...campaigns
      .filter((c) => !campaignBrands.has(c.brand.name) && !!campaignBrands.add(c.brand.name))
      .slice(0, 2)
      .map((c) => ({
      key: `c-${c.id}`,
      name: c.brand.name,
      logoUrl: c.brand.logoUrl,
      detail: `${campaignCategory(c)} · ${campaignCommission(c)}`,
      type: "REFNIVO" as const,
      href: `/campaigns/${c.slug}`,
    })),
    ...programs.map((p) => {
      const commission = commissionText(p);
      return {
        key: `p-${p.id}`,
        name: programBrandName(p),
        logoUrl: p.logoUrl ?? p.brand?.logoUrl ?? null,
        detail: `${p.category ?? "Affiliate program"} · ${commission === NOT_DISCLOSED ? "Commission: see program terms" : commission}`,
        type: "EXTERNAL" as const,
        href: `/affiliate-programs/${p.slug}`,
      };
    }),
  ].slice(0, 4);

  return (
    <>
      <HeroSection />

      <TrustedBrands items={logos} total={stats?.externalPrograms ?? null} />

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
        body="Join Refnivo campaigns in one click or discover brands' own affiliate programs, then follow clicks, conversions and earnings in one dashboard."
        points={["Refnivo campaigns & external programs", "Unique links and QR codes", "Click & conversion analytics", "Pending, approved & paid commissions"]}
        cta={{ href: "/auth/register?role=CREATOR", label: "Start as a creator" }}
        visual={<ProgramListVisual rows={programRows} />}
        reverse
        extra={<CircleCallout audience="CREATOR" placement="home-creators" className="mt-8" />}
      />

      {/* Affiliate discovery: the two programme types, side by side */}
      <section id="discovery" aria-labelledby="discovery-heading" className="scroll-mt-20 bg-muted/30 py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading
            id="discovery-heading"
            eyebrow="Affiliate Discovery"
            title="Two kinds of programs, clearly labelled"
            body="Every listing tells you who runs the tracking and who pays the commission, before you join."
            center
          />
          <div className="mx-auto mt-12 grid max-w-5xl gap-5 md:grid-cols-2">
            {PROGRAM_TYPES.map((t) => (
              <article
                key={t.type}
                className={cn(
                  "flex flex-col rounded-2xl border bg-card p-6 shadow-xs sm:p-8",
                  t.type === "REFNIVO" && "border-indigo-200 ring-1 ring-indigo-100 dark:border-indigo-900 dark:ring-indigo-950",
                )}
              >
                <ProgramTypeBadge type={t.type} className="self-start" />
                <h3 className="mt-4 text-xl font-semibold tracking-tight">{t.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{t.body}</p>
                <dl className="mt-6 flex-1 divide-y border-y text-sm">
                  {t.facts.map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between gap-4 py-3">
                      <dt className="text-muted-foreground">{k}</dt>
                      <dd className="text-right font-medium">{v}</dd>
                    </div>
                  ))}
                </dl>
                <CTAButton href={t.href} size="default" variant={t.type === "REFNIVO" ? "gradient" : "outline"} className="mt-6 w-full">
                  {t.cta}
                </CTAButton>
              </article>
            ))}
          </div>
        </div>
      </section>

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
