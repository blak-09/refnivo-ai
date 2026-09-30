import Link from "next/link";
import { ArrowUpRightIcon, StarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/products/product-thumb";
import { ActiveProgramPill, commissionText, eligibilityText, joinLabel, VerifiedProgramMark } from "@/components/affiliate/program-badge";
import { PROGRAM_TYPE_LABEL } from "@/lib/validation/affiliate";
import { programBrandName, type PublicAffiliateProgram } from "@/lib/services/affiliate-programs";

/**
 * Marketplace card for an external programme. Every figure is the programme's
 * own statement; anything it does not publish reads "Not publicly disclosed".
 * "Join program" opens the official application page in a new tab.
 */
export function ProgramCard({ program: p }: { program: PublicAffiliateProgram }) {
  const brandName = programBrandName(p);
  const commission = commissionText(p);
  const disclosed = commission !== "Not publicly disclosed";
  return (
    <article className="group relative flex h-full flex-col rounded-2xl border bg-card p-4 transition duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg sm:p-5">
      <header className="flex items-start gap-3">
        <BrandLogo src={p.logoUrl ?? p.brand?.logoUrl} name={brandName} className="size-14 rounded-xl" sizes="56px" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold">
            <Link href={`/affiliate-programs/${p.slug}`} className="after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none">
              {brandName}
            </Link>
          </h3>
          <p className="truncate text-xs text-muted-foreground">
            {p.category ?? "Affiliate programme"}
            {p.subcategory ? ` · ${p.subcategory}` : ""}
          </p>
        </div>
        {p.featured ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
            <StarIcon className="size-3 fill-current" aria-hidden /> Featured
          </span>
        ) : null}
      </header>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <ActiveProgramPill />
        <VerifiedProgramMark verifiedAt={p.verifiedAt} />
      </div>

      {p.description ? <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{p.description}</p> : null}

      <p className="mt-3 text-sm font-medium">{p.name}</p>

      <dl className="mt-3 grid flex-1 content-start gap-2 text-xs">
        <div className="rounded-lg bg-muted/60 px-3 py-2">
          <dt className="text-muted-foreground">Commission</dt>
          <dd className={disclosed ? "mt-0.5 text-sm font-semibold text-foreground" : "mt-0.5 text-sm text-muted-foreground"}>{commission}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Program type</dt>
          <dd className="text-right font-medium">{PROGRAM_TYPE_LABEL[p.programType]}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="shrink-0 text-muted-foreground">Eligibility</dt>
          <dd className="line-clamp-2 text-right">{eligibilityText(p)}</dd>
        </div>
      </dl>

      {/* Above the card-wide link overlay so both buttons stay clickable. */}
      <div className="relative z-10 mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" className="flex-1 justify-center" nativeButton={false} render={<Link href={`/affiliate-programs/${p.slug}`} />}>
          Details
        </Button>
        <Button
          size="sm"
          className="flex-1 justify-center"
          nativeButton={false}
          render={<a href={p.signupUrl} target="_blank" rel="noreferrer noopener" aria-label={`${joinLabel(p.programType)}: ${p.name} — official page, opens in a new tab`} />}
        >
          {joinLabel(p.programType)} <ArrowUpRightIcon className="size-3.5" aria-hidden />
        </Button>
      </div>
    </article>
  );
}
