import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/dashboard/primitives";
import { CampaignWizard } from "@/components/campaigns/campaign-wizard";
import { requireBrand } from "@/lib/auth/guards";
import { canEdit } from "@/lib/domain/campaign-rules";
import { getCampaign } from "@/lib/services/campaigns";
import { listBrandProducts } from "@/lib/services/products";
import { getCampaignAllowance } from "@/lib/services/plan-limits";

export const metadata: Metadata = { title: "Edit campaign" };

export default async function EditCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { brand } = await requireBrand();
  const { id } = await params;
  const [campaign, products, allowance] = await Promise.all([getCampaign(brand.id, id), listBrandProducts(brand.id), getCampaignAllowance(brand.id)]);
  if (!campaign) notFound();
  if (!canEdit(campaign.status)) redirect(`/dashboard/brand/campaigns/${id}`);

  return (
    <div className="space-y-6">
      <PageHeader title={`Edit: ${campaign.name}`} description="Update the commission, reward, rules or duration. Changes are re-validated before saving." />
      <CampaignWizard
        mode="edit"
        campaign={campaign}
        planRequired={!campaign.publishedAt && !allowance.canLaunch}
        products={products.map((p) => ({ id: p.id, name: p.name, imageUrl: p.imageUrl, price: p.price, currency: p.currency, category: p.category, status: p.status }))}
      />
    </div>
  );
}
