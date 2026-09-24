"use client";

import * as React from "react";
import { useActionState } from "react";
import { CheckCircle2Icon, SendIcon } from "lucide-react";
import { sendContactMessageAction } from "@/app/actions/contact";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormError } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { useFormAttempt } from "@/components/forms/use-form-attempt";
import { CONTACT_EMAIL, mailto } from "@/lib/config/contact";
import { CONTACT_ROLES, CONTACT_ROLE_LABEL } from "@/lib/validation/contact";

/**
 * Contact form. Submits through the `sendContactMessageAction` server action,
 * which queues the message in the transactional e-mail outbox — the same
 * infrastructure the rest of the app uses. `SubmitButton` reflects the pending
 * state and disables itself, so a message cannot be submitted twice.
 */
export function ContactForm() {
  const [state, action] = useActionState(sendContactMessageAction, null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const values = state && !state.ok ? (state.values ?? {}) : {};
  const attempt = useFormAttempt(state);
  const [sentAgain, setSentAgain] = React.useState(0);

  if (state?.ok) {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 text-center" role="status" aria-live="polite">
        <CheckCircle2Icon className="mx-auto size-8 text-emerald-600" aria-hidden />
        <p className="mt-3 font-semibold">Message sent — thank you</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          It is on its way to our team and we will reply to the address you gave us. If it is urgent, email{" "}
          <a href={mailto()} className="font-medium text-primary underline-offset-4 hover:underline">
            {CONTACT_EMAIL}
          </a>
          .
        </p>
        <Button variant="outline" className="mt-4" onClick={() => setSentAgain((n) => n + 1)} key={sentAgain}>
          Send another message
        </Button>
      </div>
    );
  }

  return (
    <form key={`${attempt}-${sentAgain}`} action={action} className="space-y-4" noValidate aria-describedby="contact-form-note">
      <FormError message={state && !state.ok ? state.error : null} />

      {/* Honeypot: hidden from people, filled by bots. */}
      <div className="hidden" aria-hidden>
        <label htmlFor="contact-company">Company</label>
        <input id="contact-company" name="company" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" htmlFor="contact-name" error={errors.name} required>
          <Input id="contact-name" name="name" defaultValue={values.name} autoComplete="name" placeholder="Your name" required aria-invalid={!!errors.name} />
        </Field>
        <Field label="Email address" htmlFor="contact-email" error={errors.email} required>
          <Input
            id="contact-email"
            name="email"
            type="email"
            defaultValue={values.email}
            autoComplete="email"
            placeholder="you@example.com"
            required
            aria-invalid={!!errors.email}
          />
        </Field>
        <Field label="I am a" htmlFor="contact-role" error={errors.role} required>
          <NativeSelect id="contact-role" name="role" defaultValue={values.role ?? "BRAND"} required aria-invalid={!!errors.role}>
            {CONTACT_ROLES.map((role) => (
              <option key={role} value={role}>
                {CONTACT_ROLE_LABEL[role]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Subject" htmlFor="contact-subject" error={errors.subject} required>
          <Input id="contact-subject" name="subject" defaultValue={values.subject} placeholder="How can we help?" required aria-invalid={!!errors.subject} />
        </Field>
        <Field label="Message" htmlFor="contact-message" error={errors.message} required className="sm:col-span-2">
          <Textarea
            id="contact-message"
            name="message"
            rows={6}
            defaultValue={values.message}
            placeholder="Tell us about your brand, your audience or your question."
            required
            aria-invalid={!!errors.message}
          />
        </Field>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p id="contact-form-note" className="text-xs text-muted-foreground">
          We use your details only to reply to this message.
        </p>
        <SubmitButton pendingText="Sending…" className="w-full sm:w-auto">
          <SendIcon className="size-4" aria-hidden /> Send Message
        </SubmitButton>
      </div>
    </form>
  );
}
