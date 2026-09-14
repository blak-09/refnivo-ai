import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/primitives";
import { CampaignWizard } from "@/components/campaigns/campaign-wizard";
import { requireBrand } from "@/lib/auth/guards";
import { listBrandProducts } from "@/lib/services/products";

export const metadata: Metadata = { title: "New campaign" };

export default async function NewCampaignPage({ searchParams }: { searchParams: Promise<{ product?: string }> }) {
  const { brand } = await requireBrand();
  const { product } = await searchParams;
  const products = await listBrandProducts(brand.id);
  const preselected = products.find((p) => p.id === product && p.status === "ACTIVE");

  return (
    <div className="space-y-6">
      <PageHeader title="Create a campaign" description="Pick a product, set the commission and reward, add rules, and publish to the marketplace." />
      <CampaignWizard
        key={preselected?.id ?? "new"}
        mode="create"
        products={products.map((p) => ({ id: p.id, name: p.name, imageUrl: p.imageUrl, price: p.price, currency: p.currency, category: p.category, status: p.status }))}
        initialProductId={preselected?.id}
      />
    </div>
  );
}
