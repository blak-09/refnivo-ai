import Link from "next/link";
import type { Metadata } from "next";
import type { UserRole, UserStatus } from "@prisma/client";
import { UsersIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, PageHeader, StatusBadge } from "@/components/dashboard/primitives";
import { UserStatusActions } from "@/components/admin/admin-actions";
import { requireRole } from "@/lib/auth/guards";
import { ROLE_LABEL } from "@/lib/auth/roles";
import { listUsers } from "@/lib/services/admin";
import { formatDate } from "@/lib/utils/dates";

export const metadata: Metadata = { title: "Users" };

const ROLES: (UserRole | "ALL")[] = ["ALL", "BRAND_OWNER", "CREATOR", "CUSTOMER", "ADMIN"];
const STATUSES: (UserStatus | "ALL")[] = ["ALL", "PENDING", "APPROVED", "REJECTED", "SUSPENDED"];

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ q?: string; role?: string; status?: string }> }) {
  const admin = await requireRole("ADMIN");
  const { q, role, status } = await searchParams;
  const roleFilter = ROLES.includes(role as UserRole) ? (role as UserRole) : "ALL";
  const statusFilter = STATUSES.includes(status as UserStatus) ? (status as UserStatus) : "ALL";
  const users = await listUsers({ q, role: roleFilter, status: statusFilter });

  return (
    <div className="space-y-6">
      <PageHeader title="Users" description="Every account on the platform. Suspending signs the user out everywhere and blocks login until reactivated." />

      <form className="flex flex-col gap-2 sm:flex-row sm:items-end" action="/dashboard/admin/users" method="get">
        <div className="flex-1">
          <label htmlFor="q" className="text-xs font-medium text-muted-foreground">
            Search name, e-mail or registration ID
          </label>
          <Input id="q" name="q" defaultValue={q ?? ""} placeholder="Name, e-mail or registration ID" />
        </div>
        <div>
          <label htmlFor="role" className="text-xs font-medium text-muted-foreground">
            Role
          </label>
          <NativeSelect id="role" name="role" defaultValue={roleFilter}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r === "ALL" ? "All roles" : ROLE_LABEL[r]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div>
          <label htmlFor="status" className="text-xs font-medium text-muted-foreground">
            Status
          </label>
          <NativeSelect id="status" name="status" defaultValue={statusFilter}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s === "ALL" ? "All statuses" : s.toLowerCase()}
              </option>
            ))}
          </NativeSelect>
        </div>
        <Button type="submit" variant="outline">
          Filter
        </Button>
      </form>

      {!users.length ? (
        <EmptyState icon={UsersIcon} title="No users match" description="Try a different search or filter." />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Profile</TableHead>
                <TableHead>Joined / last login</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <span className="block font-medium">{u.name}</span>
                    <span className="block text-xs text-muted-foreground">{u.email}</span>
                    {u.registrationId ? <span className="block font-mono text-[10px] text-muted-foreground">{u.registrationId}</span> : null}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{ROLE_LABEL[u.role]}</Badge>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={u.status} />
                    {u.suspensionReason ? (
                      <span className="block max-w-48 truncate text-xs text-muted-foreground" title={u.suspensionReason}>
                        {u.suspensionReason}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-xs">
                    {u.brands.map((b) => (
                      <span key={b.id} className="block">
                        Brand: {b.name} <StatusBadge status={b.verificationStatus} className="ml-1" />
                      </span>
                    ))}
                    {u.creatorProfile ? (
                      <span className="block">
                        <Link href={`/creators/${u.creatorProfile.username}`} className="hover:underline">
                          @{u.creatorProfile.username}
                        </Link>{" "}
                        <StatusBadge status={u.creatorProfile.verificationStatus} className="ml-1" />
                      </span>
                    ) : null}
                    {!u.brands.length && !u.creatorProfile ? <span className="text-muted-foreground">—</span> : null}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {formatDate(u.createdAt)}
                    <span className="block">{u.lastLoginAt ? `Login ${formatDate(u.lastLoginAt)}` : "Never logged in"}</span>
                  </TableCell>
                  <TableCell>
                    <UserStatusActions userId={u.id} status={u.status} isSelf={u.id === admin.id} />
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
