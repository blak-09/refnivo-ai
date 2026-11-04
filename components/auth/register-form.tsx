"use client";

import { useActionState } from "react";
import Link from "next/link";
import { registerAction } from "@/app/actions/auth";
import { Input } from "@/components/ui/input";
import { Field, FormError } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { GoogleAuthForm, OrDivider } from "@/components/auth/google-button";
import { RoleIcon } from "@/components/onboarding/role-icon";
import { useFormAttempt } from "@/components/forms/use-form-attempt";
import { GET_STARTED_PATH, ONBOARDING_PROFILE_PATH, withNext } from "@/lib/onboarding/paths";
import { ROLE_CARDS } from "@/lib/onboarding/roles";
import type { RegistrableRole } from "@/lib/validation/auth";

/**
 * The account step of signup. The role was chosen on /get-started and is shown
 * here with a "Change" link; brand and creator details come on the profile step.
 */
export function RegisterForm({
  role,
  manualReview = false,
  googleEnabled = false,
  next,
}: {
  role: RegistrableRole;
  manualReview?: boolean;
  googleEnabled?: boolean;
  next?: string | null;
}) {
  const [state, action] = useActionState(registerAction, null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const values = state && !state.ok ? (state.values ?? {}) : {};
  const attempt = useFormAttempt(state);
  const card = ROLE_CARDS[role];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-xl border bg-muted/40 p-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <RoleIcon role={role} className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">Signing up as</p>
          <p className="text-sm font-semibold">{card.short}</p>
        </div>
        <Link href={withNext(GET_STARTED_PATH, next)} className="rounded-md px-2 py-1 text-sm font-medium text-primary hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
          Change
        </Link>
      </div>

      {googleEnabled ? (
        <>
          <GoogleAuthForm role={role} callbackUrl={withNext(ONBOARDING_PROFILE_PATH, next)} label="Continue with Google" />
          <OrDivider>or sign up with email</OrDivider>
        </>
      ) : null}

      <form key={attempt} action={action} className="space-y-5" noValidate>
        <FormError message={state && !state.ok ? state.error : null} />
        <input type="hidden" name="role" value={role} />
        {next ? <input type="hidden" name="next" value={next} /> : null}

        <div className="space-y-4">
          <Field label="Full name" htmlFor="name" error={errors.name} required>
            <Input id="name" name="name" autoComplete="name" defaultValue={values.name} required aria-invalid={!!errors.name} />
          </Field>
          <Field label="Email" htmlFor="email" error={errors.email} required>
            <Input id="email" name="email" type="email" autoComplete="email" defaultValue={values.email} required aria-invalid={!!errors.email} />
          </Field>
          <Field label="Phone (optional)" htmlFor="phone" error={errors.phone} hint="Used only for account recovery and partner coordination.">
            <Input id="phone" name="phone" type="tel" autoComplete="tel" defaultValue={values.phone} placeholder="+91 98765 43210" aria-invalid={!!errors.phone} />
          </Field>
          <Field label="Password" htmlFor="password" error={errors.password} hint="At least 8 characters with a letter and a number." required>
            <Input id="password" name="password" type="password" autoComplete="new-password" required aria-invalid={!!errors.password} />
          </Field>
          <Field label="Confirm password" htmlFor="confirmPassword" error={errors.confirmPassword} required>
            <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required aria-invalid={!!errors.confirmPassword} />
          </Field>
        </div>

        {manualReview ? (
          <div className="rounded-lg border border-dashed bg-muted/40 p-3 text-xs text-muted-foreground">
            Accounts of this type are reviewed by our team before you can sign in. You&apos;ll see your status right after signing up, and set up your profile
            once approved.
          </div>
        ) : null}

        <SubmitButton className="w-full" size="lg" pendingText={manualReview ? "Submitting…" : "Creating your account…"}>
          Create account &amp; continue
        </SubmitButton>
        <p className="text-center text-xs text-muted-foreground">
          By continuing you agree to our{" "}
          <Link href="/terms" className="underline underline-offset-4">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline underline-offset-4">
            Privacy policy
          </Link>
          .
        </p>
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/auth/login" className="font-medium text-primary underline-offset-4 hover:underline">
            Log in
          </Link>
        </p>
      </form>
    </div>
  );
}
