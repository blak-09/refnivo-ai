import Link from "next/link";
import {
  ArrowRightIcon,
  BarChart3Icon,
  CheckIcon,
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
  type LucideIcon,
} from "lucide-react";
import { HeroSection } from "@/components/marketing/hero-section";
import { TrustedBrands, type LogoItem } from "@/components/marketing/trusted-brands";
import { LaunchSection } from "@/components/marketing/launch-section";
import { CampaignProgramCard } from "@/components/affiliate/campaign-program-card";
import { ProgramCard } from "@/components/affiliate/program-card";
import { ProgramTypeBadge } from "@/components/affiliate/program-badge";
import { CTAButton } from "@/components/marketing/cta-button";
import { ProductShowcase } from "@/components/marketing/product-showcase";
import { shortCommission } from "@/components/campaigns/campaign-summary";
import { programBrandName } from "@/lib/services/affiliate-programs";
import { getLandingData, getMarketplaceQr } from "@/lib/services/landing";

const FEATURES = [
  { icon: MegaphoneIcon, title: "Referral campaigns", body: "Launch a campaign per product with its own commission, customer reward and approval rules." },
  { icon: HandshakeIcon, title: "Creator partnerships", body: "Review creator applications, approve the right partners and keep every collaboration in one place." },
  { icon: CompassIcon, title: "Affiliate discovery", body: "Creators find Refnivo campaigns and brands' own external affiliate programs in one directory." },
  { icon: LinkIcon, title: "Links & QR codes", body: "Every partner gets a unique referral link and QR code to share on social, video or WhatsApp." },
  { icon: ReceiptIcon, title: "Conversion tracking", body: "Clicks are attributed to partners; orders become commissions only after they are verified." },
  { icon: BarChart3Icon, title: "Performance analytics", body: "See clicks, verified conversions and revenue by partner, campaign and date range." },
];

const AUDIENCES: { id: string; icon: LucideIcon; eyebrow: string; title: string; points: string[]; cta: { href: string; label: string } }[] = [
  {
    id: "brands",
    icon: MegaphoneIcon,
    eyebrow: "For Brands",
    title: "Grow with creators you choose",
    points: ["Multi-step campaign builder", "Approve creator applications", "Pay commission on verified orders", "Tracking & analytics by date range"],
    cta: { href: "/auth/register?role=BRAND_OWNER", label: "Start as a brand" },
  },
  {
    id: "creators",
    icon: UsersIcon,
    eyebrow: "For Creators",
    title: "Find brands and track earnings",
    points: ["Refnivo campaigns & external programs", "Unique links and QR codes", "Click & conversion analytics", "Pending, approved & paid commissions"],
    cta: { href: "/auth/register?role=CREATOR", label: "Start as a creator" },
  },
  {
    id: "customers",
    icon: GiftIcon,
    eyebrow: "For Customers",
    title: "Share products, get rewarded",
    points: ["Personal referral link", "Share on WhatsApp in a tap", "Reward when a friend's order is verified", "No follower count required"],
    cta: { href: "/auth/register?role=CUSTOMER", label: "Create a free account" },
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
      <h2 id={id} className="mt-1 text-2xl font-bold tracking-tight text-balance sm:text-4xl">
        {title}
      </h2>
      {body ? <p className="mt-3 text-muted-foreground">{body}</p> : null}
    </div>
  );
}

export default async function LandingPage() {
  // Cached for 60 s and bounded to what is shown (lib/services/landing.ts); renders even if the database is down.
  const [{ campaigns, brands, creators, programs, stats }, qrDataUrl] = await Promise.all([getLandingData(), getMarketplaceQr()]);

  const hero = campaigns[0] ?? null;
  const showcaseCreators = creators.slice(0, 2).map((c) => ({ name: c.displayName, imageUrl: c.profileImageUrl }));

  // Logo strip: Refnivo brands and external programmes that have a real logo, one entry per brand name.
  const seen = new Set<string>();
  const logos: LogoItem[] = [
    ...brands.filter((b) => b.logoUrl && b.slug).map((b) => ({ key: `b-${b.slug}`, name: b.name, logoUrl: b.logoUrl!, href: `/brands/${b.slug}` })),
    ...programs.flatMap((p) => {
      const logoUrl = p.logoUrl ?? p.brand?.logoUrl;
      return logoUrl ? [{ key: `p-${p.slug}`, name: programBrandName(p), logoUrl, href: `/affiliate-programs/${p.slug}` }] : [];
    }),
  ].filter((l) => {
    const k = l.name.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  // Directory preview: up to three Refnivo campaigns, filled with featured external programmes.
  const previewCampaigns = campaigns.slice(0, 3);
  const previewPrograms = programs.slice(0, 6 - previewCampaigns.length);

  const statItems = stats
    ? [
        { value: stats.activeCampaigns, label: "Live Refnivo campaigns" },
        { value: stats.externalPrograms, label: "External programs listed" },
        { value: stats.brandCount, label: "Brands on Refnivo" },
        { value: stats.creatorCount, label: "Creators on Refnivo" },
      ]
    : [];

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

      {/* Who it's for */}
      <section aria-labelledby="audience-heading" className="bg-muted/30 py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading id="audience-heading" eyebrow="Who it's for" title="Built for every side of a referral" center />
          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {AUDIENCES.map((a) => (
              <article key={a.id} id={a.id} className="flex scroll-mt-24 flex-col rounded-2xl border bg-card p-6 shadow-xs">
                <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                  <a.icon className="size-4" aria-hidden />
                  {a.eyebrow}
                </p>
                <h3 className="mt-2 text-xl font-semibold tracking-tight">{a.title}</h3>
                <ul className="mt-4 flex-1 space-y-2.5">
                  {a.points.map((pt) => (
                    <li key={pt} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckIcon className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
                      {pt}
                    </li>
                  ))}
                </ul>
                <CTAButton href={a.cta.href} size="default" variant="outline" className="mt-6 w-full">
                  {a.cta.label}
                </CTAButton>
              </article>
            ))}
          </div>
          {statItems.length ? (
            <dl className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border bg-border lg:grid-cols-4">
              {statItems.map((s) => (
                <div key={s.label} className="bg-card px-5 py-4 text-center">
                  <dd className="text-2xl font-bold tracking-tight tabular-nums">{s.value}</dd>
                  <dt className="mt-0.5 text-xs text-muted-foreground">{s.label}</dt>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      </section>

      {/* Affiliate discovery: a real preview of the directory */}
      <section id="discovery" aria-labelledby="discovery-heading" className="scroll-mt-20 py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <SectionHeading
              id="discovery-heading"
              eyebrow="Affiliate Discovery"
              title="Programs you can promote today"
              body="Two kinds of programs, always labelled so you know who runs the tracking and pays the commission."
            />
            <Link href="/affiliate-programs" className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-indigo-600 hover:underline dark:text-indigo-400">
              View all programs <ArrowRightIcon className="size-4" aria-hidden />
            </Link>
          </div>
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <ProgramTypeBadge type="REFNIVO" /> joined and tracked on Refnivo
            </span>
            <span className="inline-flex items-center gap-2">
              <ProgramTypeBadge type="EXTERNAL" /> run by the brand, listed for discovery
            </span>
          </div>
          {previewCampaigns.length + previewPrograms.length ? (
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {previewCampaigns.map((c) => (
                <li key={c.id}>
                  <CampaignProgramCard campaign={c} />
                </li>
              ))}
              {previewPrograms.map((p) => (
                <li key={p.id}>
                  <ProgramCard program={p} />
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>

      {/* Track every conversion */}
      <section id="how-it-works" aria-labelledby="flow-heading" className="scroll-mt-20 overflow-hidden bg-muted/30 py-20 sm:py-24">
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
