import type { Metadata } from "next";
import { ConnectionsPage } from "@/components/connections/connections-page";
import { requireBrand } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Connections" };

export default async function BrandConnectionsPage({ searchParams }: { searchParams: Promise<{ tab?: string; page?: string }> }) {
  const { brand } = await requireBrand();
  return (
    <ConnectionsPage
      viewer={{ kind: "BRAND", brandId: brand.id }}
      basePath="/dashboard/brand/connections"
      discover={{ href: "/creators", label: "Discover creators" }}
      searchParams={searchParams}
    />
  );
}
