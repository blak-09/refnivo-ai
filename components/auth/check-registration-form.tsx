"use client";

import * as React from "react";
import { useActionState } from "react";
import { checkRegistrationAction } from "@/app/actions/registrations";
import { Input } from "@/components/ui/input";
import { Field, FormError } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { RegistrationStatusCard } from "@/components/auth/registration-status-card";

export function CheckRegistrationForm() {
  const [state, action] = useActionState(checkRegistrationAction, null);
  const values = state && !state.ok ? state.values ?? {} : {};

  if (state?.ok && state.data.registration) {
    const reg = state.data.registration;
    return (
      <RegistrationStatusCard
        name={reg.name}
        role={reg.role}
        status={reg.status}
        registrationId={reg.registrationId}
        createdAt={new Date(reg.createdAt)}
        rejectionReason={reg.rejectionReason}
        showEmail={state.data.lookedUpBy === "email"}
        email={reg.email}
      />
    );
  }

  return (
    <form action={action} className="space-y-4" noValidate>
      <FormError message={state && !state.ok ? state.error : null} />
      <Field label="Registration ID" htmlFor="registrationId" hint="Starts with REF- (from your confirmation screen).">
        <Input id="registrationId" name="registrationId" defaultValue={values.registrationId} placeholder="REF-XXXXXXXX" autoComplete="off" />
      </Field>
      <div className="relative flex items-center justify-center">
        <span className="h-px flex-1 bg-border" />
        <span className="px-3 text-xs text-muted-foreground">or</span>
        <span className="h-px flex-1 bg-border" />
      </div>
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" defaultValue={values.email} placeholder="you@example.com" autoComplete="email" />
      </Field>
      <SubmitButton className="w-full" pendingText="Checking…">
        Check status
      </SubmitButton>
    </form>
  );
}
