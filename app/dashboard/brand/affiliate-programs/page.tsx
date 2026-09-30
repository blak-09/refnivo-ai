import Link from "next/link";
import type { Metadata } from "next";
import type { AffiliateProgramStatus } from "@prisma/client";
import { ExternalLinkIcon, PlusIcon, StoreIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, PageHeader, StatusBadge } from "@/components/dashboard/primitives";
import { ProgramTypeBadge, VerifiedProgramMark } from "@/components/affiliate/program-badge";
import { ProgramStateActions } from "@/components/affiliate/program-state-actions";
import { requireBrand } from "@/lib/auth/guards";
import { listBrandPrograms } from "@/lib/services/affiliate-programs";
import { formatDate } from "@/lib/utils/dates";

export const metadata: Metadata = { title: "Affiliate programs" };

const STATUS: Record<AffiliateProgramStatus, { tone: string; label: string }> = {
  DRAFT: { tone: "DRAFT", label: "Draft" },
  PENDING_REVIEW: { tone: "PENDING_REVIEW", label: "Pending Verification" },
  APPROVED: { tone: "ACTIVE", label: "Active" },
  REJECTED: { tone: "REJECTED", label: "Needs changes" },
  PAUSED: { tone: "PAUSED", label: "Inactive" },
  CLOSED: { tone: "ENDED", label: "Closed" },
};

/**
 * Brand → Affiliate programs. What Refnivo can honestly report for an external
 * programme is traffic: how many creators saved a link and how many clicks
 * Refnivo forwarded. Sales stay with the external network.
 */
export default async function BrandAffiliateProgramsPage() {
  const { brand } = await requireBrand();
  const programs = await listBrandPrograms(brand.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Affiliate programs"
        description="Already running an affiliate program somewhere else? List it here so creators can discover it. Approval, commission and payment stay with your own programme."
        actions={
          <Button nativeButton={false} render={<Link href="/dashboard/brand/affiliate-programs/new" />}>
            <PlusIcon className="size-4" aria-hidden /> List existing affiliate program
          </Button>
        }
      />

      <p className="text-xs text-muted-foreground">
        New listings are <span className="font-medium text-foreground">Pending Verification</span> until a Refnivo admin reviews the official program page.
        Approved listings are <span className="font-medium text-foreground">Active</span> in the directory and carry a{" "}
        <span className="font-medium text-foreground">Verified</span> mark with the review date; <span className="font-medium text-foreground">Inactive</span>{" "}
        listings are hidden; resuming one sends it back for verification.
      </p>

      {!programs.length ? (
        <EmptyState
          icon={StoreIcon}
          title="No affiliate programs listed"
          description="List the programme you already run — creators find it in the marketplace and join on your platform. Want Refnivo to track orders and pay commissions for you instead? Create a Refnivo campaign."
          action={
            <Button size="sm" nativeButton={false} render={<Link href="/dashboard/brand/affiliate-programs/new" />}>
              List existing affiliate program
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-3">
          {programs.map((p) => (
            <li key={p.id}>
              <Card size="sm">
                <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/dashboard/brand/affiliate-programs/${p.id}`} className="font-semibold hover:underline">
                        {p.name}
                      </Link>
                      <StatusBadge status={STATUS[p.status].tone} label={STATUS[p.status].label} />
                      <ProgramTypeBadge type="EXTERNAL" />
                      <VerifiedProgramMark verifiedAt={p.verifiedAt} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {p.category ?? "No category"} · updated {formatDate(p.updatedAt)}
                      {p.status === "REJECTED" && p.reviewNote ? ` · Reviewer: ${p.reviewNote}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground tabular-nums">{p._count.links}</span> {p._count.links === 1 ? "creator" : "creators"} saved a
                      link · <span className="font-medium text-foreground tabular-nums">{p._count.clicks}</span> {p._count.clicks === 1 ? "click" : "clicks"} forwarded
                      by Refnivo · sales are tracked by your programme
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {p.status === "APPROVED" ? (
                      <Button size="sm" variant="outline" nativeButton={false} render={<Link href={`/affiliate-programs/${p.slug}`} />}>
                        View listing <ExternalLinkIcon className="size-3.5" aria-hidden />
                      </Button>
                    ) : null}
                    <ProgramStateActions id={p.id} status={p.status} />
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
