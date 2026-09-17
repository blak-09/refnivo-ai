import Link from "next/link";
import type { Metadata } from "next";
import { MegaphoneIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, PageHeader, StatusBadge } from "@/components/dashboard/primitives";
import { CampaignModeration } from "@/components/admin/admin-actions";
import { requireRole } from "@/lib/auth/guards";
import { formatMoney } from "@/lib/money";
import { listAllCampaigns } from "@/lib/services/admin";
import { formatDate } from "@/lib/utils/dates";
import { CAMPAIGN_TYPE_LABEL } from "@/lib/utils/labels";

export const metadata: Metadata = { title: "Campaign moderation" };

export default async function AdminCampaignsPage() {
  await requireRole("ADMIN");
  const campaigns = await listAllCampaigns();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campaigns"
        description="Every campaign across all brands. Pause, end or archive a campaign that breaks platform rules — the brand owner is notified with your reason and the change is audited."
      />
      {!campaigns.length ? (
        <EmptyState icon={MegaphoneIcon} title="No campaigns yet" />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Brand</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead className="text-right">Partners / referrals</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Moderation</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link href={`/campaigns/${c.slug}`} className="font-medium hover:underline">
                      {c.name}
                    </Link>
                    <span className="block text-xs text-muted-foreground">
                      {c.product.name}
                      {c.budget !== null ? ` · budget ${formatMoney(c.budget)}` : ""}
                    </span>
                  </TableCell>
                  <TableCell>
                    {c.brand.name}
                    {c.brand.verificationStatus === "VERIFIED" ? <Badge variant="secondary" className="ml-1">Verified</Badge> : null}
                  </TableCell>
                  <TableCell className="text-xs">{CAMPAIGN_TYPE_LABEL[c.campaignType]}</TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {formatDate(c.startDate)} → {c.endDate ? formatDate(c.endDate) : "open"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {c._count.referralLinks} / {c._count.referrals}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={c.status} />
                  </TableCell>
                  <TableCell>
                    <CampaignModeration campaignId={c.id} status={c.status} />
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
