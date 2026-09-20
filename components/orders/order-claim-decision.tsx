"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckIcon, Loader2Icon, XIcon } from "lucide-react";
import { orderClaimDecisionAction } from "@/app/actions/order-claims";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Brand decides a customer's order claim. Confirming asks for the order value
 * (from the brand's store) and records + verifies the order in one step.
 */
export function OrderClaimDecision({ claimId, orderReference, partnerLabel, owedLabel }: { claimId: string; orderReference: string; partnerLabel: string; owedLabel: string }) {
  const router = useRouter();
  const [dialog, setDialog] = React.useState<"CONFIRM" | "REJECT" | null>(null);
  const [pending, setPending] = React.useState(false);
  const [amount, setAmount] = React.useState("");
  const [quantity, setQuantity] = React.useState("1");
  const [reason, setReason] = React.useState("");

  async function decide() {
    if (!dialog) return;
    setPending(true);
    try {
      const res = await orderClaimDecisionAction(dialog === "CONFIRM" ? { claimId, decision: "CONFIRM", amount, quantity } : { claimId, decision: "REJECT", reason });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(dialog === "CONFIRM" ? `Order ${orderReference} confirmed — ${owedLabel} released to ${partnerLabel}.` : `Claim for ${orderReference} rejected.`);
      setDialog(null);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex gap-2">
      <Button size="sm" onClick={() => setDialog("CONFIRM")} disabled={pending}>
        <CheckIcon /> Confirm
      </Button>
      <Button size="sm" variant="outline" onClick={() => setDialog("REJECT")} disabled={pending}>
        <XIcon /> Reject
      </Button>

      <Dialog open={dialog === "CONFIRM"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm order {orderReference}</DialogTitle>
            <DialogDescription>
              Enter the order value from your store. The order is recorded and verified in one step, and {owedLabel} is released to {partnerLabel} immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
            <div className="space-y-1.5">
              <Label htmlFor="claim-amount">Order value (₹)</Label>
              <Input id="claim-amount" type="number" inputMode="decimal" min={1} step="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="1999" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="claim-quantity">Quantity</Label>
              <Input id="claim-quantity" type="number" inputMode="numeric" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialog(null)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={decide} disabled={pending || !amount.trim()}>
              {pending ? <Loader2Icon className="animate-spin" /> : <CheckIcon />} Confirm &amp; verify
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "REJECT"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject claim for {orderReference}?</DialogTitle>
            <DialogDescription>Nothing is owed for a rejected claim. If the customer signed in, they see your reason and can re-submit a corrected order number.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="claim-reason">Reason</Label>
            <Input id="claim-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. No order with this number in our store" autoFocus />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialog(null)} disabled={pending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={decide} disabled={pending || reason.trim().length < 3}>
              {pending ? <Loader2Icon className="animate-spin" /> : <XIcon />} Reject claim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
