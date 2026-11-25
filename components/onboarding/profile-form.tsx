"use client";

import * as React from "react";
import { useActionState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, Loader2Icon, SaveIcon } from "lucide-react";
import { saveOnboardingProfileAction, saveProfileAction, type ProfileActionState } from "@/app/actions/onboarding";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/forms/field";
import { BrandFields } from "@/components/onboarding/brand-fields";
import { CreatorFields } from "@/components/onboarding/creator-fields";
import { CustomerFields } from "@/components/onboarding/customer-fields";
import type { Values } from "@/components/onboarding/form-kit";
import { GET_STARTED_PATH, withNext } from "@/lib/onboarding/paths";
import type { RegistrableRole } from "@/lib/validation/auth";

const timeOf = (iso?: string | null) => (iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null);

/**
 * The role-specific profile form, in two modes:
 *  - onboarding: Back · Save progress (draft, survives refresh) · Continue (validate → review)
 *  - edit:       Save changes (Settings → Edit profile)
 * Submitted with the submitter button so the server knows the intent; the form
 * is never reset after a save, so what was typed stays on screen.
 */
export function ProfileForm({
  role,
  mode,
  values,
  uploadsEnabled,
  email,
  next,
  photoRequired = false,
  savedAt,
}: {
  role: RegistrableRole;
  mode: "onboarding" | "edit";
  values: Values;
  uploadsEnabled: boolean;
  email: string;
  next?: string | null;
  photoRequired?: boolean;
  savedAt?: string | null;
}) {
  const [state, dispatch, pending] = useActionState<ProfileActionState | null, FormData>(mode === "onboarding" ? saveOnboardingProfileAction : saveProfileAction, null);
  const [intent, setIntent] = React.useState<"save" | "continue" | null>(null);
  const [lastSaved, setLastSaved] = React.useState<string | null>(savedAt ?? null);
  const [seen, setSeen] = React.useState(state);
  // Derived during render (not in an effect): remember the latest successful save time.
  if (state !== seen) {
    setSeen(state);
    if (state?.ok && state.savedAt) setLastSaved(state.savedAt);
  }
  const formRef = React.useRef<HTMLFormElement>(null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};

  React.useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success(state.message);
      return;
    }
    // Move focus to the first invalid field so keyboard and screen-reader users land on it.
    const first = formRef.current?.querySelector<HTMLElement>("[aria-invalid='true']");
    first?.focus();
    first?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [state]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const fd = new FormData(e.currentTarget, submitter);
    setIntent(submitter?.value === "save" ? "save" : "continue");
    React.startTransition(() => dispatch(fd));
  }

  const fields =
    role === "BRAND_OWNER" ? (
      <BrandFields values={values} errors={errors} uploadsEnabled={uploadsEnabled} mode={mode} />
    ) : role === "CREATOR" ? (
      <CreatorFields values={values} errors={errors} uploadsEnabled={uploadsEnabled} mode={mode} photoRequired={photoRequired} />
    ) : (
      <CustomerFields values={values} errors={errors} uploadsEnabled={uploadsEnabled} email={email} mode={mode} />
    );

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-5" noValidate aria-busy={pending}>
      <FormError message={state && !state.ok ? state.error : null} />
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {fields}

      <p className="text-xs text-muted-foreground">
        Fields marked <span className="text-destructive">*</span> are required. Everything else is optional and can be added later.
      </p>

      <div className="sticky bottom-0 z-10 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur supports-backdrop-filter:bg-background/80 sm:static sm:mx-0 sm:rounded-2xl sm:border sm:px-5">
        {mode === "onboarding" ? (
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="ghost" nativeButton={false} render={<Link href={withNext(GET_STARTED_PATH, next)} />}>
              <ArrowLeftIcon aria-hidden /> Back
            </Button>
            <span className="order-first w-full text-xs text-muted-foreground empty:hidden sm:order-none sm:w-auto sm:flex-1" aria-live="polite">
              {lastSaved ? (
                <>
                  <CheckIcon className="mr-1 inline size-3.5 text-success" aria-hidden />
                  Progress saved at {timeOf(lastSaved)}
                </>
              ) : null}
            </span>
            <div className="ml-auto flex gap-2">
              <Button type="submit" name="intent" value="save" variant="outline" disabled={pending}>
                {pending && intent === "save" ? <Loader2Icon className="animate-spin" aria-hidden /> : <SaveIcon aria-hidden />}
                <span className="hidden sm:inline">Save progress</span>
                <span className="sm:hidden">Save</span>
              </Button>
              <Button type="submit" name="intent" value="continue" className="bg-gradient-brand text-white hover:opacity-95" disabled={pending}>
                {pending && intent === "continue" ? <Loader2Icon className="animate-spin" aria-hidden /> : null}
                Continue
                <ArrowRightIcon aria-hidden />
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex justify-end">
            <Button type="submit" name="intent" value="continue" disabled={pending}>
              {pending ? <Loader2Icon className="animate-spin" aria-hidden /> : null}
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        )}
      </div>
    </form>
  );
}
