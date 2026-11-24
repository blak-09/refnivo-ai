"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2Icon, ImagePlusIcon, Loader2Icon, SendIcon, Undo2Icon } from "lucide-react";
import { applyToBriefAction, confirmUgcPaymentAction, submitUgcContentAction, withdrawUgcApplicationAction } from "@/app/actions/ugc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormError } from "@/components/forms/field";
import { ImageUpload } from "@/components/uploads/image-upload";
import { UGC_MAX_IMAGES, UGC_MAX_LINKS } from "@/lib/ugc/options";
import { useActionForm } from "./use-action-form";

function useRefreshOnSuccess(state: { ok: boolean } | null, message: string) {
  const router = useRouter();
  React.useEffect(() => {
    if (state?.ok) {
      toast.success(message);
      router.refresh();
    }
  }, [state, router, message]);
}

export function ApplyForm({ briefId }: { briefId: string }) {
  const { state, pending, onSubmit, errors, error } = useActionForm(applyToBriefAction);
  useRefreshOnSuccess(state, "Application sent. The brand will review it.");
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate aria-busy={pending}>
      <input type="hidden" name="briefId" value={briefId} />
      <FormError message={error} />
      <Field label="Your pitch" htmlFor="pitch" required error={errors.pitch} hint="Why you are a good fit and how you would shoot it. 20–1500 characters.">
        <Textarea id="pitch" name="pitch" rows={5} maxLength={1500} aria-invalid={!!errors.pitch} />
      </Field>
      <Field label="Portfolio links (optional)" htmlFor="portfolioLinks" error={errors.portfolioLinks} hint={`One link per line, up to ${UGC_MAX_LINKS}: past reels, videos or a drive folder.`}>
        <Textarea id="portfolioLinks" name="portfolioLinks" rows={3} placeholder="https://instagram.com/reel/…" aria-invalid={!!errors.portfolioLinks} />
      </Field>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2Icon className="animate-spin" /> : <SendIcon />} Apply
        </Button>
      </div>
    </form>
  );
}

export function SubmitContentForm({ collabId, uploadsEnabled, revision }: { collabId: string; uploadsEnabled: boolean; revision: boolean }) {
  const { state, pending, onSubmit, errors, error } = useActionForm(submitUgcContentAction);
  useRefreshOnSuccess(state, "Content sent to the brand for review.");
  const [slots, setSlots] = React.useState(1);
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate aria-busy={pending}>
      <input type="hidden" name="collabId" value={collabId} />
      <FormError message={error} />
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Photos</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: slots }, (_, i) => (
            <ImageUpload
              key={i}
              name="imageUrls"
              endpoint="/api/uploads/ugc-image"
              label={`Upload photo ${i + 1}`}
              aspect="aspect-square"
              disabled={!uploadsEnabled}
              disabledText="Photo uploads are not enabled on this deployment yet. Share your content as a link instead."
            />
          ))}
        </div>
        {uploadsEnabled && slots < UGC_MAX_IMAGES ? (
          <Button type="button" size="sm" variant="outline" onClick={() => setSlots((n) => Math.min(UGC_MAX_IMAGES, n + 1))}>
            <ImagePlusIcon /> Add another photo
          </Button>
        ) : null}
        {errors.imageUrls ? <p className="text-xs text-destructive">{errors.imageUrls}</p> : null}
      </fieldset>
      <Field label="Video links" htmlFor="links" error={errors.links} hint={`One link per line, up to ${UGC_MAX_LINKS}: Google Drive, YouTube (unlisted), Dropbox… Make sure the brand can open them.`}>
        <Textarea id="links" name="links" rows={3} placeholder="https://drive.google.com/…" aria-invalid={!!errors.links} />
      </Field>
      <Field label="Note to the brand (optional)" htmlFor="note" error={errors.note} hint={revision ? "Say what you changed." : undefined}>
        <Textarea id="note" name="note" rows={3} maxLength={1500} />
      </Field>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2Icon className="animate-spin" /> : <SendIcon />} {revision ? "Send revision" : "Send for review"}
        </Button>
      </div>
    </form>
  );
}

function useSimpleAction(fn: () => Promise<{ ok: true } | { ok: false; error: string }>, success: string) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const run = async () => {
    setPending(true);
    try {
      const res = await fn();
      if (!res.ok) return void toast.error(res.error);
      toast.success(success);
      router.refresh();
    } finally {
      setPending(false);
    }
  };
  return { pending, run };
}

export function WithdrawApplication({ collabId }: { collabId: string }) {
  const { pending, run } = useSimpleAction(() => withdrawUgcApplicationAction(collabId), "Application withdrawn.");
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (window.confirm("Withdraw your application? You can apply again while the brief is open.")) void run();
      }}
    >
      {pending ? <Loader2Icon className="animate-spin" /> : <Undo2Icon />} Withdraw
    </Button>
  );
}

export function ConfirmPayment({ collabId, amountLabel }: { collabId: string; amountLabel: string }) {
  const { pending, run } = useSimpleAction(() => confirmUgcPaymentAction(collabId), "Thanks! Payment confirmed.");
  return (
    <Button
      size="sm"
      disabled={pending}
      onClick={() => {
        if (window.confirm(`Confirm you received ${amountLabel} from the brand?`)) void run();
      }}
    >
      {pending ? <Loader2Icon className="animate-spin" /> : <CheckCircle2Icon />} I received the payment
    </Button>
  );
}
