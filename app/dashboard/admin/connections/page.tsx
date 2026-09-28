import Link from "next/link";
import type { Metadata } from "next";
import type { ConnectionStatus } from "@prisma/client";
import { HandshakeIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, KpiCard, PageHeader, StatusBadge } from "@/components/dashboard/primitives";
import { requireRole } from "@/lib/auth/guards";
import { countConnectionsByStatus, listAllConnections } from "@/lib/services/connections";
import { formatDateTime } from "@/lib/utils/dates";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Connections" };

const FILTERS: { value: ConnectionStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "ACCEPTED", label: "Accepted" },
  { value: "DECLINED", label: "Declined" },
  { value: "BLOCKED", label: "Blocked" },
];

const TONE: Record<ConnectionStatus, string> = { PENDING: "PURCHASED", ACCEPTED: "VERIFIED", DECLINED: "REJECTED", BLOCKED: "REJECTED" };

/** Read-only oversight of brand<->creator relationships. */
export default async function AdminConnectionsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireRole("ADMIN");
  const { status } = await searchParams;
  const filter = FILTERS.some((f) => f.value === status) ? (status as ConnectionStatus | "ALL") : "ALL";
  const [rows, counts] = await Promise.all([listAllConnections(filter), countConnectionsByStatus()]);

  return (
    <div className="space-y-6">
      <PageHeader title="Connections" description="Direct brand and creator relationships. Requests are private between the two sides; this view is for moderation." />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Accepted" value={counts.ACCEPTED ?? 0} icon={HandshakeIcon} />
        <KpiCard label="Pending" value={counts.PENDING ?? 0} hint="Waiting for a reply" />
        <KpiCard label="Declined" value={counts.DECLINED ?? 0} />
        <KpiCard label="Blocked" value={counts.BLOCKED ?? 0} hint="Review if a pattern appears" />
      </div>

      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter by status">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={f.value === "ALL" ? "/dashboard/admin/connections" : `/dashboard/admin/connections?status=${f.value}`}
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
          <CardTitle>Recent connections</CardTitle>
          <CardDescription>Newest first, up to 100.</CardDescription>
        </CardHeader>
        <CardContent>
          {!rows.length ? (
            <EmptyState icon={HandshakeIcon} title="No connections yet" description="Requests appear here as soon as brands and creators start connecting." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Updated</TableHead>
                    <TableHead>Brand</TableHead>
                    <TableHead>Creator</TableHead>
                    <TableHead>Opened by</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs whitespace-nowrap">{formatDateTime(r.respondedAt ?? r.createdAt)}</TableCell>
                      <TableCell className="text-xs">
                        {r.brand.slug ? (
                          <Link href={`/brands/${r.brand.slug}`} className="font-medium hover:underline">
                            {r.brand.name}
                          </Link>
                        ) : (
                          r.brand.name
                        )}
                        <span className="block text-muted-foreground">{r.brand.industry ?? "—"}</span>
                      </TableCell>
                      <TableCell className="text-xs">
                        {r.creator.creatorProfile?.username ? (
                          <Link href={`/creators/${r.creator.creatorProfile.username}`} className="font-medium hover:underline">
                            {r.creator.creatorProfile.displayName ?? r.creator.name}
                          </Link>
                        ) : (
                          r.creator.name
                        )}
                        <span className="block text-muted-foreground">{r.creator.creatorProfile?.category ?? "—"}</span>
                      </TableCell>
                      <TableCell className="text-xs">{r.initiator === "BRAND" ? "Brand" : "Creator"}</TableCell>
                      <TableCell>
                        <StatusBadge status={TONE[r.status]} label={r.status.charAt(0) + r.status.slice(1).toLowerCase()} />
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
