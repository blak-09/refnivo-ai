"use client";

import { UndoIcon } from "lucide-react";
import { withdrawApplicationAction } from "@/app/actions/creator";
import { ConfirmAction } from "@/components/shared/confirm-action";

/** Creator/customer withdraws their own pending application. */
export function WithdrawApplication({ applicationId }: { applicationId: string }) {
  return (
    <ConfirmAction
      label={
        <>
          <UndoIcon /> Withdraw
        </>
      }
      variant="ghost"
      title="Withdraw this application?"
      description="The brand will no longer see it. You can apply again later while the campaign is active."
      confirmLabel="Withdraw"
      successMessage="Application withdrawn."
      run={() => withdrawApplicationAction({ applicationId })}
    />
  );
}
