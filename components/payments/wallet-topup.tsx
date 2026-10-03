"use client";

import * as React from "react";
import { CheckoutButton } from "@/components/payments/checkout-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * Amount picker for a wallet top-up. The amount is re-validated on the server
 * (whole rupees, within limits); the wallet is credited only once Razorpay
 * confirms the payment.
 */
export function WalletTopupForm({ presets, minMinor, maxMinor, suggestedMinor, payer }: { presets: number[]; minMinor: number; maxMinor: number; suggestedMinor?: number; payer: { name: string; email: string } }) {
  const initial = suggestedMinor && suggestedMinor >= minMinor && suggestedMinor <= maxMinor ? Math.ceil(suggestedMinor / 100) : presets[1] / 100;
  const [rupees, setRupees] = React.useState<string>(String(initial));
  const amountMinor = /^\d+$/.test(rupees) ? Number(rupees) * 100 : NaN;
  const valid = Number.isInteger(amountMinor) && amountMinor >= minMinor && amountMinor <= maxMinor;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Quick amounts">
        {presets.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setRupees(String(p / 100))}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm font-medium tabular-nums transition-colors",
              amountMinor === p ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {formatMoney(p)}
          </button>
        ))}
      </div>
      <div className="space-y-1.5 sm:max-w-xs">
        <Label htmlFor="topup-amount">Amount (₹)</Label>
        <div className="relative">
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
          <Input
            id="topup-amount"
            inputMode="numeric"
            value={rupees}
            onChange={(e) => setRupees(e.target.value.replace(/[^\d]/g, "").slice(0, 7))}
            className="pl-7 tabular-nums"
            aria-invalid={!valid}
            aria-describedby="topup-hint"
          />
        </div>
        <p id="topup-hint" className={cn("text-xs", valid ? "text-muted-foreground" : "text-destructive")}>
          Between {formatMoney(minMinor)} and {formatMoney(maxMinor)}, whole rupees.
        </p>
      </div>
      <CheckoutButton
        topupAmountMinor={valid ? amountMinor : 0}
        disabled={!valid}
        label={valid ? `Add ${formatMoney(amountMinor)}` : "Enter an amount"}
        payer={payer}
        className="w-full justify-center sm:w-auto"
      />
    </div>
  );
}
