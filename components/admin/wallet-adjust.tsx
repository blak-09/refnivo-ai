"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2Icon, MinusIcon, PlusIcon } from "lucide-react";
import { adminAdjustWalletAction } from "@/app/actions/wallet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMoney } from "@/lib/money";

/** Admin credit/debit with a reason. One request key per form view, so a double click applies once. */
export function WalletAdjustForm({ brandId, brandName }: { brandId: string; brandName: string }) {
  const router = useRouter();
  const [requestKey, setRequestKey] = React.useState(() => crypto.randomUUID());
  const [rupees, setRupees] = React.useState("");
  const [note, setNote] = React.useState("");
  const [pending, setPending] = React.useState(false);

  async function submit(sign: 1 | -1) {
    const amount = Number(rupees) * 100 * sign;
    if (!Number.isInteger(amount) || amount === 0) return toast.error("Enter a whole rupee amount.");
    if (note.trim().length < 3) return toast.error("Give a reason (shown to the brand).");
    if (!window.confirm(`${sign > 0 ? "Credit" : "Debit"} ${formatMoney(Math.abs(amount))} ${sign > 0 ? "to" : "from"} ${brandName}'s wallet?`)) return;
    setPending(true);
    try {
      const res = await adminAdjustWalletAction({ brandId, amountMinor: amount, note, requestKey });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Balance is now ${formatMoney(res.data.balance)}.`);
      setRupees("");
      setNote("");
      setRequestKey(crypto.randomUUID());
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        aria-label={`Amount in rupees for ${brandName}`}
        inputMode="numeric"
        placeholder="₹"
        value={rupees}
        onChange={(e) => setRupees(e.target.value.replace(/[^\d]/g, "").slice(0, 8))}
        className="h-8 w-24 tabular-nums"
      />
      <Input aria-label={`Reason for ${brandName}`} placeholder="Reason, e.g. NEFT UTR 1234" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} className="h-8 w-56" />
      <Button size="sm" variant="outline" disabled={pending} onClick={() => submit(1)}>
        {pending ? <Loader2Icon className="animate-spin" /> : <PlusIcon />}
        Credit
      </Button>
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => submit(-1)}>
        <MinusIcon />
        Debit
      </Button>
    </div>
  );
}
