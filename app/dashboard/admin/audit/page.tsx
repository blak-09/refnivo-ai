import type { Metadata } from "next";
import { ScrollTextIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, PageHeader } from "@/components/dashboard/primitives";
import { requireRole } from "@/lib/auth/guards";
import { listAuditLogs } from "@/lib/services/admin";
import { formatDateTime } from "@/lib/utils/dates";

export const metadata: Metadata = { title: "Audit log" };

/** Metadata never contains secrets (see lib/services/audit.ts); it is shown verbatim for traceability. */
function metadataText(value: unknown): string {
  if (value === null || value === undefined) return "";
  try {
    const s = JSON.stringify(value);
    return s.length > 160 ? `${s.slice(0, 160)}…` : s;
  } catch {
    return "";
  }
}

export default async function AdminAuditPage({ searchParams }: { searchParams: Promise<{ action?: string; entityType?: string; userId?: string }> }) {
  await requireRole("ADMIN");
  const { action, entityType, userId } = await searchParams;
  const rows = await listAuditLogs({ action, entityType, userId });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit log"
        description="Every mutation on the platform, written in the same transaction as the change. Actor, role, hashed IP and request id are captured for security review."
      />

      <form className="flex flex-col gap-2 sm:flex-row sm:items-end" action="/dashboard/admin/audit" method="get">
        <div className="flex-1">
          <label htmlFor="action" className="text-xs font-medium text-muted-foreground">
            Action contains
          </label>
          <Input id="action" name="action" defaultValue={action ?? ""} placeholder="e.g. PAYOUT, CONVERSION, USER_" />
        </div>
        <div>
          <label htmlFor="entityType" className="text-xs font-medium text-muted-foreground">
            Entity type
          </label>
          <Input id="entityType" name="entityType" defaultValue={entityType ?? ""} placeholder="User, Campaign…" />
        </div>
        <div>
          <label htmlFor="userId" className="text-xs font-medium text-muted-foreground">
            Actor user id
          </label>
          <Input id="userId" name="userId" defaultValue={userId ?? ""} />
        </div>
        <Button type="submit" variant="outline">
          Filter
        </Button>
      </form>

      {!rows.length ? (
        <EmptyState icon={ScrollTextIcon} title="No audit entries match" />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap text-xs">{formatDateTime(r.createdAt)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-[11px]">
                      {r.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    {r.user ? (
                      <>
                        {r.user.name}
                        <span className="block text-muted-foreground">
                          {r.user.email} · {r.actorRole ?? r.user.role}
                        </span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">system / anonymous</span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {r.entityType}
                    {r.entityId ? <span className="block text-[10px] text-muted-foreground">{r.entityId}</span> : null}
                  </TableCell>
                  <TableCell className="max-w-72 font-mono text-[11px] text-muted-foreground">
                    {metadataText(r.metadata)}
                    {r.requestId ? <span className="block">req {r.requestId}</span> : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
