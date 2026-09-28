import type { Metadata } from "next";
import { ConnectionsPage } from "@/components/connections/connections-page";
import { requireCreator } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Connections" };

export default async function CreatorConnectionsPage({ searchParams }: { searchParams: Promise<{ tab?: string; page?: string }> }) {
  const { user } = await requireCreator();
  return (
    <ConnectionsPage
      viewer={{ kind: "CREATOR", creatorId: user.id }}
      basePath="/dashboard/creator/connections"
      discover={{ href: "/brands", label: "Discover brands" }}
      searchParams={searchParams}
    />
  );
}
