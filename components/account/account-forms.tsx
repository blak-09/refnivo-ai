"use client";

import * as React from "react";
import { useActionState } from "react";
import { toast } from "sonner";
import { changePasswordAction, updateAccountAction } from "@/app/actions/account";
import { Input } from "@/components/ui/input";
import { Field, FormError } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { useFormAttempt } from "@/components/forms/use-form-attempt";

export function AccountDetailsForm({ user }: { user: { name: string; email: string; phone: string | null } }) {
  const [state, action] = useActionState(updateAccountAction, null);
  const errors = state && !state.ok ? state.fieldErrors ?? {} : {};
  const values = state && !state.ok ? state.values ?? {} : {};
  const attempt = useFormAttempt(state);
  React.useEffect(() => {
    if (state?.ok) toast.success("Account details saved.");
  }, [state]);

  return (
    <form key={attempt} action={action} className="space-y-4" noValidate>
      <FormError message={state && !state.ok ? state.error : null} />
      <Field label="Email" htmlFor="email" hint="Email changes are not supported in this version.">
        <Input id="email" value={user.email} readOnly />
      </Field>
      <Field label="Full name" htmlFor="name" error={errors.name} required>
        <Input id="name" name="name" defaultValue={values.name ?? user.name} required aria-invalid={!!errors.name} />
      </Field>
      <Field label="Phone" htmlFor="phone" error={errors.phone}>
        <Input id="phone" name="phone" type="tel" defaultValue={values.phone ?? user.phone ?? ""} placeholder="+91 98765 43210" aria-invalid={!!errors.phone} />
      </Field>
      <div className="flex justify-end">
        <SubmitButton>Save details</SubmitButton>
      </div>
    </form>
  );
}

export function ChangePasswordForm() {
  const [state, action] = useActionState(changePasswordAction, null);
  const errors = state && !state.ok ? state.fieldErrors ?? {} : {};
  const formRef = React.useRef<HTMLFormElement>(null);
  React.useEffect(() => {
    if (state?.ok) {
      toast.success("Password changed.");
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form ref={formRef} action={action} className="space-y-4" noValidate>
      <FormError message={state && !state.ok ? state.error : null} />
      <Field label="Current password" htmlFor="currentPassword" error={errors.currentPassword} required>
        <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required aria-invalid={!!errors.currentPassword} />
      </Field>
      <Field label="New password" htmlFor="newPassword" error={errors.newPassword} hint="At least 8 characters with a letter and a number." required>
        <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" required aria-invalid={!!errors.newPassword} />
      </Field>
      <Field label="Confirm new password" htmlFor="confirmPassword" error={errors.confirmPassword} required>
        <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required aria-invalid={!!errors.confirmPassword} />
      </Field>
      <div className="flex justify-end">
        <SubmitButton variant="outline">Change password</SubmitButton>
      </div>
    </form>
  );
}
