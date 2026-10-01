import Link from "next/link";
import type { Metadata } from "next";
import type { AffiliateProgramStatus } from "@prisma/client";
import { PlusIcon, StoreIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, PageHeader, StatusBadge } from "@/components/dashboard/primitives";
import { VerifiedProgramMark } from "@/components/affiliate/program-badge";
import { AffiliateReviewActions } from "@/components/affiliate/review-actions";
import { AdminListingActions } from "@/components/affiliate/admin-listing-actions";
import { requireRole } from "@/lib/auth/guards";
import { listProgramsForReview, programBrandName } from "@/lib/services/affiliate-programs";
import { formatDate, formatDateTime } from "@/lib/utils/dates";
import { PROGRAM_TYPE_LABEL } from "@/lib/validation/affiliate";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Affiliate programs" };

const FILTERS: { value: AffiliateProgramStatus | "ALL"; label: string }[] = [
  { value: "PENDING_REVIEW", label: "To review" },
  { value: "APPROVED", label: "Active" },
  { value: "REJECTED", label: "Rejected" },
  { value: "PAUSED", label: "Inactive" },
  { value: "ALL", label: "All" },
];

const TONE: Record<AffiliateProgramStatus, string> = { DRAFT: "DRAFT", PENDING_REVIEW: "PENDING_REVIEW", APPROVED: "ACTIVE", REJECTED: "REJECTED", PAUSED: "PAUSED", CLOSED: "ENDED" };
const STATUS_LABEL: Record<AffiliateProgramStatus, string> = { DRAFT: "draft", PENDING_REVIEW: "to review", APPROVED: "active", REJECTED: "rejected", PAUSED: "inactive", CLOSED: "closed" };

/** Admin review queue for external affiliate programme listings. */
const PAGE_SIZE = 100;
const SOURCES = [
  { value: undefined, label: "All sources" },
  { value: "curated", label: "Added by Refnivo" },
  { value: "brand", label: "Brand submitted" },
] as const;

export default async function AdminAffiliateProgramsPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; source?: string; page?: string }> }) {
  await requireRole("ADMIN");
  const sp = await searchParams;
  const filter = FILTERS.some((f) => f.value === sp.status) ? (sp.status as AffiliateProgramStatus | "ALL") : "PENDING_REVIEW";
  const source = sp.source === "curated" || sp.source === "brand" ? sp.source : undefined;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const rows = await listProgramsForReview(filter, PAGE_SIZE, { q: sp.q, source, skip: (page - 1) * PAGE_SIZE });
  const href = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ status: filter, q: sp.q, source, ...over })) if (v) p.set(k, v);
    return `/dashboard/admin/affiliate-programs?${p}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Affiliate programs"
        description="External programmes brands already run. Nothing is public until approved here. Open both URLs before approving; only tick “verified” for what you actually checked."
        actions={
          <Button nativeButton={false} render={<Link href="/dashboard/admin/affiliate-programs/new" />}>
            <PlusIcon className="size-4" aria-hidden /> Add affiliate program
          </Button>
        }
      />
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter by status">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={href({ status: f.value, page: undefined })}
            role="tab"
            aria-selected={filter === f.value}
            className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors", filter === f.value ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted")}
          >
            {f.label}
          </Link>
        ))}
      </div>
      <form className="flex flex-col gap-2 sm:flex-row" role="search">
        <input type="hidden" name="status" value={filter} />
        <Input name="q" defaultValue={sp.q} placeholder="Search programme, brand, category or country…" aria-label="Search listings" className="sm:max-w-sm" />
        <NativeSelect name="source" defaultValue={source ?? ""} aria-label="Source" className="sm:w-48">
          {SOURCES.map((s) => (
            <option key={s.label} value={s.value ?? ""}>
              {s.label}
            </option>
          ))}
        </NativeSelect>
        <Button type="submit" variant="outline">
          Filter
        </Button>
      </form>

      <Card>
        <CardHeader>
          <CardTitle>Listings ({rows.total})</CardTitle>
          <CardDescription>
            Oldest submission first. “Activate” publishes a listing; “Check link” re-tests its official URL. Refnivo&apos;s own campaigns are managed under
            Campaigns.
          </CardDescription>
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
                        {r.featured ? <span className="ml-1.5 text-xs text-amber-600">★ featured</span> : null}
                        <span className="block text-xs text-muted-foreground">
                          {PROGRAM_TYPE_LABEL[r.programType]} · {r.category ?? "No category"}
                          {r.subcategory ? ` · ${r.subcategory}` : ""}
                        </span>
                        <span className="block text-xs text-muted-foreground">{r.submittedAt ? `submitted ${formatDateTime(r.submittedAt)}` : "draft"}</span>
                        <span className="block text-xs text-muted-foreground">
                          {r._count.links} creator links · {r._count.clicks} clicks
                        </span>
                      </TableCell>
                      <TableCell className="text-xs">
                        {r.brand ? (
                          <>
                            <Link href={`/brands/${r.brand.slug}`} className="font-medium hover:underline">
                              {r.brand.name}
                            </Link>
                            <span className="block text-muted-foreground">{r.brand.owner.email}</span>
                            <span className="block text-muted-foreground">Brand: {r.brand.verificationStatus.toLowerCase()}</span>
                          </>
                        ) : (
                          <>
                            <span className="font-medium">{programBrandName(r)}</span>
                            <span className="block text-muted-foreground">Listed by Refnivo — not on Refnivo</span>
                          </>
                        )}
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
                        {r.commissionDescription ?? r.commissionType?.toLowerCase() ?? "Commission not stated"}
                        <span className="block text-muted-foreground">
                          {r.networkName ?? "No network stated"}
                          {r.subIdParam ? ` · sub-id: ${r.subIdParam}` : ""}
                        </span>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={TONE[r.status]} label={STATUS_LABEL[r.status]} />
                        <div className="mt-1">
                          <VerifiedProgramMark verifiedAt={r.verifiedAt} />
                        </div>
                        {r.verifiedAt ? <span className="block text-[11px] text-muted-foreground">verified {formatDate(r.verifiedAt)}</span> : null}
                        {r.linkStatus ? (
                          <span className={r.linkStatus.startsWith("broken") || r.linkStatus === "unreachable" ? "block text-[11px] text-destructive" : "block text-[11px] text-muted-foreground"}>
                            link {r.linkStatus}
                            {r.linkCheckedAt ? ` · ${formatDate(r.linkCheckedAt)}` : ""}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="space-y-2 text-right">
                        <AffiliateReviewActions id={r.id} status={r.status} signupUrl={r.signupUrl} programUrl={r.programUrl} curated={!r.brand} />
                        <AdminListingActions id={r.id} status={r.status} creatorLinks={r._count.links} featured={r.featured} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {rows.total > PAGE_SIZE ? (
            <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Showing {(page - 1) * PAGE_SIZE + 1}–{(page - 1) * PAGE_SIZE + rows.length} of {rows.total}
              </span>
              <div className="flex gap-2">
                {page > 1 ? (
                  <Button size="sm" variant="outline" nativeButton={false} render={<Link href={href({ page: String(page - 1) })} />}>
                    Previous
                  </Button>
                ) : null}
                {page * PAGE_SIZE < rows.total ? (
                  <Button size="sm" variant="outline" nativeButton={false} render={<Link href={href({ page: String(page + 1) })} />}>
                    Next
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
