import Link from "next/link";
import type { Metadata } from "next";
import { ExternalLinkIcon } from "lucide-react";
import { PageHeader, StatusBadge } from "@/components/dashboard/primitives";
import { ProfileCompletionCard } from "@/components/onboarding/completion-card";
import { ProfileForm } from "@/components/onboarding/profile-form";
import { requireCreator } from "@/lib/auth/guards";
import { creatorCompletion } from "@/lib/onboarding/completion";
import { getOnboardingContext, profileFormValues } from "@/lib/services/onboarding";
import { uploadsAvailable } from "@/lib/storage/availability";
import { VERIFICATION_LABEL } from "@/lib/utils/labels";

export const metadata: Metadata = { title: "Creator profile" };

export default async function CreatorProfilePage() {
  const { user, profile } = await requireCreator();
  const ctx = await getOnboardingContext(user.id);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Creator profile"
        description={
          <span className="flex flex-wrap items-center gap-2">
            What brands see when you apply.
            <StatusBadge status={profile.verificationStatus} label={VERIFICATION_LABEL[profile.verificationStatus]} />
            <Link href={`/creators/${profile.username}`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
              View public profile <ExternalLinkIcon className="size-3" />
            </Link>
          </span>
        }
      />
      <ProfileCompletionCard completion={creatorCompletion(profile)} always />
      <ProfileForm role="CREATOR" mode="edit" values={profileFormValues(ctx, { preferDraft: false })} uploadsEnabled={uploadsAvailable()} email={ctx.email} />
    </div>
  );
}
