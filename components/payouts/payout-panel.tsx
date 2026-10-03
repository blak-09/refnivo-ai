"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2Icon, SendIcon } from "lucide-react";
import { requestPayoutAction } from "@/app/actions/payouts";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";

const METHODS = ["UPI", "Bank transfer", "Brand voucher"] as const;
type Method = (typeof METHODS)[number];

/**
 * "Request settlement" control. Only enabled when the server says the balance
 * is eligible; the request itself is reviewed by the Refnivo AI team — nothing
 * is marked paid here. With saved payout accounts the partner picks where the
 * money goes; otherwise they pick a method and the team follows up.
 */
export function PayoutRequestButton({
  kind,
  canRequest,
  reason,
  accounts = [],
}: {
  kind: "COMMISSION" | "REWARD";
  canRequest: boolean;
  reason?: string | null;
  accounts?: { id: string; type: "UPI" | "BANK"; maskedLabel: string; isDefault: boolean }[];
}) {
  const router = useRouter();
  const initial = accounts.find((a) => a.isDefault) ?? accounts[0];
  const [choice, setChoice] = React.useState<string>(initial ? `account:${initial.id}` : "UPI");
  const [pending, setPending] = React.useState(false);

  async function submit() {
    setPending(true);
    try {
      const account = choice.startsWith("account:") ? accounts.find((a) => `account:${a.id}` === choice) : undefined;
      const method: Method = account ? (account.type === "UPI" ? "UPI" : "Bank transfer") : (choice as Method);
      const res = await requestPayoutAction({ kind, method, ...(account ? { payoutAccountId: account.id } : {}) });
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
        Pay to
      </label>
      <NativeSelect id="payout-method" value={choice} onChange={(e) => setChoice(e.target.value)} disabled={!canRequest || pending} className={accounts.length ? "sm:w-64" : "sm:w-44"}>
        {accounts.length ? (
          <>
            {accounts.map((a) => (
              <option key={a.id} value={`account:${a.id}`}>
                {a.type === "UPI" ? "UPI" : "Bank"} · {a.maskedLabel}
              </option>
            ))}
            <option value="Brand voucher">Brand voucher</option>
          </>
        ) : (
          METHODS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))
        )}
      </NativeSelect>
      <Button onClick={submit} disabled={!canRequest || pending}>
        {pending ? <Loader2Icon className="animate-spin" /> : <SendIcon />}
        {kind === "COMMISSION" ? "Request payout" : "Request redemption"}
      </Button>
      {!canRequest && reason ? <p className="text-xs text-muted-foreground">{reason}</p> : null}
    </div>
  );
}
