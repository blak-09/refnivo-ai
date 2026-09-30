import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, BadgeCheckIcon, ExternalLinkIcon, GlobeIcon, InfoIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BrandLogo } from "@/components/products/product-thumb";
import { AffiliateJoinPanel } from "@/components/affiliate/join-panel";
import { ActiveProgramPill, APPROVAL_LABEL, commissionText, eligibilityText, EXTERNAL_DETAILS_NOTE, NOT_DISCLOSED, ProgramTypeBadge, VerifiedProgramMark } from "@/components/affiliate/program-badge";
import { getCurrentUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { creatorLinkForProgram } from "@/lib/services/affiliate-links";
import { getPublishedProgram, programBrandName } from "@/lib/services/affiliate-programs";
import { PLATFORM_LABEL } from "@/lib/social";
import { PROGRAM_TYPE_LABEL } from "@/lib/validation/affiliate";
import { formatDate } from "@/lib/utils/dates";

function hostOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const program = await getPublishedProgram((await params).slug);
  return program ? { title: `${program.name} · ${programBrandName(program)}`, description: program.description?.slice(0, 160) ?? undefined } : { title: "Affiliate programme" };
}

const STEPS: [string, string][] = [
  ["Join", "Apply through the official programme page. Approval is decided by the programme."],
  ["Share", "Create your affiliate or referral links — add them to Refnivo to get per-platform tracking links and QR codes."],
  ["Earn", "Earn according to the programme's own terms. Refnivo does not set, promise or pay these earnings."],
];

/**
 * An external programme. Every figure is the programme's own statement; the
 * page says plainly that approval, tracking of sales and payment belong to the
 * programme, and when and where the listing was verified.
 */
export default async function AffiliateProgramPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ link?: string }> }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const program = await getPublishedProgram(slug);
  if (!program) notFound();

  const user = await getCurrentUser();
  let viewer: "anonymous" | "creator" | "other" | "creator-without-profile" = "anonymous";
  let savedCode: string | null = null;
  if (user?.role === "CREATOR") {
    const profile = await prisma.creatorProfile.findUnique({ where: { userId: user.id }, select: { id: true } });
    viewer = profile ? "creator" : "creator-without-profile";
    if (profile) {
      const link = await creatorLinkForProgram(user.id, program.id);
      if (link?.status === "ACTIVE") savedCode = link.codes[0]?.code ?? null;
    }
  } else if (user) viewer = "other";

  const brandName = programBrandName(program);
  // Curated: Refnivo listed it from public information; the brand has no account here.
  const curated = !program.brand;
  const sourceUrl = program.sourceUrl ?? program.programUrl ?? program.signupUrl;
  const sourceHost = hostOf(sourceUrl);
  const commission = commissionText(program);
  const typeLabel = PROGRAM_TYPE_LABEL[program.programType];

  // Only what the programme states. Anything unstated is left out, never guessed.
  const facts: [string, string | null][] = [
    ["Program type", typeLabel],
    ["Status", "Active"],
    ["Affiliate network", program.networkName],
    ["Cookie / attribution", program.cookieDurationDays ? `${program.cookieDurationDays} days` : null],
    ["Minimum followers", program.minFollowers ? program.minFollowers.toLocaleString("en-IN") : null],
    ["Country availability", program.geography],
    ["Application process", program.approvalType ? APPROVAL_LABEL[program.approvalType] : "Apply on the official program page"],
    ["Paid by", `${brandName}'s programme — not Refnivo`],
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <Link href="/affiliate-programs" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-3" aria-hidden /> All affiliate programs
      </Link>

      {sp.link === "inactive" ? (
        <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          The link you followed is no longer active. The programme may be paused on Refnivo.
        </p>
      ) : null}

      <header className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
        <BrandLogo src={program.logoUrl ?? program.brand?.logoUrl} name={brandName} className="size-20 rounded-2xl text-xl" sizes="80px" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <ActiveProgramPill />
            <ProgramTypeBadge type="EXTERNAL" />
            <VerifiedProgramMark verifiedAt={program.verifiedAt} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{brandName}</h1>
          <p className="text-sm text-muted-foreground">
            {program.name} · {program.category ?? "Affiliate programme"}
            {program.subcategory ? ` · ${program.subcategory}` : ""}
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {program.websiteUrl ? (
              <a href={program.websiteUrl} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                <GlobeIcon className="size-3" aria-hidden /> {program.websiteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}
              </a>
            ) : null}
            {program.brand?.slug ? (
              <Link href={`/brands/${program.brand.slug}`} className="text-xs text-primary hover:underline">
                {brandName} on Refnivo
              </Link>
            ) : null}
          </div>
        </div>
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-8">
          <Card className="border-amber-300/60 bg-amber-50/40 dark:border-amber-800 dark:bg-amber-950/20">
            <CardContent className="flex items-start gap-3 py-2 text-sm">
              <InfoIcon className="mt-0.5 size-5 shrink-0 text-amber-700" aria-hidden />
              <div>
                <p className="font-medium">External affiliate program</p>
                <p className="mt-1 text-muted-foreground">
                  This program is managed externally. Refnivo provides discovery and does not control the external program&apos;s approval, tracking or payouts
                  {program.networkName ? ` (it runs on ${program.networkName})` : ""}.
                </p>
                {curated ? (
                  <p className="mt-2 text-muted-foreground">
                    <span className="font-medium text-foreground">Listed by Refnivo.</span> {brandName} has not joined Refnivo, is not a Refnivo partner and does not
                    manage this listing.
                  </p>
                ) : null}
              </div>
            </CardContent>
          </Card>

          {program.description ? (
            <section>
              <h2 className="text-lg font-semibold">About this program</h2>
              <p className="mt-2 text-sm whitespace-pre-line text-muted-foreground">{program.description}</p>
            </section>
          ) : null}

          <section>
            <h2 className="text-lg font-semibold">
              {typeLabel} program: {program.name}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">As published on the official programme page{sourceHost ? ` (${sourceHost})` : ""}.</p>
            <dl className="mt-3 divide-y rounded-xl border bg-card text-sm">
              {facts
                .filter(([, v]) => v)
                .map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4 px-4 py-2.5">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="text-right font-medium">{value}</dd>
                  </div>
                ))}
              <div className="flex justify-between gap-4 px-4 py-2.5">
                <dt className="text-muted-foreground">Terms</dt>
                <dd className="text-right font-medium">
                  <a href={program.programUrl ?? program.signupUrl} target="_blank" rel="noreferrer noopener" className="text-primary hover:underline">
                    Official program terms
                  </a>
                </dd>
              </div>
              <div className="flex justify-between gap-4 px-4 py-2.5">
                <dt className="text-muted-foreground">Official program link</dt>
                <dd className="min-w-0 truncate text-right font-medium">
                  <a href={program.signupUrl} target="_blank" rel="noreferrer noopener" className="text-primary hover:underline">
                    {hostOf(program.signupUrl) ?? "Open"}
                  </a>
                </dd>
              </div>
            </dl>
            <p className="mt-2 text-xs text-muted-foreground">{EXTERNAL_DETAILS_NOTE}</p>
          </section>

          <div className="grid gap-4 sm:grid-cols-2">
            <section className="rounded-xl border bg-card p-4">
              <h2 className="text-sm font-semibold text-muted-foreground">Commission</h2>
              <p className={commission === NOT_DISCLOSED ? "mt-1 text-base text-muted-foreground" : "mt-1 text-lg font-semibold"}>{commission}</p>
              <p className="mt-1 text-xs text-muted-foreground">Set and paid by the programme. Refnivo does not guarantee it.</p>
            </section>
            <section className="rounded-xl border bg-card p-4">
              <h2 className="text-sm font-semibold text-muted-foreground">Eligibility & eligible products</h2>
              <p className="mt-1 text-sm">{eligibilityText(program)}</p>
              {program.supportedPlatforms.length ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {program.supportedPlatforms.map((p) => (
                    <Badge key={p} variant="secondary">
                      {PLATFORM_LABEL[p]}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </section>
          </div>

          {program.bestFor.length ? (
            <section>
              <h2 className="text-sm font-semibold text-muted-foreground">Best for</h2>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {program.bestFor.map((b) => (
                  <Badge key={b} variant="outline">
                    {b}
                  </Badge>
                ))}
              </div>
            </section>
          ) : null}

          <section>
            <h2 className="text-lg font-semibold">How it works</h2>
            <ol className="mt-3 grid gap-3 sm:grid-cols-3">
              {STEPS.map(([title, body], i) => (
                <li key={title} className="rounded-xl border bg-card p-4">
                  <span className="inline-flex size-7 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{i + 1}</span>
                  <p className="mt-2 font-medium">{title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{body}</p>
                </li>
              ))}
            </ol>
          </section>

          <section className="rounded-xl border border-dashed p-4 text-sm">
            <h2 className="inline-flex items-center gap-1.5 font-semibold">
              <BadgeCheckIcon className="size-4 text-indigo-600" aria-hidden /> Verification
            </h2>
            {program.verifiedAt ? (
              <p className="mt-1 text-muted-foreground">
                Program verified on <span className="font-medium text-foreground">{formatDate(program.verifiedAt)}</span>
              </p>
            ) : (
              <p className="mt-1 text-muted-foreground">Published, not yet verified by Refnivo.</p>
            )}
            <p className="mt-1 text-muted-foreground">
              Source:{" "}
              <a href={sourceUrl} target="_blank" rel="noreferrer noopener" className="text-primary hover:underline">
                Official {curated ? "brand/program" : "program"} page{sourceHost ? ` (${sourceHost})` : ""}
              </a>
            </p>
          </section>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Official program</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <AffiliateJoinPanel
                programId={program.id}
                programName={program.name}
                brandName={brandName}
                signupUrl={program.signupUrl}
                viewer={viewer}
                savedCode={savedCode}
              />
              {program.programUrl && program.programUrl !== program.signupUrl ? (
                <a href={program.programUrl} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                  Programme page <ExternalLinkIcon className="size-3" aria-hidden />
                </a>
              ) : null}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
