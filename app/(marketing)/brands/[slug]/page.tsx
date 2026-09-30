import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ConnectButton } from "@/components/connections/connect-button";
import { connectStateForBrand } from "@/lib/services/connect-state";
import { BadgeCheckIcon, ExternalLinkIcon, GlobeIcon, HandshakeIcon, MegaphoneIcon, StoreIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/dashboard/primitives";
import { BrandLogo, ProductThumb } from "@/components/products/product-thumb";
import { ProgramCard } from "@/components/affiliate/program-card";
import { ProgramTypeBadge } from "@/components/affiliate/program-badge";
import { FloatingProfile } from "@/components/marketing/product-showcase";
import { shortCommission, shortReward } from "@/components/campaigns/campaign-summary";
import { formatMoney } from "@/lib/money";
import { getBrandCollaborators, getPublicBrand } from "@/lib/services/brands";
import { listPublicProgramsForBrand } from "@/lib/services/affiliate-programs";
import { formatDate } from "@/lib/utils/dates";
import { VERIFICATION_LABEL } from "@/lib/utils/labels";
import type { BrandSocialLinks } from "@/lib/validation/brand";
import { cn } from "@/lib/utils";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const b = await getPublicBrand(slug);
  return { title: b?.name ?? "Brand" };
}

const SOCIAL_LABEL: Record<string, string> = { instagram: "Instagram", youtube: "YouTube", twitter: "X", facebook: "Facebook", linkedin: "LinkedIn" };

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "campaigns", label: "Campaigns" },
  { value: "programs", label: "Affiliate Programs" },
  { value: "collaborations", label: "Collaborations" },
] as const;
type Tab = (typeof TABS)[number]["value"];

type BrandCampaign = NonNullable<Awaited<ReturnType<typeof getPublicBrand>>>["campaigns"][number];

function CampaignRow({ c }: { c: BrandCampaign }) {
  return (
    <Card size="sm" className="border-indigo-100 dark:border-indigo-900/50">
      <CardContent className="flex gap-3">
        <ProductThumb src={c.product.imageUrl} name={c.product.name} className="size-16" />
        <div className="min-w-0 flex-1">
          <Link href={`/campaigns/${c.slug}`} className="block truncate text-sm font-semibold hover:underline">
            {c.product.name}
          </Link>
          <p className="truncate text-xs text-muted-foreground">{c.name}</p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {c.campaignType !== "CUSTOMER_REFERRAL" ? <Badge>Creators {shortCommission(c)}</Badge> : null}
            {c.campaignType !== "CREATOR_AFFILIATE" ? <Badge variant="secondary">Customers {shortReward(c)}</Badge> : null}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {c._count.partnerApplications} {c._count.partnerApplications === 1 ? "creator" : "creators"}{c.endDate ? ` · ends ${formatDate(c.endDate)}` : ""}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default async function BrandProfilePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ tab?: string }> }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const brand = await getPublicBrand(slug);
  if (!brand) notFound();
  const tab: Tab = TABS.some((t) => t.value === sp.tab) ? (sp.tab as Tab) : "overview";
  const social = (brand.socialLinks ?? {}) as BrandSocialLinks;
  // Only rendered for a signed-in creator who could actually connect.
  const [{ state: connectState }, programs, collaborators] = await Promise.all([
    connectStateForBrand(brand.id),
    listPublicProgramsForBrand({ id: brand.id, name: brand.name }),
    getBrandCollaborators(brand.id),
  ]);
  const counts: Record<Tab, number | null> = {
    overview: null,
    campaigns: brand.campaigns.length,
    programs: brand.campaigns.length + programs.length,
    collaborations: collaborators.length,
  };

  return (
    <div>
      <div
        className="h-40 bg-gradient-to-r from-accent to-muted sm:h-56"
        style={brand.coverImageUrl ? { backgroundImage: `url(${brand.coverImageUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
      />
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="-mt-10 flex flex-col gap-4 sm:flex-row sm:items-end">
          <BrandLogo src={brand.logoUrl} name={brand.name} className="size-24 rounded-2xl border-4 border-background text-2xl shadow-sm" />
          <div className="flex-1 pb-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{brand.name}</h1>
              <Badge variant="outline" className={brand.verificationStatus === "VERIFIED" ? "gap-1 border-primary/30 text-primary" : "text-muted-foreground"}>
                {brand.verificationStatus === "VERIFIED" ? <BadgeCheckIcon className="size-3" /> : null}
                {VERIFICATION_LABEL[brand.verificationStatus]}
              </Badge>
            </div>
            {brand.tagline ? <p className="text-muted-foreground">{brand.tagline}</p> : null}
            <div className="pt-2">
              <ConnectButton target={{ kind: "BRAND", brandId: brand.id }} name={brand.name} state={connectState} size="sm" />
            </div>
          </div>
        </div>

        <nav className="-mx-4 mt-6 flex gap-1 overflow-x-auto border-b px-4 sm:mx-0 sm:px-0" role="tablist" aria-label="Brand profile">
          {TABS.map((t) => (
            <Link
              key={t.value}
              href={t.value === "overview" ? `/brands/${slug}` : `/brands/${slug}?tab=${t.value}`}
              scroll={false}
              role="tab"
              aria-selected={tab === t.value}
              className={cn(
                "-mb-px inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
                tab === t.value ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
              {counts[t.value] !== null ? <span className="rounded-full bg-muted px-1.5 text-[11px] tabular-nums">{counts[t.value]}</span> : null}
            </Link>
          ))}
        </nav>

        <div className="mt-6 grid gap-8 pb-16 lg:grid-cols-[1fr_300px]">
          <div className="min-w-0 space-y-8" role="tabpanel">
            {tab === "overview" ? (
              <>
                {brand.description ? <p className="text-sm whitespace-pre-line text-muted-foreground">{brand.description}</p> : null}
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    { label: "Refnivo campaigns", value: brand.campaigns.length, tab: "campaigns" },
                    { label: "External programs", value: programs.length, tab: "programs" },
                    { label: "Creator collaborations", value: collaborators.length, tab: "collaborations" },
                  ].map((s) => (
                    <Link key={s.label} href={`/brands/${slug}?tab=${s.tab}`} scroll={false} className="rounded-xl border bg-card p-4 transition-colors hover:bg-muted/40">
                      <p className="text-2xl font-bold tabular-nums">{s.value}</p>
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                    </Link>
                  ))}
                </div>
                <section>
                  <h2 className="text-lg font-semibold">Products ({brand._count.products})</h2>
                  {!brand.products.length ? (
                    <p className="mt-2 text-sm text-muted-foreground">No products listed yet.</p>
                  ) : (
                    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                      {brand.products.map((p) => (
                        <Link key={p.id} href={`/products/${p.slug}`} className="group rounded-xl border p-2 transition-colors hover:bg-muted/40">
                          <ProductThumb src={p.imageUrl} name={p.name} className="aspect-square w-full" />
                          <p className="mt-2 truncate text-sm font-medium group-hover:underline">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{formatMoney(p.price, p.currency)}</p>
                        </Link>
                      ))}
                    </div>
                  )}
                </section>
              </>
            ) : null}

            {tab === "campaigns" ? (
              <section>
                <h2 className="text-lg font-semibold">Active Refnivo campaigns ({brand.campaigns.length})</h2>
                {!brand.campaigns.length ? (
                  <EmptyState className="mt-3" icon={MegaphoneIcon} title="No live campaigns right now" description="This brand has no active Refnivo campaigns at the moment." />
                ) : (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {brand.campaigns.map((c) => (
                      <CampaignRow key={c.id} c={c} />
                    ))}
                  </div>
                )}
              </section>
            ) : null}

            {tab === "programs" ? (
              <>
                <section>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold">Refnivo Campaigns</h2>
                    <ProgramTypeBadge type="REFNIVO" />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">Joined and tracked on Refnivo. Commissions are recorded here once orders are verified.</p>
                  {!brand.campaigns.length ? (
                    <p className="mt-3 text-sm text-muted-foreground">No active Refnivo campaigns.</p>
                  ) : (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {brand.campaigns.map((c) => (
                        <CampaignRow key={c.id} c={c} />
                      ))}
                    </div>
                  )}
                </section>
                <section>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold">External Affiliate Programs</h2>
                    <ProgramTypeBadge type="EXTERNAL" />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Managed by the brand or its network. Refnivo lists them for discovery and does not control their approval, tracking or payouts.
                  </p>
                  {!programs.length ? (
                    <p className="mt-3 text-sm text-muted-foreground">No external affiliate programs listed.</p>
                  ) : (
                    <ul className="mt-3 grid gap-4 sm:grid-cols-2">
                      {programs.map((p) => (
                        <li key={p.id}>
                          <ProgramCard program={p} />
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </>
            ) : null}

            {tab === "collaborations" ? (
              <section>
                <h2 className="text-lg font-semibold">Creator collaborations</h2>
                <p className="mt-1 text-sm text-muted-foreground">Creators approved on this brand&apos;s campaigns or connected with the brand on Refnivo.</p>
                {!collaborators.length ? (
                  <EmptyState className="mt-3" icon={HandshakeIcon} title="No collaborations yet" description="Creators who partner with this brand on Refnivo will appear here." />
                ) : (
                  <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {collaborators.map((c) => (
                      <li key={c.username}>
                        <Link href={`/creators/${c.username}`} className="flex flex-col items-center gap-2 rounded-xl border bg-card p-4 text-center transition-colors hover:bg-muted/40">
                          <FloatingProfile creator={{ name: c.displayName, imageUrl: c.profileImageUrl }} className="size-14" />
                          <span className="flex max-w-full items-center gap-1 truncate text-sm font-medium">
                            <span className="truncate">{c.displayName}</span>
                            {c.verificationStatus === "VERIFIED" ? <BadgeCheckIcon className="size-3.5 shrink-0 text-primary" aria-label="Verified creator" /> : null}
                          </span>
                          {c.category ? <span className="truncate text-xs text-muted-foreground">{c.category}</span> : null}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ) : null}
          </div>

          <aside className="space-y-4">
            <Card size="sm">
              <CardContent className="space-y-2 text-sm">
                <p className="font-medium">About</p>
                {brand.industry ? <p className="text-muted-foreground">{brand.industry}</p> : null}
                <p className="text-muted-foreground">{brand.country}</p>
                {brand.website ? (
                  <a href={brand.website} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1 text-primary hover:underline">
                    <GlobeIcon className="size-3.5 shrink-0" /> <span className="truncate">{brand.website.replace(/^https?:\/\//, "")}</span>{" "}
                    <ExternalLinkIcon className="size-3 shrink-0" />
                  </a>
                ) : null}
                {Object.entries(social).filter(([, v]) => v).length ? (
                  <ul className="space-y-1 pt-1">
                    {Object.entries(social).map(([k, v]) =>
                      v ? (
                        <li key={k}>
                          <a href={v} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                            {SOCIAL_LABEL[k] ?? k} <ExternalLinkIcon className="size-3" />
                          </a>
                        </li>
                      ) : null,
                    )}
                  </ul>
                ) : null}
                <p className="pt-1 text-xs text-muted-foreground">On Refnivo AI since {formatDate(brand.createdAt)}</p>
              </CardContent>
            </Card>
            <Card size="sm">
              <CardContent className="space-y-2 text-sm">
                <p className="inline-flex items-center gap-1.5 font-medium">
                  <StoreIcon className="size-4 text-muted-foreground" aria-hidden /> Looking for more brands?
                </p>
                <p className="text-muted-foreground">Browse every Refnivo campaign and external affiliate program in one directory.</p>
                <Link href="/affiliate-programs" className="font-medium text-primary hover:underline">
                  Discover Affiliate Programs
                </Link>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </div>
  );
}
