"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckIcon, Loader2Icon, PauseIcon, XIcon } from "lucide-react";
import { reviewAffiliateProgramAction } from "@/app/actions/affiliate";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

/**
 * Admin review. Approving asks the reviewer to confirm what they checked; only a
 * confirmed check sets the listing's "Verified by Refnivo" mark.
 */
export function AffiliateReviewActions({
  id,
  status,
  signupUrl,
  programUrl,
  curated = false,
}: {
  id: string;
  status: string;
  signupUrl: string;
  programUrl: string | null;
  /** Listed by Refnivo for a brand with no account: the checks are about the programme itself. */
  curated?: boolean;
}) {
  const router = useRouter();
  const [dialog, setDialog] = React.useState<"APPROVE" | "REJECT" | null>(null);
  const [note, setNote] = React.useState("");
  const [checks, setChecks] = React.useState({ brand: false, signup: false, program: false, terms: false });
  const [pending, setPending] = React.useState(false);
  const verified = checks.brand && checks.signup && checks.terms && (checks.program || !programUrl);

  async function decide(decision: "APPROVE" | "REJECT" | "PAUSE") {
    setPending(true);
    try {
      const res = await reviewAffiliateProgramAction({ id, decision, note: note || undefined, verified: decision === "APPROVE" ? verified : undefined });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(decision === "APPROVE" ? (verified ? "Published and marked verified." : "Published (not verified).") : decision === "REJECT" ? "Sent back to the brand." : "Paused.");
      setDialog(null);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  const check = (key: keyof typeof checks, label: React.ReactNode) => (
    <label className="flex items-start gap-2 text-sm">
      <input type="checkbox" className="mt-0.5 size-4 accent-primary" checked={checks[key]} onChange={(e) => setChecks((c) => ({ ...c, [key]: e.target.checked }))} />
      <span>{label}</span>
    </label>
  );

  return (
    <div className="flex flex-wrap justify-end gap-2">
      {status === "PENDING_REVIEW" ? (
        <>
          <Button size="sm" onClick={() => setDialog("APPROVE")}>
            <CheckIcon className="size-4" aria-hidden /> Approve
          </Button>
          <Button size="sm" variant="outline" onClick={() => setDialog("REJECT")}>
            <XIcon className="size-4" aria-hidden /> Reject
          </Button>
        </>
      ) : null}
      {status === "APPROVED" ? (
        <Button size="sm" variant="outline" onClick={() => decide("PAUSE")} disabled={pending}>
          <PauseIcon className="size-4" aria-hidden /> Pause
        </Button>
      ) : null}

      <Dialog open={dialog === "APPROVE"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publish this programme?</DialogTitle>
            <DialogDescription>Tick only what you actually checked. All four set the “Verified by Refnivo” mark; otherwise it is published unverified.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {check("brand", curated ? "This is the brand's real programme, run by the brand or its authorised affiliate network" : "The brand is legitimate and matches the account")}
            {check(
              "signup",
              <>
                The{" "}
                <a href={signupUrl} target="_blank" rel="noreferrer noopener" className="text-primary underline">
                  signup URL
                </a>{" "}
                works and belongs to this programme
              </>,
            )}
            {programUrl
              ? check(
                  "program",
                  <>
                    The{" "}
                    <a href={programUrl} target="_blank" rel="noreferrer noopener" className="text-primary underline">
                      programme page
                    </a>{" "}
                    exists
                  </>,
                )
              : null}
            {check("terms", curated ? "Every stated term appears on the programme's public page (nothing guessed)" : "The commission description is not misleading")}
          </div>
          <Textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={curated ? "Internal note (optional)" : "Note to the brand (optional)"}
            aria-label={curated ? "Internal note" : "Note to the brand"}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialog(null)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={() => decide("APPROVE")} disabled={pending}>
              {pending ? <Loader2Icon className="animate-spin" aria-hidden /> : <CheckIcon className="size-4" aria-hidden />} {verified ? "Publish as verified" : "Publish unverified"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "REJECT"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send back to the brand?</DialogTitle>
            <DialogDescription>The brand sees your note and can fix the listing and resubmit.</DialogDescription>
          </DialogHeader>
          <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. The signup URL returns a 404" aria-label="What needs fixing" />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialog(null)} disabled={pending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => decide("REJECT")} disabled={pending || note.trim().length < 3}>
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
