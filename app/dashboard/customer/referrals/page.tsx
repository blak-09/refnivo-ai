import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/primitives";
import { PartnerLinksList } from "@/components/links/partner-links-list";
import { requireRole } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "My links" };

export default async function CustomerLinksPage() {
  const user = await requireRole("CUSTOMER");
  return (
    <div className="space-y-6">
      <PageHeader title="My referral links" description="Copy, share on WhatsApp or show the QR code. Every click and purchase through your link is tracked." />
      <PartnerLinksList userId={user.id} emptyDescription="Join a campaign from the marketplace to get your first personal link." />
    </div>
  );
}
