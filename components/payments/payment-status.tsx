"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2Icon, RefreshCwIcon } from "lucide-react";
import { refreshPaymentAction } from "@/app/actions/payments";
import { Button } from "@/components/ui/button";

/**
 * Keeps an in-flight payment's status honest.
 *
 * While the transaction is open the server is asked again on a slow interval
 * (and on demand), because the authoritative update may arrive by webhook after
 * the payer's browser has already come back. Nothing here decides an outcome —
 * it only re-renders whatever the database now says.
 */
export function PaymentStatusWatcher({ transactionId, open }: { transactionId: string; open: boolean }) {
  const router = useRouter();
  const [checking, setChecking] = React.useState(false);

  const check = React.useCallback(
    async (manual: boolean) => {
      setChecking(true);
      try {
        const res = await refreshPaymentAction({ transactionId });
        if (!res.ok && manual) toast.error(res.error);
        router.refresh();
      } finally {
        setChecking(false);
      }
    },
    [transactionId, router],
  );

  React.useEffect(() => {
    if (!open) return;
    const id = setInterval(() => void check(false), 6000);
    return () => clearInterval(id);
  }, [open, check]);

  if (!open) return null;
  return (
    <Button variant="outline" size="sm" onClick={() => void check(true)} disabled={checking}>
      {checking ? <Loader2Icon className="animate-spin" aria-hidden /> : <RefreshCwIcon className="size-4" aria-hidden />}
      Check again
    </Button>
  );
}
