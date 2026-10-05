import type { Metadata } from "next";
import { InfoIcon } from "lucide-react";
import { ProgramTypeBadge } from "@/components/affiliate/program-badge";
import { DirectoryView, type DirectorySearch } from "@/components/affiliate/directory-view";
import { CircleCallout } from "@/components/community/community-ui";

export const metadata: Metadata = {
  title: "Discover Affiliate Programs",
  description: "Find active affiliate opportunities from brands — Refnivo campaigns tracked on Refnivo, and brands' own external affiliate programs.",
};

/**
 * Public programme directory: Refnivo campaigns (run and tracked on Refnivo)
 * and external programmes (listed for discovery; the brand runs them).
 */
export default async function AffiliateProgramsPage({ searchParams }: { searchParams: Promise<DirectorySearch> }) {
  const sp = await searchParams;
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="max-w-3xl">
        <p className="text-sm font-semibold text-primary">Affiliate directory</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-5xl">Discover Affiliate Programs</h1>
        <p className="mt-3 text-base text-muted-foreground sm:text-lg">Find active affiliate opportunities from brands and start earning from products you recommend.</p>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <ProgramTypeBadge type="REFNIVO" /> <span>managed and tracked on Refnivo</span>
          <span aria-hidden className="mx-1">·</span>
          <ProgramTypeBadge type="EXTERNAL" /> <span>run by the brand — Refnivo lists it for discovery</span>
        </div>
      </div>

      <div className="mt-8">
        <DirectoryView basePath="/affiliate-programs" sp={sp} />
      </div>

      <CircleCallout audience="CREATOR" placement="affiliate-programs" className="mt-12" />

      <p className="mt-10 flex items-start gap-2 text-xs text-muted-foreground">
        <InfoIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        External programs are listed so creators can find them. Refnivo does not control their approval, tracking or payouts and is not partnered with those
        brands unless a listing says so.
      </p>
    </div>
  );
}
