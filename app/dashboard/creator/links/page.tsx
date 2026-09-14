import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/primitives";
import { PartnerLinksList } from "@/components/links/partner-links-list";
import { requireCreator } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Referral links & QR" };

export default async function CreatorLinksPage() {
  const { user } = await requireCreator();
  return (
    <div className="space-y-6">
      <PageHeader title="Referral links & QR codes" description="One unique link and QR code per campaign. Copy, download or share — every click and scan is tracked." />
      <PartnerLinksList userId={user.id} emptyDescription="Links are issued when a brand approves your application (or instantly for campaigns without approval)." />
    </div>
  );
}
