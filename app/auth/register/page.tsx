import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { RegisterForm } from "@/components/auth/register-form";
import { OnboardingStepper } from "@/components/onboarding/stepper";
import { manualReviewRoles } from "@/lib/config/signup-policy";
import { googleOAuthEnabled } from "@/lib/config/oauth";
import { GET_STARTED_PATH, safeNext } from "@/lib/onboarding/paths";
import { isRegistrableRole } from "@/lib/services/oauth";

export const metadata: Metadata = { title: "Create account" };

/**
 * Step 2 of signup: the account itself (e-mail + password, or Google) for the
 * role chosen on /get-started. Without a role the visitor is sent to choose one.
 */
export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ role?: string; error?: string; callbackUrl?: string; next?: string }> }) {
  const { role, error, callbackUrl, next: nextParam } = await searchParams;
  const next = safeNext(nextParam ?? callbackUrl);
  if (!isRegistrableRole(role)) {
    const params = new URLSearchParams();
    if (next) params.set("next", next);
    if (error) params.set("error", error);
    redirect(`${GET_STARTED_PATH}${params.size ? `?${params}` : ""}`);
  }
  const manual = manualReviewRoles().includes(role);
  return (
    <div className="w-full pt-6 sm:pt-10">
      <div className="mx-auto w-full max-w-md space-y-6">
        <OnboardingStepper current={2} />
        <AuthCard
          title="Create your account"
          description={manual ? "Accounts of this type are reviewed by our team before first sign-in." : "Next you'll set up your profile — it takes a few minutes."}
        >
          <RegisterForm role={role} manualReview={manual} googleEnabled={googleOAuthEnabled()} next={next} />
        </AuthCard>
      </div>
    </div>
  );
}
