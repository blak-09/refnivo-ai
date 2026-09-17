"use client";

import { UserMinusIcon } from "lucide-react";
import { removePartnerAction } from "@/app/actions/partners";
import { ConfirmAction } from "@/components/shared/confirm-action";

/** Brand removes an approved partner from a campaign; their referral link is disabled. */
export function RemovePartner({ applicationId }: { applicationId: string }) {
  return (
    <ConfirmAction
      label={
        <>
          <UserMinusIcon /> Remove
        </>
      }
      variant="outline"
      title="Remove this partner from the campaign?"
      description="Their referral link for this campaign stops working immediately. Orders already verified and their commissions are not affected."
      input={{ label: "Reason (optional, shared with the partner)", placeholder: "e.g. campaign fully booked" }}
      confirmLabel="Remove partner"
      successMessage="Partner removed and link disabled."
      run={(reason) => removePartnerAction({ applicationId, reason })}
    />
  );
}
