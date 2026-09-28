"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2Icon, RotateCcwIcon } from "lucide-react";
import { refundPaymentAction } from "@/app/actions/payments";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney } from "@/lib/money";

/**
 * Admin refund. Rendered only when a provider is configured, so this is never a
 * button that cannot do anything. The outcome shown is the provider's: a refund
 * that is merely accepted stays "processing" and the payment stays PAID until
 * the provider confirms it.
 */
export function RefundAction({ transactionId, reference, remaining }: { transactionId: string; reference: string; remaining: number }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [amount, setAmount] = React.useState("");

  async function submit() {
    setPending(true);
    try {
      const rupees = amount.trim() ? Number(amount) : null;
      if (rupees !== null && (!Number.isFinite(rupees) || rupees <= 0)) {
        toast.error("Enter a valid amount.");
        return;
      }
      const res = await refundPaymentAction({ transactionId, ...(rupees === null ? {} : { amountMinor: Math.round(rupees * 100) }) });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        res.data.state === "done" ? `Refund confirmed for ${reference}.` : `Refund accepted (${res.data.state}) — the payment stays paid until the provider confirms.`,
      );
      setOpen(false);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <RotateCcwIcon className="size-3.5" aria-hidden /> Refund
      </Button>
      <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refund {reference}?</DialogTitle>
            <DialogDescription>
              Up to {formatMoney(remaining)} can be refunded. Leave the amount empty for a full refund. The transaction changes only once the provider confirms.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="refund-amount">Amount (₹, optional)</Label>
            <Input
              id="refund-amount"
              type="number"
              inputMode="decimal"
              min={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={String(Math.round(remaining / 100))}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={submit} disabled={pending}>
              {pending ? <Loader2Icon className="animate-spin" aria-hidden /> : <RotateCcwIcon className="size-4" aria-hidden />} Refund
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
