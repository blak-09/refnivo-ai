import Link from "next/link";
import type { Metadata } from "next";
import { ClapperboardIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, PageHeader, StatusBadge } from "@/components/dashboard/primitives";
import { BrandLogo } from "@/components/products/product-thumb";
import { requireCreator } from "@/lib/auth/guards";
import { formatMoney } from "@/lib/money";
import { listCreatorCollaborations, listOpenBriefs } from "@/lib/services/ugc";
import { UGC_COLLAB_STATUS_LABEL, UGC_CONTENT_TYPE_LABEL, UGC_USAGE_LABEL, ugcCollabTone } from "@/lib/ugc/options";
import { formatDate } from "@/lib/utils/dates";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "UGC Briefs" };

const TABS = [
  { value: "open", label: "Open briefs" },
  { value: "mine", label: "My collaborations" },
] as const;

export default async function CreatorUgcPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: rawTab } = await searchParams;
  const { user } = await requireCreator();
  const tab = rawTab === "mine" ? "mine" : "open";
  const [open, mine] = await Promise.all([listOpenBriefs(user.id), listCreatorCollaborations(user.id)]);
  const needsAction = mine.filter((c) => c.status === "IN_PROGRESS" || c.status === "REVISION_REQUESTED" || (c.paidMarkedAt && !c.paidConfirmedAt)).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="UGC Briefs"
        description="Get paid a fixed fee to create photos and videos for brands. The fee, deliverables and usage rights are set in each brief before you apply."
      />

      <div className="flex gap-2" role="tablist">
        {TABS.map((t) => (
          <Link
            key={t.value}
            href={`/dashboard/creator/ugc?tab=${t.value}`}
            role="tab"
            aria-selected={tab === t.value}
            className={cn("rounded-full border px-3 py-1 text-sm font-medium transition-colors", tab === t.value ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted")}
          >
            {t.label}
            <span className="ml-1.5 text-xs opacity-70">{t.value === "open" ? open.length : mine.length}</span>
            {t.value === "mine" && needsAction ? <span className="ml-1.5 inline-block size-2 rounded-full bg-primary align-middle" role="img" aria-label={`${needsAction} need your action`} /> : null}
          </Link>
        ))}
      </div>

      {tab === "open" ? (
        !open.length ? (
          <EmptyState icon={ClapperboardIcon} title="No open briefs right now" description="When brands post UGC briefs they appear here. Check back soon." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {open.map((b) => (
              <Card key={b.id} className="transition-colors hover:border-primary/40">
                <CardContent className="flex h-full flex-col gap-3">
                  <div className="flex items-start gap-3">
                    <BrandLogo src={b.brand.logoUrl} name={b.brand.name} className="size-10" />
                    <div className="min-w-0 flex-1">
                      <Link href={`/dashboard/creator/ugc/${b.id}`} className="line-clamp-2 font-medium hover:underline">
                        {b.title}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">
                        {b.brand.name}
                        {b.product ? ` · ${b.product.name}` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 text-base font-semibold">{formatMoney(b.feeAmount, b.currency)}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {b.contentTypes.map((t) => (
                      <Badge key={t} variant="secondary">
                        {UGC_CONTENT_TYPE_LABEL[t] ?? t}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {UGC_USAGE_LABEL[b.usageRights] ?? b.usageRights}
                    {b.applyBy ? ` · apply by ${formatDate(b.applyBy)}` : ""}
                    {b.productShipped ? " · product shipped to you" : ""}
                  </p>
                  <div className="mt-auto flex items-center justify-between gap-2">
                    {b.myStatus ? <StatusBadge status={ugcCollabTone(b.myStatus)} label={UGC_COLLAB_STATUS_LABEL[b.myStatus]} /> : <span />}
                    <Link href={`/dashboard/creator/ugc/${b.id}`} className="text-sm font-medium text-primary hover:underline">
                      {b.myStatus && b.myStatus !== "WITHDRAWN" ? "View" : "View & apply"} →
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      ) : !mine.length ? (
        <EmptyState icon={ClapperboardIcon} title="No collaborations yet" description="Apply to an open brief. Once a brand accepts you, the collaboration shows up here." />
      ) : (
        <Card>
          <CardContent className="divide-y">
            {mine.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="flex min-w-0 items-center gap-3">
                  <BrandLogo src={c.brief.brand.logoUrl} name={c.brief.brand.name} className="size-9" />
                  <div className="min-w-0">
                    <Link href={`/dashboard/creator/ugc/${c.brief.id}`} className="block truncate font-medium hover:underline">
                      {c.brief.title}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.brief.brand.name} · {formatMoney(c.agreedFee ?? c.brief.feeAmount, c.brief.currency)}
                      {c.paidConfirmedAt ? " · paid" : c.paidMarkedAt ? " · brand marked paid, please confirm" : ""}
                    </p>
                  </div>
                </div>
                <StatusBadge status={ugcCollabTone(c.status)} label={UGC_COLLAB_STATUS_LABEL[c.status]} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
