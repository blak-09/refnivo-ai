import Link from "next/link";
import { ArrowRightIcon, BadgeCheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/products/product-thumb";
import { ActiveProgramPill, ProgramTypeBadge } from "@/components/affiliate/program-badge";
import type { MarketplaceCampaign } from "@/lib/services/campaigns";
import { campaignCategory, campaignCommission } from "@/lib/services/directory";

/**
 * Directory card for a Refnivo campaign — a programme run on Refnivo end to
 * end: Refnivo issues the link, tracks the order and records the commission.
 * Figures are the campaign's own configured terms.
 */
export function CampaignProgramCard({ campaign: c }: { campaign: MarketplaceCampaign }) {
  const href = `/campaigns/${c.slug}`;
  return (
    <article className="group relative flex h-full flex-col rounded-2xl border border-indigo-100 bg-card p-4 transition duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg sm:p-5 dark:border-indigo-900/50">
      <header className="flex items-start gap-3">
        <BrandLogo src={c.brand.logoUrl} name={c.brand.name} className="size-14 rounded-xl" sizes="56px" />
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-1 truncate text-base font-semibold">
            <Link href={href} className="truncate after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none">
              {c.brand.name}
            </Link>
            {c.brand.verificationStatus === "VERIFIED" ? <BadgeCheckIcon className="size-4 shrink-0 text-primary" aria-label="Verified brand" /> : null}
          </h3>
          <p className="truncate text-xs text-muted-foreground">
            {campaignCategory(c)}
            {c.product.category ? ` · ${c.product.category}` : ""}
          </p>
        </div>
      </header>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <ActiveProgramPill />
        <ProgramTypeBadge type="REFNIVO" />
      </div>

      <p className="mt-3 line-clamp-2 text-sm font-medium">{c.product.name}</p>
      <p className="truncate text-xs text-muted-foreground">{c.name}</p>

      <dl className="mt-3 grid flex-1 content-start gap-2 text-xs">
        <div className="rounded-lg bg-indigo-50/70 px-3 py-2 dark:bg-indigo-950/30">
          <dt className="text-muted-foreground">Commission</dt>
          <dd className="mt-0.5 text-sm font-semibold text-foreground">{campaignCommission(c)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Tracking</dt>
          <dd className="text-right font-medium">Refnivo</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Joining</dt>
          <dd className="text-right">{c.requiresApproval ? "Brand approval" : "Instant"}</dd>
        </div>
      </dl>

      <div className="relative z-10 mt-4">
        <Button size="sm" className="w-full justify-center" nativeButton={false} render={<Link href={href} />}>
          Join campaign <ArrowRightIcon className="size-3.5" aria-hidden />
        </Button>
      </div>
    </article>
  );
}
