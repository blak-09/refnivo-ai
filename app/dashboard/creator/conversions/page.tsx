import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/primitives";
import { PartnerConversionsTable } from "@/components/links/partner-conversions-table";
import { requireCreator } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Conversions" };

export default async function CreatorConversionsPage() {
  const { user } = await requireCreator();
  return (
    <div className="space-y-6">
      <PageHeader title="Conversions" description="Orders brands recorded against your links. Commission is released when the brand verifies the order." />
      <PartnerConversionsTable userId={user.id} kind="commission" />
    </div>
  );
}
