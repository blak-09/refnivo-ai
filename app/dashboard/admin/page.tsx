import type { Metadata } from "next";
import { ShieldCheckIcon } from "lucide-react";
import { EmptyState, KpiCard, PageHeader } from "@/components/dashboard/primitives";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Admin overview" };

export default async function AdminOverviewPage() {
  await requireRole("ADMIN");
  const [users, brands, creators, customers, activeCampaigns, verified, revenue] = await Promise.all([
    prisma.user.count(),
    prisma.brand.count(),
    prisma.user.count({ where: { role: "CREATOR" } }),
    prisma.user.count({ where: { role: "CUSTOMER" } }),
    prisma.campaign.count({ where: { status: "ACTIVE" } }),
    prisma.referral.count({ where: { status: "VERIFIED" } }),
    prisma.conversion.aggregate({ where: { referral: { status: "VERIFIED" } }, _sum: { amount: true } }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Platform overview" description="Live counts from the database." />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total users" value={users} />
        <KpiCard label="Brands" value={brands} />
        <KpiCard label="Creators" value={creators} />
        <KpiCard label="Customers" value={customers} />
        <KpiCard label="Active campaigns" value={activeCampaigns} />
        <KpiCard label="Verified conversions" value={verified} />
        <KpiCard label="Attributed revenue" value={formatMoney(revenue._sum.amount ?? 0)} hint="Across all brands" />
      </div>
      <EmptyState
        icon={ShieldCheckIcon}
        title="Management tools arrive in the Admin phase"
        description="User, brand, creator, campaign, order, payout and audit-log management are built in the Admin phase of this MVP."
      />
    </div>
  );
}
