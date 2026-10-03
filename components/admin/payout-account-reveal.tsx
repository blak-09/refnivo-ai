"use client";

import * as React from "react";
import { toast } from "sonner";
import { CopyIcon, EyeIcon, EyeOffIcon, Loader2Icon } from "lucide-react";
import { revealPayoutAccountAction } from "@/app/actions/payout-accounts";
import { Button } from "@/components/ui/button";

type Details = { type: string; holderName: string; vpa?: string; accountNumber?: string; ifsc?: string };

/** Admin: show the full UPI ID / bank details to pay by hand. Each reveal is audited server-side. */
export function PayoutAccountReveal({ accountId }: { accountId: string }) {
  const [details, setDetails] = React.useState<Details | null>(null);
  const [pending, setPending] = React.useState(false);

  async function reveal() {
    setPending(true);
    try {
      const res = await revealPayoutAccountAction({ accountId });
      if (!res.ok) toast.error(res.error);
      else setDetails(res.data);
    } finally {
      setPending(false);
    }
  }

  function copy(value: string) {
    void navigator.clipboard?.writeText(value).then(() => toast.success("Copied."));
  }

  if (!details) {
    return (
      <Button size="xs" variant="ghost" onClick={reveal} disabled={pending}>
        {pending ? <Loader2Icon className="animate-spin" /> : <EyeIcon />}
        Reveal
      </Button>
    );
  }

  const rows: [string, string][] = details.vpa
    ? [["UPI ID", details.vpa]]
    : [
        ["Account", details.accountNumber ?? ""],
        ["IFSC", details.ifsc ?? ""],
      ];
  return (
    <div className="mt-1 space-y-0.5 rounded-md border bg-muted/40 p-2 text-xs">
      <p className="font-medium">{details.holderName}</p>
      {rows.map(([label, value]) => (
        <p key={label} className="flex items-center gap-1">
          <span className="text-muted-foreground">{label}:</span>
          <span className="font-mono">{value}</span>
          <button type="button" onClick={() => copy(value)} className="text-muted-foreground hover:text-foreground" aria-label={`Copy ${label}`}>
            <CopyIcon className="size-3" />
          </button>
        </p>
      ))}
      <button type="button" onClick={() => setDetails(null)} className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
        <EyeOffIcon className="size-3" /> Hide
      </button>
    </div>
  );
}
