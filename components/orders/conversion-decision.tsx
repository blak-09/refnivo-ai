"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckIcon, Loader2Icon, XIcon } from "lucide-react";
import { conversionDecisionAction } from "@/app/actions/conversions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export function ConversionDecision({ referralId, owedLabel }: { referralId: string; owedLabel: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState<"VERIFY" | "REJECT" | null>(null);
  const [rejecting, setRejecting] = React.useState(false);
  const [reason, setReason] = React.useState("");

  async function decide(decision: "VERIFY" | "REJECT") {
    setPending(decision);
    try {
      const res = await conversionDecisionAction({ referralId, decision, reason: decision === "REJECT" ? reason : undefined });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(decision === "VERIFY" ? `Order verified — ${owedLabel} approved.` : "Order rejected.");
      setRejecting(false);
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex gap-2">
      <Button size="sm" onClick={() => decide("VERIFY")} disabled={pending !== null}>
        {pending === "VERIFY" ? <Loader2Icon className="animate-spin" /> : <CheckIcon />} Verify
      </Button>
      <Button size="sm" variant="outline" onClick={() => setRejecting(true)} disabled={pending !== null}>
        <XIcon /> Reject
      </Button>
      <Dialog open={rejecting} onOpenChange={setRejecting}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject this order?</DialogTitle>
            <DialogDescription>The pending commission or reward will be cancelled. This is recorded in the audit log.</DialogDescription>
          </DialogHeader>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional) — e.g. order returned" />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejecting(false)} disabled={pending !== null}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => decide("REJECT")} disabled={pending !== null}>
              {pending === "REJECT" ? <Loader2Icon className="animate-spin" /> : null} Reject order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
