"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";
import { CheckCircle2Icon, ExternalLinkIcon, LinkIcon } from "lucide-react";
import { saveAffiliateLinkAction } from "@/app/actions/affiliate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormError } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { useFormAttempt } from "@/components/forms/use-form-attempt";

type Viewer = "anonymous" | "creator" | "other" | "creator-without-profile";

/**
 * The creator side of joining an EXTERNAL programme.
 *
 *  1. "Join affiliate program" opens the programme's official signup page (the brand's site or its affiliate network) in a new
 *     tab — approval happens there, not on Refnivo.
 *  2. Back here, the creator says whether they joined. If so, they paste the
 *     affiliate link the network gave them and Refnivo issues a tracking link.
 *
 * Nothing here implies Refnivo approved anyone.
 */
export function AffiliateJoinPanel({
  programId,
  programName,
  brandName,
  signupUrl,
  viewer,
  savedCode,
}: {
  programId: string;
  programName: string;
  brandName: string;
  signupUrl: string;
  viewer: Viewer;
  savedCode: string | null;
}) {
  const [step, setStep] = React.useState<"start" | "asked" | "form">("start");
  const [state, action] = useActionState(saveAffiliateLinkAction, null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const values = state && !state.ok ? (state.values ?? {}) : {};
  const attempt = useFormAttempt(state);

  if (state?.ok || savedCode) {
    return (
      <div className="space-y-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm">
        <p className="inline-flex items-center gap-2 font-medium">
          <CheckCircle2Icon className="size-4 text-emerald-600" aria-hidden /> Your affiliate link is saved
        </p>
        <p className="text-muted-foreground">
          Share your Refnivo link instead of the raw affiliate URL — it counts your clicks, then forwards to your affiliate link. You can add a separate link for
          each platform.
        </p>
        <Button size="sm" nativeButton={false} render={<Link href="/dashboard/creator/affiliate-links" />}>
          <LinkIcon className="size-4" aria-hidden /> Manage my affiliate links
        </Button>
      </div>
    );
  }

  const joinButton = (
    <Button
      className="w-full justify-center"
      nativeButton={false}
      render={<a href={signupUrl} target="_blank" rel="noreferrer noopener" aria-label={`Join ${programName} on the programme's official signup page (opens in a new tab)`} />}
      onClick={() => setStep("asked")}
    >
      Visit Official Program <ExternalLinkIcon className="size-4" aria-hidden />
    </Button>
  );

  if (viewer !== "creator") {
    return (
      <div className="space-y-3">
        {joinButton}
        <p className="text-xs text-muted-foreground">
          {viewer === "anonymous" ? (
            <>
              <Link href="/auth/register?role=CREATOR" className="font-medium text-primary hover:underline">
                Create a creator account
              </Link>{" "}
              to save your affiliate link and track your clicks on Refnivo.
            </>
          ) : viewer === "creator-without-profile" ? (
            <>
              <Link href="/auth/onboarding" className="font-medium text-primary hover:underline">
                Finish your creator profile
              </Link>{" "}
              to save your affiliate link here.
            </>
          ) : (
            "Only creator accounts can save affiliate links on Refnivo."
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {step === "start" ? (
        <>
          {joinButton}
          <button type="button" className="w-full text-center text-xs font-medium text-primary hover:underline" onClick={() => setStep("form")}>
            Already a member? Add your affiliate link
          </button>
        </>
      ) : null}

      {step === "asked" ? (
        <div className="space-y-3 rounded-xl border p-4">
          <p className="text-sm font-medium">Have you joined this affiliate program?</p>
          <p className="text-xs text-muted-foreground">Approval can take a while on some networks — come back once you have your affiliate link.</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button size="sm" onClick={() => setStep("form")}>
              Yes, add my affiliate link
            </Button>
            <Button size="sm" variant="outline" onClick={() => setStep("start")}>
              Not yet
            </Button>
          </div>
        </div>
      ) : null}

      {step === "form" ? (
        <form key={attempt} action={action} className="space-y-3 rounded-xl border p-4" noValidate>
          <input type="hidden" name="programId" value={programId} />
          <div>
            <p className="text-sm font-medium">Add your affiliate link</p>
            <p className="text-xs text-muted-foreground">
              {brandName} · {programName}
            </p>
          </div>
          <FormError message={state && !state.ok ? state.error : null} />
          <Field label="Your affiliate link" htmlFor="aff-url" error={errors.targetUrl} required hint="The link the affiliate programme gave you — not a Refnivo link.">
            <Input id="aff-url" name="targetUrl" type="url" inputMode="url" defaultValue={values.targetUrl} placeholder="https://…" required aria-invalid={!!errors.targetUrl} />
          </Field>
          <Field label="Your affiliate ID (optional)" htmlFor="aff-id" error={errors.externalAffiliateId} hint="Helps match imported sales later, if the network supports it.">
            <Input id="aff-id" name="externalAffiliateId" defaultValue={values.externalAffiliateId} />
          </Field>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={() => setStep("start")}>
              Cancel
            </Button>
            <SubmitButton size="sm" pendingText="Saving…">
              Save affiliate link
            </SubmitButton>
          </div>
        </form>
      ) : null}
    </div>
  );
}
