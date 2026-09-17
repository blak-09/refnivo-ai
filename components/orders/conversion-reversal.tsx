"use client";

import { RotateCcwIcon } from "lucide-react";
import { conversionReversalAction } from "@/app/actions/conversions";
import { ConfirmAction } from "@/components/shared/confirm-action";

/** Brand records a refund for a verified order; approved commissions/rewards are reversed. */
export function ConversionReversal({ referralId }: { referralId: string }) {
  return (
    <ConfirmAction
      label={
        <>
          <RotateCcwIcon /> Refund
        </>
      }
      variant="outline"
      title="Record a refund for this order?"
      description="The approved commission or reward for this order will be reversed and removed from your campaign spend. If it was already paid out, the reversal is recorded against the partner's balance. This cannot be undone."
      input={{ label: "Reason", placeholder: "e.g. order returned, payment failed", required: true }}
      confirmLabel="Record refund"
      successMessage="Refund recorded — ledger entries reversed."
      run={(reason) => conversionReversalAction({ referralId, reason })}
    />
  );
}
