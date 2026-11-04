import { redirect } from "next/navigation";
import { ONBOARDING_PROFILE_PATH } from "@/lib/onboarding/paths";

/** Moved to /onboarding/profile (role → profile → review). Kept so old links still work. */
export default function LegacyOnboardingPage() {
  redirect(ONBOARDING_PROFILE_PATH);
}
