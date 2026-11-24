import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/dashboard/primitives";
import { BriefForm } from "@/components/ugc/brief-form";
import { requireBrand } from "@/lib/auth/guards";
import { getBrandEntitlements } from "@/lib/services/plan-limits";
import { listBrandProducts } from "@/lib/services/products";

export const metadata: Metadata = { title: "New UGC brief" };

export default async function NewBriefPage() {
  const { brand } = await requireBrand();
  const entitlements = await getBrandEntitlements(brand.id);
  if (!entitlements.features.ugc) redirect("/dashboard/brand/ugc");
  const products = await listBrandProducts(brand.id);
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="New UGC brief" description="It is saved as a draft. Publish it from the brief page when you are ready for creators to apply." />
      <BriefForm products={products.filter((p) => p.status !== "ARCHIVED").map((p) => ({ id: p.id, name: p.name }))} />
    </div>
  );
}
