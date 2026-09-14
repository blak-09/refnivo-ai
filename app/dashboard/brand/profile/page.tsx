import Link from "next/link";
import type { Metadata } from "next";
import { ExternalLinkIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, StatusBadge } from "@/components/dashboard/primitives";
import { BrandForm } from "@/components/brand/brand-form";
import { requireBrand } from "@/lib/auth/guards";
import { VERIFICATION_LABEL } from "@/lib/utils/labels";

export const metadata: Metadata = { title: "Brand profile" };

export default async function BrandProfilePage() {
  const { brand } = await requireBrand();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Brand profile"
        description={
          <span className="flex flex-wrap items-center gap-2">
            Public details shown to creators and customers.
            <StatusBadge status={brand.verificationStatus} label={VERIFICATION_LABEL[brand.verificationStatus]} />
            <Link href={`/brands/${brand.slug}`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
              View public page <ExternalLinkIcon className="size-3" />
            </Link>
          </span>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>{brand.name}</CardTitle>
          <CardDescription>
            Public URL: <code className="font-mono">/brands/{brand.slug}</code>. Brand verification is reviewed by the platform team.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BrandForm mode="edit" brand={brand} />
        </CardContent>
      </Card>
    </div>
  );
}
