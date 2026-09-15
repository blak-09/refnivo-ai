import type { Metadata } from "next";
import type { Prisma, UserRole, UserStatus } from "@prisma/client";
import { PageHeader } from "@/components/dashboard/primitives";
import { StatusBadge } from "@/components/dashboard/primitives";
import { NativeSelect } from "@/components/ui/native-select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RegistrationRowActions, type AdminRegistration } from "@/components/admin/registration-row-actions";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { ROLE_LABEL } from "@/lib/auth/roles";
import { asRegistrationDetails } from "@/lib/services/registrations";

export const metadata: Metadata = { title: "Registrations" };

const STATUS_VALUES: UserStatus[] = ["PENDING", "APPROVED", "REJECTED", "SUSPENDED"];
const ROLE_VALUES: UserRole[] = ["BRAND_OWNER", "CREATOR", "CUSTOMER", "ADMIN"];

export default async function AdminRegistrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; role?: string; q?: string }>;
}) {
  await requireRole("ADMIN");
  const { status, role, q } = await searchParams;

  const statusFilter = STATUS_VALUES.includes(status as UserStatus) ? (status as UserStatus) : undefined;
  const roleFilter = ROLE_VALUES.includes(role as UserRole) ? (role as UserRole) : undefined;
  const query = (q ?? "").trim();

  const where: Prisma.UserWhereInput = {
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(roleFilter ? { role: roleFilter } : {}),
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
            { registrationId: { contains: query, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [rows, counts] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 200,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        registrationId: true,
        createdAt: true,
        approvedAt: true,
        rejectedAt: true,
        rejectionReason: true,
        registrationDetails: true,
      },
    }),
    prisma.user.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const countBy = Object.fromEntries(counts.map((c) => [c.status, c._count._all])) as Record<string, number>;
  const registrations: AdminRegistration[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    phone: r.phone,
    role: r.role,
    status: r.status,
    registrationId: r.registrationId,
    createdAt: r.createdAt,
    approvedAt: r.approvedAt,
    rejectedAt: r.rejectedAt,
    rejectionReason: r.rejectionReason,
    details: asRegistrationDetails(r.registrationDetails),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Registrations"
        description="Review new accounts and approve or reject them. Approved users can sign in; rejected users see the reason you give."
      />

      <div className="flex flex-wrap gap-2">
        {STATUS_VALUES.map((s) => (
          <StatusBadge key={s} status={s} label={`${s.charAt(0) + s.slice(1).toLowerCase()} · ${countBy[s] ?? 0}`} />
        ))}
      </div>

      <Card>
        <CardContent className="pt-6">
          <form method="get" className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px] space-y-1">
              <label htmlFor="q" className="text-xs font-medium text-muted-foreground">
                Search name, email or ID
              </label>
              <Input id="q" name="q" defaultValue={query} placeholder="Search…" />
            </div>
            <div className="space-y-1">
              <label htmlFor="role" className="text-xs font-medium text-muted-foreground">
                Role
              </label>
              <NativeSelect id="role" name="role" defaultValue={roleFilter ?? ""}>
                <option value="">All roles</option>
                {ROLE_VALUES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1">
              <label htmlFor="status" className="text-xs font-medium text-muted-foreground">
                Status
              </label>
              <NativeSelect id="status" name="status" defaultValue={statusFilter ?? ""}>
                <option value="">All statuses</option>
                {STATUS_VALUES.map((s) => (
                  <option key={s} value={s}>
                    {s.charAt(0) + s.slice(1).toLowerCase()}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <Button type="submit">Filter</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {registrations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No registrations match these filters.</p>
          ) : (
            <div className="space-y-3">
              {registrations.map((reg) => (
                <div key={reg.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium">{reg.name}</p>
                      <StatusBadge status={reg.status} />
                    </div>
                    <p className="truncate text-sm text-muted-foreground">
                      {reg.email} · {ROLE_LABEL[reg.role]} · {reg.createdAt.toLocaleDateString()}
                      {reg.registrationId ? ` · ${reg.registrationId}` : ""}
                    </p>
                  </div>
                  <RegistrationRowActions reg={reg} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
