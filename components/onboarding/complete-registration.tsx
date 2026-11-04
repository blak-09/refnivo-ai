"use client";

import { useActionState } from "react";
import Link from "next/link";
import { CheckIcon, Loader2Icon, PencilIcon } from "lucide-react";
import { completeOnboardingAction } from "@/app/actions/onboarding";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/forms/field";
import { ONBOARDING_PROFILE_PATH, withNext } from "@/lib/onboarding/paths";

/** Page 3 actions: go back and edit, or complete registration (writes the profile). */
export function CompleteRegistration({ next }: { next?: string | null }) {
  const [state, action, pending] = useActionState(completeOnboardingAction, null);
  return (
    <form action={action} className="space-y-4">
      <FormError message={state && !state.ok ? state.error : null} />
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <Button variant="outline" size="lg" nativeButton={false} render={<Link href={withNext(ONBOARDING_PROFILE_PATH, next)} />}>
          <PencilIcon aria-hidden /> Edit Profile
        </Button>
        <Button type="submit" size="lg" className="bg-gradient-brand min-w-56 text-white hover:opacity-95" disabled={pending}>
          {pending ? <Loader2Icon className="animate-spin" aria-hidden /> : <CheckIcon aria-hidden />}
          {pending ? "Creating your profile…" : "Complete Registration"}
        </Button>
      </div>
    </form>
  );
}
