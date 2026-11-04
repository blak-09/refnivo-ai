import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnboardingStepper } from "@/components/onboarding/stepper";
import { RoleSelection } from "@/components/onboarding/role-selection";
import { getCurrentUser } from "@/lib/auth/guards";
import { roleHome } from "@/lib/auth/roles";
import { safeNext } from "@/lib/onboarding/paths";
import { isRegistrable, roleChangeBlockers } from "@/lib/services/onboarding";
import { isRegistrableRole } from "@/lib/services/oauth";

export const metadata: Metadata = {
  title: "Get started",
  description: "Join Refnivo as a brand, a creator or a customer.",
};

const ERRORS: Record<string, string> = {
  "google-no-account": "There's no Refnivo account for that Google e-mail yet. Choose how you'd like to use Refnivo, then continue with Google to create one.",
};

/** Page 1 of onboarding — choose a role. */
export default async function GetStartedPage({ searchParams }: { searchParams: Promise<{ role?: string; next?: string; error?: string }> }) {
  const { role, next: nextParam, error } = await searchParams;
  const next = safeNext(nextParam);
  const user = await getCurrentUser();

  if (user && (user.onboardingCompletedAt || !isRegistrable(user.role))) redirect(next ?? roleHome(user.role));
  const roleLocked = user ? (await roleChangeBlockers(user.id)).length > 0 : false;
  const initialRole = user && isRegistrable(user.role) ? user.role : isRegistrableRole(role) ? role : null;

  return (
    <div className="w-full max-w-5xl space-y-8">
      <OnboardingStepper current={1} className="mx-auto max-w-2xl" />
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Welcome to Refnivo!</h1>
        <p className="mt-3 text-base text-muted-foreground sm:text-lg">How would you like to use Refnivo?</p>
      </div>
      <RoleSelection signedIn={!!user} initialRole={initialRole} roleLocked={roleLocked} next={next} error={error ? ERRORS[error] ?? null : null} />
    </div>
  );
}
