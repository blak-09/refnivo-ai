import Link from "next/link";
import type { Metadata } from "next";
import type { ApplicationStatus, PartnerType } from "@prisma/client";
import { UsersIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, KpiCard, PageHeader, StatusBadge } from "@/components/dashboard/primitives";
import { ApplicationDecision } from "@/components/partners/application-decision";
import { RemovePartner } from "@/components/partners/remove-partner";
import { CreatorAudience, CreatorSocialStats } from "@/components/creators/creator-stats";
import { ProductThumb } from "@/components/products/product-thumb";
import { requireBrand } from "@/lib/auth/guards";
import { countPartnersByStatus, listPartnerApplications } from "@/lib/services/partners";
import { formatDate } from "@/lib/utils/dates";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Creators & Customers" };

const STATUS_FILTERS: { value: ApplicationStatus | "ALL"; label: string }[] = [
  { value: "PENDING", label: "Pending review" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "ALL", label: "All" },
];
const TYPE_FILTERS: { value: PartnerType | "ALL"; label: string }[] = [
  { value: "ALL", label: "Creators & customers" },
  { value: "CREATOR", label: "Creators" },
  { value: "CUSTOMER", label: "Customers" },
];

export default async function CreatorsPage({ searchParams }: { searchParams: Promise<{ status?: string; type?: string }> }) {
  const { brand } = await requireBrand();
  const { status, type } = await searchParams;
  const filter = STATUS_FILTERS.some((f) => f.value === status) ? (status as ApplicationStatus | "ALL") : "PENDING";
  const typeFilter = TYPE_FILTERS.some((f) => f.value === type) ? (type as PartnerType | "ALL") : "ALL";

  const [applications, counts] = await Promise.all([
    listPartnerApplications(brand.id, filter, typeFilter === "ALL" ? undefined : typeFilter),
    countPartnersByStatus(brand.id),
  ]);

  const href = (s: string, t: string) => `/dashboard/brand/creators?status=${s}&type=${t}`;

  return (
    <div className="space-y-6">
      <PageHeader title="Creators & Customers" description="Review creator applications and see everyone promoting your products." />

      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard label="Pending applications" value={counts.PENDING} />
        <KpiCard label="Active partners" value={counts.APPROVED} hint="Approved across all campaigns" />
        <KpiCard label="Rejected" value={counts.REJECTED} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter by status">
          {STATUS_FILTERS.map((f) => (
            <Link key={f.value} href={href(f.value, typeFilter)} role="tab" aria-selected={filter === f.value} className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors", filter === f.value ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted")}>
              {f.label}
            </Link>
          ))}
        </div>
        <span className="hidden text-muted-foreground sm:inline">·</span>
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter by partner type">
          {TYPE_FILTERS.map((f) => (
            <Link key={f.value} href={href(filter, f.value)} role="tab" aria-selected={typeFilter === f.value} className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors", typeFilter === f.value ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted")}>
              {f.label}
            </Link>
          ))}
        </div>
      </div>

      {!applications.length ? (
        <EmptyState
          icon={UsersIcon}
          title={filter === "PENDING" ? "No applications waiting for review" : "Nothing here yet"}
          description="When a creator applies to one of your campaigns, or a customer joins a referral program, they show up here with their profile and audience details."
        />
      ) : (
        <div className="grid gap-3">
          {applications.map((a) => {
            const profile = a.user.creatorProfile;
            const displayName = profile?.displayName ?? a.user.name;
            return (
              <Card key={a.id} size="sm">
                <CardContent className="space-y-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <ProductThumb src={profile?.profileImageUrl} name={displayName} className="size-12 rounded-full" />
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {profile?.username ? (
                            <Link href={`/creators/${profile.username}`} className="text-sm font-semibold hover:underline">
                              {displayName}
                            </Link>
                          ) : (
                            <p className="text-sm font-semibold">{displayName}</p>
                          )}
                          <Badge variant="secondary">{a.partnerType === "CREATOR" ? "Creator" : "Customer"}</Badge>
                          <StatusBadge status={a.status} />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {profile?.username ? `@${profile.username} · ` : ""}
                          {[profile?.category, profile?.location].filter(Boolean).join(" · ")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Applied to <Link href={`/dashboard/brand/campaigns/${a.campaign.id}`} className="font-medium text-foreground hover:underline">{a.campaign.name}</Link> ({a.campaign.product.name}) · {formatDate(a.createdAt)}
                        </p>
                        {a.message ? <p className="text-sm italic text-muted-foreground">“{a.message}”</p> : null}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      {profile?.username ? (
                        <Button size="sm" variant="ghost" nativeButton={false} render={<Link href={`/creators/${profile.username}`} />}>
                          View profile
                        </Button>
                      ) : null}
                      {a.status === "PENDING" ? <ApplicationDecision applicationId={a.id} /> : null}
                      {a.status === "APPROVED" ? <RemovePartner applicationId={a.id} /> : null}
                    </div>
                  </div>
                  {profile ? (
                    <div className="grid gap-3 rounded-lg border bg-muted/30 p-3 lg:grid-cols-2">
                      <CreatorSocialStats profile={profile} compactView />
                      <CreatorAudience profile={profile} />
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
