import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/dashboard/primitives";
import { AffiliateProgramForm } from "@/components/affiliate/program-form";
import { requireBrand } from "@/lib/auth/guards";
import { getBrandProgram } from "@/lib/services/affiliate-programs";

export const metadata: Metadata = { title: "Edit affiliate program" };

export default async function EditAffiliateProgramPage({ params }: { params: Promise<{ id: string }> }) {
  const { brand } = await requireBrand();
  const program = await getBrandProgram(brand.id, (await params).id);
  if (!program) notFound();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={`Edit ${program.name}`} description={program.reviewNote ? `Reviewer note: ${program.reviewNote}` : "Update your listing."} />
      <AffiliateProgramForm program={program} />
    </div>
  );
}
