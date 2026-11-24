"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArchiveIcon, CheckIcon, CrownIcon, Loader2Icon, LockIcon, PencilIcon, RotateCcwIcon, SendIcon, WalletIcon, XIcon } from "lucide-react";
import {
  briefStatusAction,
  cancelUgcCollaborationAction,
  decideUgcApplicationAction,
  markUgcPaidAction,
  reviewUgcSubmissionAction,
} from "@/app/actions/ugc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FormError } from "@/components/forms/field";
import type { ActionResult } from "@/lib/utils/action-result";
import { useActionForm } from "./use-action-form";

type BriefAction = "PUBLISH" | "CLOSE" | "REOPEN" | "ARCHIVE";

const BRIEF_META: Record<BriefAction, { label: string; icon: React.ElementType; variant: "default" | "outline"; success: string }> = {
  PUBLISH: { label: "Publish brief", icon: SendIcon, variant: "default", success: "Brief published. Creators can now apply." },
  CLOSE: { label: "Stop applications", icon: LockIcon, variant: "outline", success: "Applications closed." },
  REOPEN: { label: "Reopen", icon: RotateCcwIcon, variant: "outline", success: "Brief reopened." },
  ARCHIVE: { label: "Archive", icon: ArchiveIcon, variant: "outline", success: "Brief archived." },
};

/** Run a server action, toast the result and refresh the page data. */
function useRun() {
  const router = useRouter();
  const [pending, setPending] = React.useState<string | null>(null);
  const run = React.useCallback(
    async (key: string, fn: () => Promise<ActionResult>, success: string) => {
      setPending(key);
      try {
        const res = await fn();
        if (!res.ok) {
          toast.error(res.error);
          return false;
        }
        toast.success(success);
        router.refresh();
        return true;
      } finally {
        setPending(null);
      }
    },
    [router],
  );
  return { pending, run };
}

export function BriefStatusActions({ briefId, actions, editable, planRequired }: { briefId: string; actions: BriefAction[]; editable: boolean; planRequired: boolean }) {
  const { pending, run } = useRun();
  return (
    <div className="flex flex-wrap items-center gap-2">
      {editable ? (
        <Button variant="outline" nativeButton={false} render={<Link href={`/dashboard/brand/ugc/${briefId}/edit`} />}>
          <PencilIcon /> Edit
        </Button>
      ) : null}
      {actions.map((a) => {
        const m = BRIEF_META[a];
        if ((a === "PUBLISH" || a === "REOPEN") && planRequired) {
          return (
            <Button key={a} className="bg-gradient-brand text-white hover:opacity-95" nativeButton={false} render={<Link href="/dashboard/brand/billing" />}>
              <CrownIcon /> Choose a plan to publish
            </Button>
          );
        }
        return (
          <Button key={a} variant={m.variant} disabled={pending !== null} onClick={() => run(a, () => briefStatusAction({ briefId, action: a }), m.success)}>
            {pending === a ? <Loader2Icon className="animate-spin" /> : <m.icon />} {m.label}
          </Button>
        );
      })}
    </div>
  );
}

/** A small dialog that collects an optional note, then runs `onConfirm(note)`. */
function NoteDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  pending: boolean;
  onConfirm: (note: string) => void;
}) {
  const [note, setNote] = React.useState("");
  const id = React.useId();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <Field label="Message to the creator (optional)" htmlFor={id}>
          <Textarea id={id} rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Back
          </Button>
          <Button variant={destructive ? "destructive" : "default"} disabled={pending} onClick={() => onConfirm(note)}>
            {pending ? <Loader2Icon className="animate-spin" /> : null} {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ApplicantActions({ collabId, slotsLeft }: { collabId: string; slotsLeft: number }) {
  const { pending, run } = useRun();
  const [declining, setDeclining] = React.useState(false);
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        size="sm"
        disabled={pending !== null || slotsLeft <= 0}
        title={slotsLeft <= 0 ? "All creator slots are filled" : undefined}
        onClick={() => run("accept", () => decideUgcApplicationAction({ collabId, decision: "ACCEPT" }), "Creator accepted. They have been notified.")}
      >
        {pending === "accept" ? <Loader2Icon className="animate-spin" /> : <CheckIcon />} Accept
      </Button>
      <Button size="sm" variant="outline" disabled={pending !== null} onClick={() => setDeclining(true)}>
        <XIcon /> Decline
      </Button>
      <NoteDialog
        open={declining}
        onOpenChange={setDeclining}
        title="Decline this application?"
        description="The creator is told they were not selected."
        confirmLabel="Decline"
        destructive
        pending={pending === "decline"}
        onConfirm={async (note) => {
          if (await run("decline", () => decideUgcApplicationAction({ collabId, decision: "DECLINE", note }), "Application declined.")) setDeclining(false);
        }}
      />
    </div>
  );
}

export function CancelCollaboration({ collabId }: { collabId: string }) {
  const { pending, run } = useRun();
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setOpen(true)}>
        Cancel collaboration
      </Button>
      <NoteDialog
        open={open}
        onOpenChange={setOpen}
        title="Cancel this collaboration?"
        description="Only possible before the creator delivers content. The creator is notified and no fee is owed."
        confirmLabel="Cancel collaboration"
        destructive
        pending={pending === "cancel"}
        onConfirm={async (note) => {
          if (await run("cancel", () => cancelUgcCollaborationAction({ collabId, note }), "Collaboration cancelled.")) setOpen(false);
        }}
      />
    </>
  );
}

export function ReviewForm({ collabId, finalRound }: { collabId: string; finalRound: boolean }) {
  const router = useRouter();
  const { state, pending, onSubmit, errors, error } = useActionForm(reviewUgcSubmissionAction);
  React.useEffect(() => {
    if (state?.ok) {
      toast.success("Review sent to the creator.");
      router.refresh();
    }
  }, [state, router]);
  const id = React.useId();
  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-xl border bg-muted/30 p-3" noValidate>
      <input type="hidden" name="collabId" value={collabId} />
      <FormError message={error} />
      <Field label="Feedback" htmlFor={id} error={errors.feedback} hint={finalRound ? "Final round: approve the content, or contact the creator." : "Required when you request changes."}>
        <Textarea id={id} name="feedback" rows={3} maxLength={1500} aria-invalid={!!errors.feedback} />
      </Field>
      <div className="flex flex-wrap justify-end gap-2">
        {!finalRound ? (
          <Button type="submit" name="decision" value="REVISION_REQUESTED" variant="outline" disabled={pending}>
            <RotateCcwIcon /> Request changes
          </Button>
        ) : null}
        <Button type="submit" name="decision" value="APPROVED" disabled={pending}>
          {pending ? <Loader2Icon className="animate-spin" /> : <CheckIcon />} Approve content
        </Button>
      </div>
    </form>
  );
}

export function MarkPaidForm({ collabId, amountLabel }: { collabId: string; amountLabel: string }) {
  const router = useRouter();
  const { state, pending, onSubmit, error } = useActionForm(markUgcPaidAction);
  React.useEffect(() => {
    if (state?.ok) {
      toast.success("Marked as paid. The creator has been asked to confirm.");
      router.refresh();
    }
  }, [state, router]);
  const id = React.useId();
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2 rounded-xl border bg-muted/30 p-3 sm:flex-row sm:items-end" noValidate>
      <input type="hidden" name="collabId" value={collabId} />
      <div className="flex-1">
        <FormError message={error} />
        <Field label={`Paid ${amountLabel} to the creator? Reference (optional)`} htmlFor={id} hint="UPI / bank reference, so both sides can match the payment.">
          <Input id={id} name="reference" maxLength={100} placeholder="e.g. UPI 4521 8890" />
        </Field>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? <Loader2Icon className="animate-spin" /> : <WalletIcon />} Mark as paid
      </Button>
    </form>
  );
}
