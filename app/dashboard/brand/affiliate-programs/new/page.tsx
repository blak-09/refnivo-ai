import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/primitives";
import { ProgramTypeBadge } from "@/components/affiliate/program-badge";
import { AffiliateProgramForm } from "@/components/affiliate/program-form";
import { requireBrand } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "List an affiliate program" };

export default async function NewAffiliateProgramPage() {
  await requireBrand();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="List an existing affiliate program"
        description="Already running an affiliate program? List it on Refnivo and let creators discover it. Creators join on your own platform — Refnivo reviews the listing before it goes live."
      />
      <ProgramTypeBadge type="EXTERNAL" />
      <AffiliateProgramForm />
    </div>
  );
}
