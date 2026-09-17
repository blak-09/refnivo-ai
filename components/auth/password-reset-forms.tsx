"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";
import { forgotPasswordAction, resetPasswordAction } from "@/app/actions/password-reset";
import { Input } from "@/components/ui/input";
import { Field, FormError } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { useFormAttempt } from "@/components/forms/use-form-attempt";

export function ForgotPasswordForm({ emailConfigured }: { emailConfigured: boolean }) {
  const [state, action] = useActionState(forgotPasswordAction, null);
  const errors = state && !state.ok ? state.fieldErrors ?? {} : {};
  const values = state && !state.ok ? state.values ?? {} : {};
  const attempt = useFormAttempt(state);

  if (state?.ok) {
    return (
      <div className="space-y-4 text-sm">
        <p className="rounded-lg bg-accent px-3 py-2 text-accent-foreground">
          If an approved account exists for that e-mail, a reset link is on its way. It expires in one hour.
        </p>
        <Link href="/auth/login" className="font-medium text-primary underline-offset-4 hover:underline">
          Back to log in
        </Link>
      </div>
    );
  }

  return (
    <form key={attempt} action={action} className="space-y-4" noValidate>
      {!emailConfigured ? (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
          E-mail delivery is not configured on this deployment, so reset links cannot be sent yet. Please{" "}
          <Link href="/contact" className="font-medium underline underline-offset-4">
            contact support
          </Link>{" "}
          to regain access.
        </p>
      ) : null}
      <FormError message={state && !state.ok ? state.error : null} />
      <Field label="Email" htmlFor="email" error={errors.email} required>
        <Input id="email" name="email" type="email" autoComplete="email" defaultValue={values.email ?? ""} required aria-invalid={!!errors.email} />
      </Field>
      <SubmitButton className="w-full" pendingText="Sending…" disabled={!emailConfigured}>
        Send reset link
      </SubmitButton>
      <p className="text-center text-sm text-muted-foreground">
        <Link href="/auth/login" className="font-medium text-primary underline-offset-4 hover:underline">
          Back to log in
        </Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetPasswordAction, null);
  const errors = state && !state.ok ? state.fieldErrors ?? {} : {};
  const attempt = useFormAttempt(state);

  return (
    <form key={attempt} action={action} className="space-y-4" noValidate>
      <FormError message={state && !state.ok ? state.error : null} />
      <input type="hidden" name="token" value={token} />
      <Field label="New password" htmlFor="password" error={errors.password} hint="At least 8 characters with a letter and a number." required>
        <Input id="password" name="password" type="password" autoComplete="new-password" required aria-invalid={!!errors.password} />
      </Field>
      <Field label="Confirm new password" htmlFor="confirmPassword" error={errors.confirmPassword} required>
        <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required aria-invalid={!!errors.confirmPassword} />
      </Field>
      <SubmitButton className="w-full" pendingText="Saving…">
        Set new password
      </SubmitButton>
    </form>
  );
}
