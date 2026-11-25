import Link from "next/link";
import type { Metadata } from "next";
import { ClapperboardIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, KpiCard, PageHeader, StatusBadge } from "@/components/dashboard/primitives";
import { UpgradeGate } from "@/components/billing/upgrade-gate";
import { requireBrand } from "@/lib/auth/guards";
import { formatMoney } from "@/lib/money";
import { getBrandEntitlements } from "@/lib/services/plan-limits";
import { listBrandBriefs } from "@/lib/services/ugc";
import { UGC_BRIEF_STATUS_LABEL, ugcBriefTone } from "@/lib/ugc/options";
import { formatDate } from "@/lib/utils/dates";

export const metadata: Metadata = { title: "UGC Collaborations" };

export default async function UgcBriefsPage() {
  const { brand } = await requireBrand();
  const [entitlements, briefs] = await Promise.all([getBrandEntitlements(brand.id), listBrandBriefs(brand.id)]);
  const header = (
    <PageHeader
      title="UGC Collaborations"
      description="Brief creators for photos and videos you can use in your own marketing. Same terms for both sides: fee, deliverables and usage rights are fixed in the brief."
      actions={
        entitlements.features.ugc ? (
          <Button nativeButton={false} render={<Link href="/dashboard/brand/ugc/new" />}>
            <PlusIcon /> New brief
          </Button>
        ) : null
      }
    />
  );

  // Free brands see what UGC offers; existing briefs (from an earlier plan) stay listed below.
  if (!entitlements.features.ugc && !briefs.length) {
    return (
      <div className="space-y-6">
        {header}
        <UpgradeGate
          feature="ugc"
          title="Get content made by real creators"
          description="Post a brief with your fee and usage rights, pick the creators you like, review their photos and videos, and approve the final content — all in one place."
          bullets={["Briefs with fixed fee and usage rights", "Creator pitches with portfolios", "Photo uploads and video links", "Up to two revision rounds", "Approval and payment record", "Every creator's results in Partners"]}
        />
      </div>
    );
  }

  const toReview = briefs.reduce((s, b) => s + b.toReview, 0);
  const applicants = briefs.reduce((s, b) => s + b.applicants, 0);

  return (
    <div className="space-y-6">
      {header}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <KpiCard label="Open briefs" value={briefs.filter((b) => b.status === "OPEN").length} />
        <KpiCard label="Applications to answer" value={applicants} />
        <KpiCard label="Content to review" value={toReview} />
      </div>

      {!briefs.length ? (
        <EmptyState
          icon={ClapperboardIcon}
          title="No briefs yet"
          description="Create your first brief: describe the content, set the fee per creator and how you will use it, then publish it for creators to apply."
          action={
            <Button size="sm" nativeButton={false} render={<Link href="/dashboard/brand/ugc/new" />}>
              Create a brief
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3">
          {briefs.map((b) => (
            <Card key={b.id} className="transition-colors hover:border-primary/40">
              <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/dashboard/brand/ugc/${b.id}`} className="font-medium hover:underline">
                      {b.title}
                    </Link>
                    <StatusBadge status={ugcBriefTone(b.status)} label={UGC_BRIEF_STATUS_LABEL[b.status]} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatMoney(b.feeAmount, b.currency)} per creator · {b.active} of {b.creatorsNeeded} creators
                    {b.product ? ` · ${b.product.name}` : ""}
                    {b.applyBy ? ` · apply by ${formatDate(b.applyBy)}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {b.applicants ? <span className="rounded-full bg-warning/15 px-2.5 py-1 font-medium text-amber-800 dark:text-amber-200">{b.applicants} to answer</span> : null}
                  {b.toReview ? <span className="rounded-full bg-primary/10 px-2.5 py-1 font-medium text-primary">{b.toReview} to review</span> : null}
                  <Button size="sm" variant="outline" nativeButton={false} render={<Link href={`/dashboard/brand/ugc/${b.id}`} />}>
                    Open
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
