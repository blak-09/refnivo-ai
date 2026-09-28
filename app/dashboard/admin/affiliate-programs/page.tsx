import Link from "next/link";
import type { Metadata } from "next";
import type { AffiliateProgramStatus } from "@prisma/client";
import { StoreIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, PageHeader, StatusBadge } from "@/components/dashboard/primitives";
import { VerifiedProgramMark } from "@/components/affiliate/program-badge";
import { AffiliateReviewActions } from "@/components/affiliate/review-actions";
import { requireRole } from "@/lib/auth/guards";
import { listProgramsForReview } from "@/lib/services/affiliate-programs";
import { formatDateTime } from "@/lib/utils/dates";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Affiliate programs" };

const FILTERS: { value: AffiliateProgramStatus | "ALL"; label: string }[] = [
  { value: "PENDING_REVIEW", label: "To review" },
  { value: "APPROVED", label: "Published" },
  { value: "REJECTED", label: "Rejected" },
  { value: "PAUSED", label: "Paused" },
  { value: "ALL", label: "All" },
];

const TONE: Record<AffiliateProgramStatus, string> = { DRAFT: "DRAFT", PENDING_REVIEW: "PENDING_REVIEW", APPROVED: "ACTIVE", REJECTED: "REJECTED", PAUSED: "PAUSED", CLOSED: "ENDED" };

/** Admin review queue for external affiliate programme listings. */
export default async function AdminAffiliateProgramsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireRole("ADMIN");
  const { status } = await searchParams;
  const filter = FILTERS.some((f) => f.value === status) ? (status as AffiliateProgramStatus | "ALL") : "PENDING_REVIEW";
  const rows = await listProgramsForReview(filter);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Affiliate programs"
        description="External programmes brands already run. Nothing is public until approved here. Open both URLs before approving; only tick “verified” for what you actually checked."
      />
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter by status">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={`/dashboard/admin/affiliate-programs?status=${f.value}`}
            role="tab"
            aria-selected={filter === f.value}
            className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors", filter === f.value ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted")}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Listings</CardTitle>
          <CardDescription>Oldest submission first.</CardDescription>
        </CardHeader>
        <CardContent>
          {!rows.length ? (
            <EmptyState icon={StoreIcon} title="Nothing here" description="Listings appear here as brands submit them." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Programme</TableHead>
                    <TableHead>Brand</TableHead>
                    <TableHead>URLs</TableHead>
                    <TableHead>Stated terms</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Decision</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <span className="font-medium">{r.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {r.category ?? "No category"} · {r.submittedAt ? `submitted ${formatDateTime(r.submittedAt)}` : "draft"}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {r._count.links} creator links · {r._count.clicks} clicks
                        </span>
                      </TableCell>
                      <TableCell className="text-xs">
                        {r.brand.slug ? (
                          <Link href={`/brands/${r.brand.slug}`} className="font-medium hover:underline">
                            {r.brand.name}
                          </Link>
                        ) : (
                          r.brand.name
                        )}
                        <span className="block text-muted-foreground">{r.brand.owner.email}</span>
                        <span className="block text-muted-foreground">Brand: {r.brand.verificationStatus.toLowerCase()}</span>
                      </TableCell>
                      <TableCell className="max-w-[220px] text-xs">
                        <a href={r.signupUrl} target="_blank" rel="noreferrer noopener" className="block truncate text-primary hover:underline">
                          Signup: {r.signupUrl}
                        </a>
                        {r.programUrl ? (
                          <a href={r.programUrl} target="_blank" rel="noreferrer noopener" className="block truncate text-primary hover:underline">
                            Programme: {r.programUrl}
                          </a>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-xs">
                        {r.commissionDescription ?? r.commissionType.toLowerCase()}
                        <span className="block text-muted-foreground">
                          {r.networkName ?? "No network stated"}
                          {r.subIdParam ? ` · sub-id: ${r.subIdParam}` : ""}
                        </span>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={TONE[r.status]} label={r.status.replace("_", " ").toLowerCase()} />
                        <div className="mt-1">
                          <VerifiedProgramMark verifiedAt={r.verifiedAt} />
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <AffiliateReviewActions id={r.id} status={r.status} signupUrl={r.signupUrl} programUrl={r.programUrl} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
