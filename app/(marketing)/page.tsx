import Link from "next/link";
import {
  BarChart3Icon,
  BotIcon,
  CheckCircle2Icon,
  GiftIcon,
  LinkIcon,
  MegaphoneIcon,
  PackageIcon,
  QrCodeIcon,
  Share2Icon,
  SparklesIcon,
  UsersIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CampaignCard } from "@/components/marketplace/campaign-card";
import { listMarketplaceCampaigns } from "@/lib/services/campaigns";

function FeatureList({ items }: { items: string[] }) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2 text-sm">
          <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function AudienceSection({ id, eyebrow, title, description, items, cta, icon: Icon, reverse }: { id: string; eyebrow: string; title: string; description: string; items: string[]; cta: { href: string; label: string }; icon: LucideIcon; reverse?: boolean }) {
  return (
    <section id={id} className="scroll-mt-20 border-t py-16 sm:py-20">
      <div className={`mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-6 md:grid-cols-2 ${reverse ? "md:[&>*:first-child]:order-2" : ""}`}>
        <div className="space-y-5">
          <p className="text-sm font-semibold text-primary">{eyebrow}</p>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
          <p className="text-muted-foreground">{description}</p>
          <FeatureList items={items} />
          <Button nativeButton={false} render={<Link href={cta.href} />}>{cta.label}</Button>
        </div>
        <div className="flex aspect-[4/3] items-center justify-center rounded-2xl border bg-gradient-to-br from-accent to-background">
          <Icon className="size-20 text-primary/70" aria-hidden />
        </div>
      </div>
    </section>
  );
}

export default async function LandingPage() {
  // The landing page must render even if the database is unreachable.
  const featured = await listMarketplaceCampaigns({ sort: "trending" })
    .then((rows) => rows.slice(0, 4))
    .catch((err) => {
      console.error("[landing] could not load featured campaigns", err instanceof Error ? err.message : err);
      return [];
    });

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,var(--accent),transparent_60%)]" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-4 pt-20 pb-16 text-center sm:px-6 sm:pt-28 sm:pb-24">
          <p className="mb-4 inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
            <SparklesIcon className="size-3.5 text-primary" aria-hidden />
            Affiliate &amp; referral infrastructure for product brands
          </p>
          <h1 className="mx-auto max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl md:text-6xl">
            Turn Creators and Customers Into Your Sales Engine.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground text-pretty">
            List your products, launch commission-based campaigns, and let creators and customers sell for you with unique referral links and QR codes — every click, order and payout tracked.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button size="lg" nativeButton={false} render={<Link href="/auth/register?role=BRAND_OWNER" />}>
              List your brand
            </Button>
            <Button size="lg" variant="outline" nativeButton={false} render={<Link href="/campaigns" />}>
              Discover campaigns
            </Button>
            <Button size="lg" variant="ghost" nativeButton={false} render={<Link href="/how-it-works" />}>
              How it works
            </Button>
          </div>
        </div>
      </section>

      {/* Featured campaigns */}
      {featured.length ? (
        <section className="border-t py-12">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="flex items-end justify-between">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">Trending campaigns</h2>
                <p className="text-sm text-muted-foreground">Products brands want promoted right now.</p>
              </div>
              <Link href="/campaigns" className="text-sm font-medium text-primary hover:underline">
                See all
              </Link>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {featured.map((c) => (
                <CampaignCard key={c.id} c={c} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-20 border-t bg-muted/30 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">How it works</h2>
            <p className="mt-3 text-muted-foreground">Three steps from a product listing to verified, attributed sales.</p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              { icon: PackageIcon, step: "1", title: "List products & launch a campaign", body: "A brand like boAt adds a product, sets a creator commission and a customer referral reward, and publishes to the marketplace." },
              { icon: LinkIcon, step: "2", title: "Creators & customers share links", body: "Partners join, get a unique referral link and QR code, and share it on Instagram, YouTube, WhatsApp — anywhere." },
              { icon: WalletIcon, step: "3", title: "Track orders, pay commissions", body: "Clicks, QR scans and orders are attributed to the partner. The brand verifies orders; commissions and rewards land in the ledger." },
            ].map((s) => (
              <Card key={s.step}>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <s.icon className="size-5" aria-hidden />
                    </span>
                    <span className="text-xs font-semibold text-muted-foreground">STEP {s.step}</span>
                  </div>
                  <h3 className="font-semibold">{s.title}</h3>
                  <p className="text-sm text-muted-foreground">{s.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <AudienceSection
        id="brands"
        eyebrow="For Brands"
        title="Your own affiliate network for every product."
        description="Run performance campaigns without an agency. Pay only for verified orders and see exactly which creators, products and campaigns drive revenue."
        items={["Product catalogue & brand profile", "Commission and reward campaigns per product", "Creator applications with audience data", "Referral link & QR tracking", "Order verification & commission ledger", "Analytics and AI insights"]}
        cta={{ href: "/auth/register?role=BRAND_OWNER", label: "Create a brand account" }}
        icon={MegaphoneIcon}
      />

      <AudienceSection
        id="creators"
        eyebrow="For Creators"
        title="Earn commissions on products you actually like."
        description="Browse campaigns by category and commission, apply in one click, and get a link and QR code to share. Track clicks, orders and earnings in one dashboard."
        items={["Campaign marketplace with filters", "Unique referral links & downloadable QR codes", "Click, conversion & sales tracking", "Pending, approved and paid commissions", "AI captions and content ideas"]}
        cta={{ href: "/auth/register?role=CREATOR", label: "Join as a creator" }}
        icon={UsersIcon}
        reverse
      />

      <AudienceSection
        id="customers"
        eyebrow="For Customers"
        title="Share products with friends. Get rewarded."
        description="Love a product? Get your personal link, share it on WhatsApp, and earn a reward every time a friend's order is verified."
        items={["Personal referral link & QR code", "One-tap sharing", "Reward tracking", "No follower count required"]}
        cta={{ href: "/auth/register?role=CUSTOMER", label: "Create a free account" }}
        icon={GiftIcon}
      />

      {/* AI */}
      <section id="ai" className="scroll-mt-20 border-t bg-muted/30 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold text-primary">AI that assists, never invents</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Grounded AI for affiliate growth</h2>
            <p className="mt-3 text-muted-foreground">Every suggestion is labelled as a suggestion. Every insight is computed from your real data. The AI never moves money.</p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: BotIcon, title: "AI Campaign Generator", body: "Enter a product and a goal — get a campaign title, description, commission and reward suggestions, and rules." },
              { icon: UsersIcon, title: "AI Creator Matching", body: "Recommends creators by category, audience, location, followers and engagement — with a readable explanation." },
              { icon: Share2Icon, title: "AI Content Assistant", body: "Instagram captions, reel ideas, YouTube descriptions and WhatsApp messages for any campaign." },
              { icon: BarChart3Icon, title: "AI Campaign Insights", body: "Which products, creators and campaigns perform best — and what to try next." },
            ].map((f) => (
              <Card key={f.title} size="sm">
                <CardContent className="space-y-2">
                  <f.icon className="size-5 text-primary" aria-hidden />
                  <h3 className="text-sm font-semibold">{f.title}</h3>
                  <p className="text-sm text-muted-foreground">{f.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-t py-12">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 sm:grid-cols-3 sm:px-6">
          {[
            { icon: QrCodeIcon, title: "Clicks are not sales", body: "Links and QR scans establish attribution. Only orders the brand verifies create commissions." },
            { icon: WalletIcon, title: "Transparent ledger", body: "Commissions and rewards are tracked in exact rupees — pending, approved and paid." },
            { icon: CheckCircle2Icon, title: "Honest creator data", body: "Follower counts are labelled self-reported until a social API is connected." },
          ].map((t) => (
            <div key={t.title} className="flex gap-3">
              <t.icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
              <div>
                <h3 className="text-sm font-semibold">{t.title}</h3>
                <p className="text-sm text-muted-foreground">{t.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
