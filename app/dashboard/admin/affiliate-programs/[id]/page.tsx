import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/dashboard/primitives";
import { AffiliateProgramForm } from "@/components/affiliate/program-form";
import { requireRole } from "@/lib/auth/guards";
import { uploadsAvailable } from "@/lib/storage/availability";
import { getProgramForAdmin, listBrandsForListing } from "@/lib/services/affiliate-programs";

export const metadata: Metadata = { title: "Edit affiliate program" };

/** Admin edits any listing in place; its status is unchanged. */
export default async function AdminEditAffiliateProgramPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("ADMIN");
  const [program, brands] = await Promise.all([getProgramForAdmin((await params).id), listBrandsForListing()]);
  if (!program) notFound();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={`Edit ${program.name}`} description={`Status: ${program.status.replace("_", " ").toLowerCase()}. Saving keeps the status.`} />
      <AffiliateProgramForm mode="admin" program={program} brands={brands} uploadsEnabled={uploadsAvailable()} />
    </div>
  );
}
