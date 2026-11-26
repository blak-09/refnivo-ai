import Link from "next/link";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { BadgeCheckIcon, CheckCircle2Icon, ClockIcon, ExternalLinkIcon, ShoppingBagIcon, UsersIcon, XCircleIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/dashboard/primitives";
import { describeCreatorCommission, describeCustomerReward, describeEligibility, describeDuration, shortCommission, shortReward } from "@/components/campaigns/campaign-summary";
import { CouponCode } from "@/components/campaigns/coupon-code";
import { OrderClaimForm } from "@/components/orders/order-claim-form";
import { BrandLogo, ProductThumb } from "@/components/products/product-thumb";
import { JoinCampaignPanel } from "@/components/marketplace/join-campaign";
import { ReferralLinkCard } from "@/components/links/referral-link-card";
import { getCurrentUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { acceptsOrderClaims, campaignVisibility, isCampaignLive } from "@/lib/domain/campaign-rules";
import { formatMoney } from "@/lib/money";
import { getPublicCampaign } from "@/lib/services/campaigns";
import { referralQrDataUrl, referralUrl, shareTargets } from "@/lib/services/links";
import { getPartnerStatus } from "@/lib/services/partners";
import { ATTRIBUTION_COOKIE, markVisited, resolveReferralCode, VISITOR_COOKIE } from "@/lib/services/tracking";
import { normalizeReferralCode } from "@/lib/utils/codes";
import { cn } from "@/lib/utils";

type PublicCampaign = NonNullable<Awaited<ReturnType<typeof getPublicCampaign>>>;
type ApplicationStatus = "PENDING" | "APPROVED" | "REJECTED" | "WITHDRAWN" | "REMOVED";

/**
 * "At a glance": what the viewer earns, what the shopper gets and how to
 * qualify, straight from the campaign's own settings.
 */
function CampaignAtAGlance({ campaign, viewerRole }: { campaign: PublicCampaign; viewerRole: string | null }) {
  const creatorsAllowed = campaign.campaignType !== "CUSTOMER_REFERRAL";
  const customersAllowed = campaign.campaignType !== "CREATOR_AFFILIATE";
  const items: { label: string; value: string }[] = [];
  if (viewerRole === "CREATOR" && creatorsAllowed) items.push({ label: "You earn", value: `${shortCommission(campaign)} per verified order` });
  else if (viewerRole === "CUSTOMER" && customersAllowed) items.push({ label: "You earn", value: `${shortReward(campaign)} per friend's verified order` });
  else {
    if (creatorsAllowed) items.push({ label: "Creators earn", value: `${shortCommission(campaign)} per verified order` });
    if (customersAllowed) items.push({ label: "Customers earn", value: `${shortReward(campaign)} per friend's verified order` });
  }
  items.push({ label: "Shopper gets", value: campaign.offerTitle ? `${campaign.offerTitle}${campaign.couponCode ? ` (code ${campaign.couponCode})` : ""}` : "The brand's regular price" });
  const joining =
    viewerRole === "CUSTOMER" || !creatorsAllowed ? "Join for an instant link" : campaign.requiresApproval ? "Apply — the brand approves each creator" : "Join for an instant link";
  items.push({ label: "How to qualify", value: `${joining} · orders within ${campaign.attributionWindowDays} days of a click count` });
  return (
    <section aria-label="Campaign at a glance" className="mt-4">
      <dl className="grid gap-2 sm:grid-cols-2">
        {items.map((i) => (
          <div key={i.label} className="rounded-xl border bg-card px-3 py-2.5">
            <dt className="text-xs font-medium text-muted-foreground">{i.label}</dt>
            <dd className="mt-0.5 text-sm font-semibold">{i.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

const BANNER: Record<ApplicationStatus, { tone: "success" | "warning" | "danger" | "muted"; icon: typeof ClockIcon; title: string; body: (brand: string) => string }> = {
  PENDING: { tone: "warning", icon: ClockIcon, title: "Application sent", body: (b) => `${b} is reviewing your profile. Your referral link appears on this page once you're approved, and we'll notify you.` },
  APPROVED: { tone: "success", icon: CheckCircle2Icon, title: "You're in", body: () => "Your referral link and QR code are ready below. Share them to start earning." },
  REJECTED: { tone: "danger", icon: XCircleIcon, title: "Application not approved", body: (b) => `${b} didn't approve your application for this campaign. You can still apply to other campaigns.` },
  REMOVED: { tone: "danger", icon: XCircleIcon, title: "Removed from this campaign", body: (b) => `${b} removed you from this campaign, so your referral link for it is disabled.` },
  WITHDRAWN: { tone: "muted", icon: ClockIcon, title: "Application withdrawn", body: () => "You withdrew your application to this campaign." },
};

function ApplicationBanner({ status, brandName }: { status: ApplicationStatus; brandName: string }) {
  const b = BANNER[status];
  return (
    <div
      role="status"
      className={cn(
        "mb-6 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm",
        b.tone === "success" && "border-success/40 bg-success/10",
        b.tone === "warning" && "border-warning/40 bg-warning/10",
        b.tone === "danger" && "border-destructive/30 bg-destructive/5",
        b.tone === "muted" && "bg-muted/40",
      )}
    >
      <b.icon
        className={cn(
          "mt-0.5 size-4 shrink-0",
          b.tone === "success" && "text-success-strong",
          b.tone === "warning" && "text-warning-strong",
          b.tone === "danger" && "text-destructive",
          b.tone === "muted" && "text-muted-foreground",
        )}
        aria-hidden
      />
      <div>
        <p className="font-medium">{b.title}</p>
        <p className="text-muted-foreground">
          {b.body(brandName)}
          {status === "APPROVED" ? (
            <>
              {" "}
              <a href="#promote" className="font-medium text-primary underline-offset-2 hover:underline">
                Go to your link
              </a>
            </>
          ) : null}
        </p>
      </div>
    </div>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const c = await getPublicCampaign(slug);
  return { title: c ? `${c.product.name} · ${c.brand.name}` : "Campaign" };
}

function withRef(url: string, code: string) {
  const u = new URL(url);
  u.searchParams.set("ref", code);
  return u.toString();
}

export default async function CampaignPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ ref?: string }> }) {
  const { slug } = await params;
  const { ref } = await searchParams;
  const campaign = await getPublicCampaign(slug);
  if (!campaign) notFound();

  const live = isCampaignLive(campaign);
  const visibility = campaignVisibility(campaign);
  const claimsOpen = acceptsOrderClaims(campaign);
  const user = await getCurrentUser();

  // Referred visitor: resolve the code (for "Referred by" + purchase link) and mark the session as visited.
  let referrer: { name: string; code: string } | null = null;
  if (ref) {
    const resolved = await resolveReferralCode(ref);
    if (resolved.ok && resolved.link.campaignId === campaign.id) {
      const owner = resolved.link.owner;
      referrer = { name: owner.creatorProfile?.displayName ?? owner.name, code: resolved.link.code };
      const visitorId = (await cookies()).get(VISITOR_COOKIE)?.value;
      if (visitorId) await markVisited(normalizeReferralCode(ref), visitorId);
    }
  }

  // Viewer's own partner status + link.
  let partner: Awaited<ReturnType<typeof getPartnerStatus>> | null = null;
  let hasCreatorProfile = false;
  let linkCard: { code: string; url: string; qr: string; clicks: number; qrScans: number; conversions: number } | null = null;
  if (user && (user.role === "CREATOR" || user.role === "CUSTOMER")) {
    partner = await getPartnerStatus(user.id, campaign.id);
    if (user.role === "CREATOR") hasCreatorProfile = !!(await prisma.creatorProfile.findUnique({ where: { userId: user.id }, select: { id: true } }));
    if (partner.code) {
      const [clicks, qrScans, conversions] = await Promise.all([
        prisma.referralClick.count({ where: { referralLink: { code: partner.code } } }),
        prisma.referralClick.count({ where: { referralLink: { code: partner.code }, source: "QR" } }),
        prisma.referral.count({ where: { referralLink: { code: partner.code }, status: "VERIFIED" } }),
      ]);
      linkCard = { code: partner.code, url: referralUrl(partner.code), qr: await referralQrDataUrl(partner.code), clicks, qrScans, conversions };
    }
  }

  const purchaseHref = referrer ? withRef(campaign.product.purchaseUrl, referrer.code) : campaign.product.purchaseUrl;
  // Without ?ref, pre-fill the claim form from the last-click cookie if it belongs to this campaign.
  let claimCode: string | null = null;
  if (!referrer) {
    const raw = (await cookies()).get(ATTRIBUTION_COOKIE)?.value;
    try {
      const parsed = raw ? (JSON.parse(raw) as { code?: string; campaignId?: string }) : null;
      if (parsed?.campaignId === campaign.id && typeof parsed.code === "string") claimCode = parsed.code;
    } catch {
      claimCode = null;
    }
  }
  const shareText = `${campaign.product.name} by ${campaign.brand.name}${campaign.offerTitle ? ` — ${campaign.offerTitle}` : ""}`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {referrer ? (
        <div className="mb-6 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          <p className="font-medium">Recommended by {referrer.name}</p>
          <p className="text-muted-foreground">
            {campaign.offerTitle ? `${campaign.offerTitle}${campaign.couponCode ? ` with code ${campaign.couponCode}` : ""}. ` : ""}Buy through the button below, then come back and <a href="#claim" className="font-medium text-primary underline-offset-2 hover:underline">confirm your order number</a> so {campaign.brand.name} can credit {referrer.name}. Your code: <span className="font-mono font-medium">{referrer.code}</span>.
          </p>
        </div>
      ) : null}

      {partner?.applicationStatus ? <ApplicationBanner status={partner.applicationStatus} brandName={campaign.brand.name} /> : null}

      <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
        {/* Product */}
        <div className="space-y-6">
          <ProductThumb src={campaign.product.imageUrl} name={campaign.product.name} className="aspect-square w-full rounded-2xl" />
          <div>
            <div className="flex items-center gap-2">
              <BrandLogo src={campaign.brand.logoUrl} name={campaign.brand.name} className="size-8 text-xs" />
              <Link href={`/brands/${campaign.brand.slug}`} className="text-sm font-medium hover:underline">
                {campaign.brand.name}
              </Link>
              {campaign.brand.verificationStatus === "VERIFIED" ? (
                <Badge variant="outline" className="gap-1 border-primary/30 text-primary">
                  <BadgeCheckIcon className="size-3" /> Verified brand
                </Badge>
              ) : null}
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">{campaign.product.name}</h1>
            <p className="mt-1 text-xl font-medium">{formatMoney(campaign.product.price, campaign.product.currency)}</p>
            <CampaignAtAGlance campaign={campaign} viewerRole={user?.role ?? null} />
            {campaign.product.description ? <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">{campaign.product.description}</p> : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button nativeButton={false} render={<a href={purchaseHref} target="_blank" rel="noreferrer" />}>
                <ShoppingBagIcon /> Buy on {campaign.brand.name}
              </Button>
              <Button variant="outline" nativeButton={false} render={<Link href={`/products/${campaign.product.slug}`} />}>
                Product details
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              You&apos;ll buy on {campaign.brand.name}&apos;s own store. Already ordered?{" "}
              {claimsOpen && !linkCard ? (
                <a href="#claim" className="font-medium text-primary underline-offset-2 hover:underline">
                  Confirm your order
                </a>
              ) : (
                "Confirm your order"
              )}{" "}
              so the person who referred you gets credit.
            </p>
          </div>
        </div>

        {/* Campaign */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-lg">{campaign.name}</CardTitle>
                <StatusBadge status={live ? "ACTIVE" : visibility.state === "SCHEDULED" ? "PENDING_REVIEW" : visibility.state === "EXPIRED" ? "ENDED" : campaign.status} label={visibility.label ?? undefined} />
              </div>
              {campaign.description ? <p className="text-sm text-muted-foreground">{campaign.description}</p> : null}
            </CardHeader>
            <CardContent className="space-y-4">
              <dl className="grid gap-3 sm:grid-cols-2">
                {campaign.campaignType !== "CUSTOMER_REFERRAL" ? (
                  <div className="rounded-lg border bg-primary/5 px-3 py-2">
                    <dt className="text-xs font-medium text-muted-foreground">Creator commission</dt>
                    <dd className="mt-0.5 text-sm font-medium">{describeCreatorCommission(campaign)}</dd>
                  </div>
                ) : null}
                {campaign.campaignType !== "CREATOR_AFFILIATE" ? (
                  <div className="rounded-lg border bg-muted/30 px-3 py-2">
                    <dt className="text-xs font-medium text-muted-foreground">Customer referral reward</dt>
                    <dd className="mt-0.5 text-sm font-medium">{describeCustomerReward(campaign)}</dd>
                  </div>
                ) : null}
                <div className="rounded-lg border bg-muted/30 px-3 py-2">
                  <dt className="text-xs font-medium text-muted-foreground">Duration</dt>
                  <dd className="mt-0.5 text-sm">{describeDuration(campaign)}</dd>
                </div>
                <div className="rounded-lg border bg-muted/30 px-3 py-2">
                  <dt className="text-xs font-medium text-muted-foreground">Creators promoting</dt>
                  <dd className="mt-0.5 inline-flex items-center gap-1 text-sm">
                    <UsersIcon className="size-3.5" /> {campaign._count.partnerApplications > 0 ? campaign._count.partnerApplications : live ? "Be one of the first" : "None yet"}
                  </dd>
                </div>
              </dl>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Eligibility</p>
                <ul className="mt-1 list-disc pl-5 text-sm text-muted-foreground">
                  {describeEligibility(campaign).map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
              {campaign.terms ? (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Campaign terms</p>
                  <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{campaign.terms}</p>
                </div>
              ) : null}
              {campaign.offerTitle ? (
                <div className="rounded-xl border bg-gradient-to-br from-accent/60 to-background p-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Offer for referred shoppers</p>
                  <p className="mt-1 font-semibold">{campaign.offerTitle}</p>
                  {campaign.offerDescription ? <p className="mt-1 text-sm text-muted-foreground">{campaign.offerDescription}</p> : null}
                  {campaign.couponCode ? <CouponCode code={campaign.couponCode} brandName={campaign.brand.name} /> : null}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card id="promote" className="scroll-mt-24">
            <CardHeader>
              <CardTitle className="text-base">{linkCard ? "Your referral link" : "Promote this product"}</CardTitle>
            </CardHeader>
            <CardContent>
              {linkCard ? (
                <ReferralLinkCard
                  code={linkCard.code}
                  url={linkCard.url}
                  qrDataUrl={linkCard.qr}
                  share={shareTargets(linkCard.url, shareText)}
                  shareText={shareText}
                  stats={{ clicks: linkCard.clicks, qrScans: linkCard.qrScans, conversions: linkCard.conversions }}
                />
              ) : (
                <JoinCampaignPanel
                  campaignId={campaign.id}
                  campaignSlug={campaign.slug}
                  campaignName={campaign.name}
                  brandName={campaign.brand.name}
                  productName={campaign.product.name}
                  viewer={user ? { role: user.role, name: user.name, hasCreatorProfile } : null}
                  applicationStatus={partner?.applicationStatus ?? null}
                  requiresApproval={campaign.requiresApproval}
                  campaignType={campaign.campaignType}
                  live={live}
                />
              )}
            </CardContent>
          </Card>

          {/* Order handshake: customers confirm their store order so the brand can attribute it. Hidden for the link owner. */}
          {claimsOpen && !linkCard ? (
            <OrderClaimForm campaignId={campaign.id} brandName={campaign.brand.name} referralCode={referrer?.code ?? claimCode} referrerName={referrer?.name ?? null} />
          ) : null}

          <p className="text-xs text-muted-foreground">
            Brand website:{" "}
            {campaign.brand.website ? (
              <a href={campaign.brand.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                {campaign.brand.website.replace(/^https?:\/\//, "")} <ExternalLinkIcon className="size-3" />
              </a>
            ) : (
              "not provided"
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
