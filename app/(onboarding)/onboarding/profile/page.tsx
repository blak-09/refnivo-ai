import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnboardingStepper } from "@/components/onboarding/stepper";
import { ProfileForm } from "@/components/onboarding/profile-form";
import { requireUser } from "@/lib/auth/guards";
import { roleHome } from "@/lib/auth/roles";
import { safeNext } from "@/lib/onboarding/paths";
import { getOnboardingContext, isRegistrable, profileFormValues, readDraft } from "@/lib/services/onboarding";
import { uploadsAvailable } from "@/lib/storage/availability";

export const metadata: Metadata = { title: "Complete your profile" };

const COPY = {
  BRAND_OWNER: { title: "Build Your Brand Profile", subtitle: "Tell us about your brand so creators and customers can discover you." },
  CREATOR: { title: "Create Your Creator Profile", subtitle: "Help brands understand your content, audience and interests." },
  CUSTOMER: { title: "Create Your Customer Profile", subtitle: "Personalize your experience on Refnivo." },
} as const;

/** Page 2 of onboarding — the role-specific profile form. */
export default async function OnboardingProfilePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  const user = await requireUser();
  if (user.onboardingCompletedAt || !isRegistrable(user.role)) redirect(next ?? roleHome(user.role));

  const ctx = await getOnboardingContext(user.id);
  const draft = readDraft(ctx.onboardingDraft, user.role);
  const uploads = uploadsAvailable();
  const copy = COPY[user.role];

  return (
    <div className="w-full max-w-3xl space-y-8">
      <OnboardingStepper current={3} className="mx-auto max-w-2xl" />
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{copy.title}</h1>
        <p className="mt-2 text-muted-foreground">{copy.subtitle}</p>
      </div>
      <ProfileForm
        role={user.role}
        mode="onboarding"
        values={profileFormValues(ctx, { preferDraft: true })}
        uploadsEnabled={uploads}
        photoRequired={uploads && user.role === "CREATOR"}
        email={ctx.email}
        next={next}
        savedAt={draft?.savedAt || null}
      />
    </div>
  );
}
