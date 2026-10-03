"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BuildingIcon, CheckIcon, Loader2Icon, LockIcon, PlusIcon, SmartphoneIcon, StarIcon, Trash2Icon } from "lucide-react";
import { addPayoutAccountAction, removePayoutAccountAction, setDefaultPayoutAccountAction } from "@/app/actions/payout-accounts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type PayoutAccountView = { id: string; type: "UPI" | "BANK"; holderName: string; maskedLabel: string; isDefault: boolean };

/**
 * Where the partner wants to be paid. Details are sent once, encrypted on the
 * server, and only ever shown back masked (ab•••@okicici, HDFC0001234 · ••••1234).
 */
export function PayoutAccountsManager({ accounts, max }: { accounts: PayoutAccountView[]; max: number }) {
  const router = useRouter();
  const [adding, setAdding] = React.useState(accounts.length === 0);
  const [busy, setBusy] = React.useState<string | null>(null);

  async function run(id: string, fn: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    setBusy(id);
    try {
      const res = await fn();
      if (!res.ok) toast.error(res.error ?? "Something went wrong.");
      else {
        toast.success(success);
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      {accounts.length ? (
        <ul className="divide-y rounded-lg border">
          {accounts.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-3 p-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                {a.type === "UPI" ? <SmartphoneIcon className="size-4" aria-hidden /> : <BuildingIcon className="size-4" aria-hidden />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  <span className="font-mono">{a.maskedLabel}</span>
                  {a.isDefault ? <Badge variant="secondary">Default</Badge> : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  {a.type === "UPI" ? "UPI" : "Bank account"} · {a.holderName}
                </p>
              </div>
              <div className="flex gap-1">
                {!a.isDefault ? (
                  <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => run(a.id, () => setDefaultPayoutAccountAction({ accountId: a.id }), "Default payout account updated.")}>
                    {busy === a.id ? <Loader2Icon className="animate-spin" /> : <StarIcon />}
                    Make default
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  disabled={!!busy}
                  aria-label={`Remove ${a.maskedLabel}`}
                  onClick={() => {
                    if (window.confirm(`Remove ${a.maskedLabel}?`)) void run(a.id, () => removePayoutAccountAction({ accountId: a.id }), "Payout account removed.");
                  }}
                >
                  <Trash2Icon />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {adding ? (
        <AddPayoutAccountForm
          onDone={() => {
            setAdding(false);
            router.refresh();
          }}
          onCancel={accounts.length ? () => setAdding(false) : undefined}
        />
      ) : accounts.length < max ? (
        <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
          <PlusIcon />
          Add UPI ID or bank account
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">You have saved the maximum of {max} accounts.</p>
      )}
    </div>
  );
}

function AddPayoutAccountForm({ onDone, onCancel }: { onDone: () => void; onCancel?: () => void }) {
  const [type, setType] = React.useState<"UPI" | "BANK">("UPI");
  const [pending, setPending] = React.useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const value = (k: string) => String(form.get(k) ?? "");
    setPending(true);
    try {
      const res = await addPayoutAccountAction(
        type === "UPI"
          ? { type, holderName: value("holderName"), vpa: value("vpa") }
          : { type, holderName: value("holderName"), accountNumber: value("accountNumber"), confirmAccountNumber: value("confirmAccountNumber"), ifsc: value("ifsc") },
      );
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Saved ${res.data.label}.`);
      onDone();
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-lg border bg-muted/30 p-4">
      <div role="radiogroup" aria-label="Account type" className="grid grid-cols-2 gap-2 sm:max-w-sm">
        {(["UPI", "BANK"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={type === t}
            onClick={() => setType(t)}
            className={cn(
              "flex items-center justify-center gap-2 rounded-md border bg-background px-3 py-2 text-sm font-medium transition-colors",
              type === t ? "border-primary ring-2 ring-primary/20" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {type === t ? <CheckIcon className="size-4" aria-hidden /> : t === "UPI" ? <SmartphoneIcon className="size-4" aria-hidden /> : <BuildingIcon className="size-4" aria-hidden />}
            {t === "UPI" ? "UPI ID" : "Bank account"}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="pa-holder">Account holder name</Label>
          <Input id="pa-holder" name="holderName" required autoComplete="name" maxLength={120} placeholder="As per bank records" />
        </div>
        {type === "UPI" ? (
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="pa-vpa">UPI ID</Label>
            <Input id="pa-vpa" name="vpa" required autoComplete="off" inputMode="email" placeholder="name@okicici" maxLength={300} />
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="pa-acct">Account number</Label>
              <Input id="pa-acct" name="accountNumber" required autoComplete="off" inputMode="numeric" pattern="\d{9,18}" maxLength={18} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pa-acct2">Confirm account number</Label>
              <Input id="pa-acct2" name="confirmAccountNumber" required autoComplete="off" inputMode="numeric" pattern="\d{9,18}" maxLength={18} onPaste={(e) => e.preventDefault()} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pa-ifsc">IFSC</Label>
              <Input id="pa-ifsc" name="ifsc" required autoComplete="off" placeholder="HDFC0001234" maxLength={11} className="uppercase" />
            </div>
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2Icon className="animate-spin" /> : <LockIcon />}
          Save securely
        </Button>
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
        ) : null}
        <p className="text-xs text-muted-foreground">Encrypted before it is stored. Only the last digits are ever shown again.</p>
      </div>
    </form>
  );
}
