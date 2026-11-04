import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/primitives";
import { ProfileCompletionCard } from "@/components/onboarding/completion-card";
import { ProfileForm } from "@/components/onboarding/profile-form";
import { requireCustomer } from "@/lib/auth/guards";
import { getOnboardingContext, profileCompletionFor, profileFormValues } from "@/lib/services/onboarding";
import { uploadsAvailable } from "@/lib/storage/availability";

export const metadata: Metadata = { title: "Profile" };

export default async function CustomerProfilePage() {
  const user = await requireCustomer();
  const [ctx, completion] = await Promise.all([getOnboardingContext(user.id), profileCompletionFor(user.id, "CUSTOMER")]);
  return (
    <div className="space-y-6">
      <PageHeader title="Profile" description="Your interests and details. Only you can see this." />
      <ProfileCompletionCard completion={completion} always />
      <ProfileForm role="CUSTOMER" mode="edit" values={profileFormValues(ctx, { preferDraft: false })} uploadsEnabled={uploadsAvailable()} email={ctx.email} />
    </div>
  );
}
