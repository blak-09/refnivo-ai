"use client";

import { ScaleIcon } from "lucide-react";
import { contestConversionAction } from "@/app/actions/conversions";
import { ConfirmAction } from "@/components/shared/confirm-action";

/** Partner asks Refnivo to review a rejected or refunded order (W3). */
export function ContestOrderButton({ referralId, refunded }: { referralId: string; refunded: boolean }) {
  return (
    <ConfirmAction
      label={
        <>
          <ScaleIcon /> Contest
        </>
      }
      size="xs"
      title={refunded ? "Contest this refund?" : "Contest this rejection?"}
      description="Refnivo reviews the order with the brand and can reopen or reinstate it. Explain why you think the decision is wrong; you can contest each order once."
      input={{ label: "What went wrong?", placeholder: "e.g. My follower shared their order confirmation with me; it was delivered on 12 Nov.", required: true }}
      confirmLabel="Send to Refnivo"
      successMessage="Sent. Refnivo will review it and notify you."
      run={(reason) => contestConversionAction({ referralId, reason })}
    />
  );
}
