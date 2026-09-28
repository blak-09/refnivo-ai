import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/primitives";
import { ProgramTypeBadge } from "@/components/affiliate/program-badge";
import { AffiliateProgramForm } from "@/components/affiliate/program-form";
import { requireRole } from "@/lib/auth/guards";
import { listBrandsForListing } from "@/lib/services/affiliate-programs";

export const metadata: Metadata = { title: "Add affiliate program" };

/** Admin adds a listing, e.g. a programme a brand runs publicly but has not listed on Refnivo. */
export default async function AdminNewAffiliateProgramPage() {
  await requireRole("ADMIN");
  const brands = await listBrandsForListing();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Add an affiliate program"
        description="Use the programme's official signup page — the brand's own, or its authorised affiliate network's. Fill in only what the programme publishes. The listing goes to the review queue; publish it from there after checking."
      />
      <ProgramTypeBadge type="EXTERNAL" />
      <AffiliateProgramForm mode="admin" brands={brands} />
    </div>
  );
}
