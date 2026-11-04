import Link from "next/link";
import type { Metadata } from "next";
import { ExternalLinkIcon } from "lucide-react";
import { PageHeader, StatusBadge } from "@/components/dashboard/primitives";
import { ProfileCompletionCard } from "@/components/onboarding/completion-card";
import { ProfileForm } from "@/components/onboarding/profile-form";
import { requireBrand } from "@/lib/auth/guards";
import { brandCompletion } from "@/lib/onboarding/completion";
import { getOnboardingContext, profileFormValues } from "@/lib/services/onboarding";
import { uploadsAvailable } from "@/lib/storage/availability";
import { VERIFICATION_LABEL } from "@/lib/utils/labels";

export const metadata: Metadata = { title: "Brand profile" };

export default async function BrandProfilePage() {
  const { user, brand } = await requireBrand();
  const ctx = await getOnboardingContext(user.id);
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
      <ProfileCompletionCard completion={brandCompletion(brand)} always />
      <ProfileForm role="BRAND_OWNER" mode="edit" values={profileFormValues(ctx, { preferDraft: false })} uploadsEnabled={uploadsAvailable()} email={ctx.email} />
    </div>
  );
}
