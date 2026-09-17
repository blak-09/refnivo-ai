import Link from "next/link";
import type { Metadata } from "next";
import { BadgeCheckIcon, MegaphoneIcon, UsersIcon, WalletIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard, PageHeader } from "@/components/dashboard/primitives";
import { PendingUsers } from "@/components/admin/pending-users";
import type { AdminRegistration } from "@/components/admin/registration-row-actions";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { formatMoney } from "@/lib/money";
import { platformStats } from "@/lib/services/admin";
import { asRegistrationDetails } from "@/lib/services/registrations";

export const metadata: Metadata = { title: "Admin overview" };

export default async function AdminOverviewPage() {
  await requireRole("ADMIN");
  const [stats, pendingUsers] = await Promise.all([
    platformStats(),
    prisma.user.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      take: 25,
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
  ]);

  const queues = [
    { label: "Registrations awaiting approval", value: stats.byStatus.PENDING, href: "/dashboard/admin/registrations", icon: UsersIcon },
    { label: "Open payout / redemption requests", value: stats.openPayouts, href: "/dashboard/admin/payouts", icon: WalletIcon },
    { label: "Creator applications pending at brands", value: stats.pendingApplications, href: "/dashboard/admin/campaigns", icon: MegaphoneIcon },
    { label: "Verification queue", value: null, href: "/dashboard/admin/verification", icon: BadgeCheckIcon },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Platform overview" description="Live counts from the database." />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total users" value={stats.users} hint={`${stats.byStatus.APPROVED} approved · ${stats.byStatus.SUSPENDED} suspended`} />
        <KpiCard label="Brands" value={stats.brands} />
        <KpiCard label="Creators" value={stats.creators} />
        <KpiCard label="Customers" value={stats.customers} />
        <KpiCard label="Active campaigns" value={stats.activeCampaigns} hint={`${stats.campaigns} total`} />
        <KpiCard label="Referral links / clicks" value={`${stats.links} / ${stats.clicks}`} />
        <KpiCard label="Verified conversions" value={stats.verified} />
        <KpiCard label="Attributed revenue" value={formatMoney(stats.revenue)} hint="Verified orders, all brands" />
        <KpiCard label="Commissions owed / paid" value={formatMoney(stats.commissions)} hint="Approved + paid" />
        <KpiCard label="Rewards available / redeemed" value={formatMoney(stats.rewards)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Work queues</CardTitle>
          <CardDescription>Items waiting for an admin decision.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          {queues.map((q) => (
            <Button key={q.href} variant="outline" className="h-auto justify-start gap-3 py-3" nativeButton={false} render={<Link href={q.href} />}>
              <q.icon className="size-4 text-primary" aria-hidden />
              <span className="flex-1 text-left">{q.label}</span>
              {q.value !== null ? <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums">{q.value}</span> : null}
            </Button>
          ))}
        </CardContent>
      </Card>

      <PendingUsers users={pendingUsers.map((u): AdminRegistration => ({ ...u, details: asRegistrationDetails(u.registrationDetails) }))} />
    </div>
  );
}
