import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CompleteRegistration } from "@/components/onboarding/complete-registration";
import { OnboardingStepper } from "@/components/onboarding/stepper";
import { ProfilePreview } from "@/components/onboarding/profile-preview";
import { requireUser } from "@/lib/auth/guards";
import { roleHome } from "@/lib/auth/roles";
import { ONBOARDING_PROFILE_PATH, safeNext, withNext } from "@/lib/onboarding/paths";
import { getOnboardingContext, isRegistrable, readDraft } from "@/lib/services/onboarding";
import { uploadsAvailable } from "@/lib/storage/availability";
import { brandProfileSchema, creatorProfileOnboardingSchema, customerProfileSchema } from "@/lib/validation/onboarding";

export const metadata: Metadata = { title: "Review your profile" };

/** Page 3 of onboarding — preview exactly what will be saved, then complete registration. */
export default async function OnboardingReviewPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  const user = await requireUser();
  if (user.onboardingCompletedAt || !isRegistrable(user.role)) redirect(next ?? roleHome(user.role));

  const ctx = await getOnboardingContext(user.id);
  const draft = readDraft(ctx.onboardingDraft, user.role);
  const back = withNext(ONBOARDING_PROFILE_PATH, next);
  if (!draft) redirect(back);
  const images = uploadsAvailable() ? "required" : "optional";

  let preview: React.ReactNode;
  if (user.role === "BRAND_OWNER") {
    const parsed = brandProfileSchema().safeParse(draft.values);
    if (!parsed.success) redirect(back);
    preview = <ProfilePreview role="BRAND_OWNER" values={parsed.data} />;
  } else if (user.role === "CREATOR") {
    const parsed = creatorProfileOnboardingSchema(images).safeParse(draft.values);
    if (!parsed.success) redirect(back);
    preview = <ProfilePreview role="CREATOR" values={parsed.data} />;
  } else {
    const parsed = customerProfileSchema().safeParse(draft.values);
    if (!parsed.success) redirect(back);
    preview = <ProfilePreview role="CUSTOMER" values={parsed.data} email={ctx.email} />;
  }

  return (
    <div className="w-full max-w-3xl space-y-8">
      <OnboardingStepper current={4} className="mx-auto max-w-2xl" />
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Review Your Profile</h1>
        <p className="mt-2 text-muted-foreground">This is how your profile will appear on Refnivo. You can edit it any time from Settings.</p>
      </div>
      {preview}
      <CompleteRegistration next={next} />
    </div>
  );
}
