"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2Icon, PlusIcon, Trash2Icon } from "lucide-react";
import { addPartnerNoteAction, deletePartnerNoteAction } from "@/app/actions/partnerships";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormError } from "@/components/forms/field";
import { useActionForm } from "@/components/ugc/use-action-form";

/** Add a private note about a partner. Notes are visible to the brand only. */
export function PartnerNoteForm({ creatorId }: { creatorId: string }) {
  const router = useRouter();
  const formRef = React.useRef<HTMLFormElement>(null);
  const { state, pending, onSubmit, errors, error } = useActionForm(addPartnerNoteAction);
  React.useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      toast.success("Note saved.");
      router.refresh();
    }
  }, [state, router]);
  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-2" noValidate>
      <input type="hidden" name="creatorId" value={creatorId} />
      <FormError message={error} />
      <Field label="Add a note" htmlFor="partner-note" error={errors.body} hint="Only your team sees notes. The creator never does.">
        <Textarea id="partner-note" name="body" rows={3} maxLength={2000} placeholder="e.g. Replies fast, great with tech products, prefers UPI." aria-invalid={!!errors.body} />
      </Field>
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? <Loader2Icon className="animate-spin" /> : <PlusIcon />} Save note
        </Button>
      </div>
    </form>
  );
}

export function DeletePartnerNote({ noteId, creatorId }: { noteId: string; creatorId: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  return (
    <Button
      size="icon-sm"
      variant="ghost"
      aria-label="Delete note"
      disabled={pending}
      onClick={async () => {
        if (!window.confirm("Delete this note?")) return;
        setPending(true);
        const res = await deletePartnerNoteAction(noteId, creatorId);
        setPending(false);
        if (!res.ok) return void toast.error(res.error);
        toast.success("Note deleted.");
        router.refresh();
      }}
    >
      {pending ? <Loader2Icon className="animate-spin" /> : <Trash2Icon />}
    </Button>
  );
}
