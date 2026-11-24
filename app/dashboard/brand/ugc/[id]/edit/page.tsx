import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/dashboard/primitives";
import { BriefForm } from "@/components/ugc/brief-form";
import { requireBrand } from "@/lib/auth/guards";
import { listBrandProducts } from "@/lib/services/products";
import { getBrandBrief } from "@/lib/services/ugc";
import { toDateInputValue } from "@/lib/utils/dates";

export const metadata: Metadata = { title: "Edit UGC brief" };

export default async function EditBriefPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { brand } = await requireBrand();
  const brief = await getBrandBrief(brand.id, id);
  if (!brief) notFound();
  if (brief.status !== "DRAFT" && brief.status !== "OPEN") redirect(`/dashboard/brand/ugc/${brief.id}`);
  const products = await listBrandProducts(brand.id);
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Edit brief" description={brief.status === "OPEN" ? "This brief is live: creators who already applied see the updated terms. The fee of creators you already accepted does not change." : "Changes are saved to the draft."} />
      <BriefForm
        briefId={brief.id}
        products={products.filter((p) => p.status !== "ARCHIVED" || p.id === brief.productId).map((p) => ({ id: p.id, name: p.name }))}
        defaults={{
          title: brief.title,
          description: brief.description,
          deliverables: brief.deliverables,
          contentTypes: brief.contentTypes,
          feeRupees: String(brief.feeAmount / 100),
          creatorsNeeded: String(brief.creatorsNeeded),
          usageRights: brief.usageRights,
          usageNotes: brief.usageNotes ?? "",
          productId: brief.productId ?? "",
          productShipped: brief.productShipped,
          applyBy: toDateInputValue(brief.applyBy),
          deliverBy: toDateInputValue(brief.deliverBy),
        }}
      />
    </div>
  );
}
