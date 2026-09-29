import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, ExternalLinkIcon, GlobeIcon, InfoIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BrandLogo } from "@/components/products/product-thumb";
import { AffiliateJoinPanel } from "@/components/affiliate/join-panel";
import { APPROVAL_LABEL, COMMISSION_TYPE_LABEL, ProgramTypeBadge, VerifiedProgramMark } from "@/components/affiliate/program-badge";
import { getCurrentUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { creatorLinkForProgram } from "@/lib/services/affiliate-links";
import { getPublishedProgram, programBrandName } from "@/lib/services/affiliate-programs";
import { PLATFORM_LABEL } from "@/lib/social";

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

/**
 * An external affiliate programme. The page says plainly that approval,
 * payment and terms belong to the external programme, and every figure shown is
 * the brand's own description of its terms.
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
  // Where the curated facts were read: the programme page's own site (the brand's, or its network's).
  const sourceHost = hostOf(program.programUrl ?? program.signupUrl);

  // Only what the programme actually states. Anything unstated is left out, never guessed.
  const facts: [string, string | null][] = [
    ["Program type", "External affiliate program"],
    // Only approved listings reach this page.
    ["Status", "Active"],
    ["Commission", program.commissionDescription ?? (program.commissionType ? COMMISSION_TYPE_LABEL[program.commissionType] : "Not published — see the programme page")],
    ["Commission type", program.commissionType ? COMMISSION_TYPE_LABEL[program.commissionType] : null],
    ["Cookie / attribution", program.cookieDurationDays ? `${program.cookieDurationDays} days` : null],
    ["Affiliate network", program.networkName],
    ["Joining", program.approvalType ? APPROVAL_LABEL[program.approvalType] : null],
    ["Minimum followers", program.minFollowers ? program.minFollowers.toLocaleString("en-IN") : null],
    ["Region", program.geography],
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

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
        <BrandLogo src={program.logoUrl ?? program.brand?.logoUrl} name={brandName} className="size-20 rounded-2xl text-xl" sizes="80px" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <ProgramTypeBadge type="EXTERNAL" />
            <VerifiedProgramMark verifiedAt={program.verifiedAt} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{program.name}</h1>
          <p className="text-sm text-muted-foreground">
            {program.brand?.slug ? (
              <Link href={`/brands/${program.brand.slug}`} className="font-medium text-foreground hover:underline">
                {brandName}
              </Link>
            ) : (
              <span className="font-medium text-foreground">{brandName}</span>
            )}
            {program.category ? ` · ${program.category}` : ""}
          </p>
          {program.websiteUrl ? (
            <a href={program.websiteUrl} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
              <GlobeIcon className="size-3" aria-hidden /> {program.websiteUrl.replace(/^https?:\/\//, "")}
            </a>
          ) : null}
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card className="border-amber-300/60 bg-amber-50/40 dark:border-amber-800 dark:bg-amber-950/20">
            <CardContent className="flex items-start gap-3 py-2 text-sm">
              <InfoIcon className="mt-0.5 size-5 shrink-0 text-amber-700" aria-hidden />
              <div>
                <p className="font-medium">This is an external affiliate program</p>
                <p className="mt-1 text-muted-foreground">
                  Refnivo helps you discover and manage your affiliate promotion. Approval, affiliate payments and programme terms are handled by the external
                  affiliate program{program.networkName ? ` (${program.networkName})` : ""}, not by Refnivo.
                </p>
                {curated ? (
                  <p className="mt-2 text-muted-foreground">
                    <span className="font-medium text-foreground">Listed by Refnivo.</span> {brandName} has not joined Refnivo and does not manage this listing. The
                    details come from the programme&apos;s public page{sourceHost ? ` on ${sourceHost}` : ""}.
                  </p>
                ) : null}
              </div>
            </CardContent>
          </Card>

          {program.description ? (
            <section>
              <h2 className="text-lg font-semibold">About the programme</h2>
              <p className="mt-2 text-sm whitespace-pre-line text-muted-foreground">{program.description}</p>
            </section>
          ) : null}

          <section>
            <h2 className="text-lg font-semibold">Programme details</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {curated ? `From the programme's public listing — not provided by ${brandName}.` : `As stated by ${brandName}.`}
            </p>
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
                <dt className="text-muted-foreground">Paid by</dt>
                <dd className="text-right font-medium">The external affiliate program</dd>
              </div>
            </dl>
          </section>

          {program.supportedPlatforms.length || program.requirements ? (
            <section>
              <h2 className="text-lg font-semibold">Creator requirements</h2>
              {program.supportedPlatforms.length ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {program.supportedPlatforms.map((p) => (
                    <Badge key={p} variant="secondary">
                      {PLATFORM_LABEL[p]}
                    </Badge>
                  ))}
                </div>
              ) : null}
              {program.requirements ? <p className="mt-2 text-sm whitespace-pre-line text-muted-foreground">{program.requirements}</p> : null}
            </section>
          ) : null}
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Promote {brandName}</CardTitle>
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
              {program.programUrl ? (
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
