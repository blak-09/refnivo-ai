"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2Icon, SendIcon } from "lucide-react";
import { requestPayoutAction } from "@/app/actions/payouts";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";

const METHODS = ["UPI", "Bank transfer", "Brand voucher"] as const;

/**
 * "Request settlement" control. Only enabled when the server says the balance
 * is eligible; the request itself is reviewed and settled manually by the
 * Refnivo AI team — nothing is marked paid here.
 */
export function PayoutRequestButton({ kind, canRequest, reason }: { kind: "COMMISSION" | "REWARD"; canRequest: boolean; reason?: string | null }) {
  const router = useRouter();
  const [method, setMethod] = React.useState<(typeof METHODS)[number]>("UPI");
  const [pending, setPending] = React.useState(false);

  async function submit() {
    setPending(true);
    try {
      const res = await requestPayoutAction({ kind, method });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(kind === "COMMISSION" ? "Payout request submitted for review." : "Redemption request submitted for review.");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <label className="sr-only" htmlFor="payout-method">
        Settlement method
      </label>
      <NativeSelect id="payout-method" value={method} onChange={(e) => setMethod(e.target.value as (typeof METHODS)[number])} disabled={!canRequest || pending} className="sm:w-44">
        {METHODS.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </NativeSelect>
      <Button onClick={submit} disabled={!canRequest || pending}>
        {pending ? <Loader2Icon className="animate-spin" /> : <SendIcon />}
        {kind === "COMMISSION" ? "Request payout" : "Request redemption"}
      </Button>
      {!canRequest && reason ? <p className="text-xs text-muted-foreground">{reason}</p> : null}
    </div>
  );
}
