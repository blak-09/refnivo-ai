import Link from "next/link";
import type { Metadata } from "next";
import { LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dashboard/primitives";
import { DirectoryView, type DirectorySearch } from "@/components/affiliate/directory-view";
import { requireCreator } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Discover programs" };

/**
 * Creator → Discover Programs: every programme a creator can promote. Refnivo
 * campaigns are joined here and tracked by Refnivo; external programmes are
 * joined on the brand's official page, then the creator's affiliate link can be
 * added to Refnivo for click tracking.
 */
export default async function CreatorDiscoverPage({ searchParams }: { searchParams: Promise<DirectorySearch> }) {
  await requireCreator();
  const sp = await searchParams;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Find Brands to Promote"
        description="Join Refnivo campaigns in one click, or apply to brands' own affiliate programs and track your links here."
        actions={
          <Button variant="outline" nativeButton={false} render={<Link href="/dashboard/creator/affiliate-links" />}>
            <LinkIcon className="size-4" aria-hidden /> My affiliate links
          </Button>
        }
      />
      <DirectoryView basePath="/dashboard/creator/discover" sp={sp} />
    </div>
  );
}
