"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { toast } from "sonner";
import { Loader2Icon, LockIcon } from "lucide-react";
import { cancelPaymentAction, startPlanCheckoutAction, verifyPaymentAction } from "@/app/actions/payments";
import { startWalletTopupAction } from "@/app/actions/wallet";
import { Button } from "@/components/ui/button";

/**
 * Opens the provider's hosted checkout.
 *
 * Card details are entered in Razorpay's own widget, never in Refnivo — we only
 * receive identifiers and a signature, and even those are advisory: the server
 * verifies the signature and re-reads the payment from the provider before
 * anything is granted. The handler therefore sends the payer to the status page
 * rather than announcing success itself.
 */
type RazorpayHandlerResponse = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (r: RazorpayHandlerResponse) => void;
  modal?: { ondismiss?: () => void };
  prefill?: { name?: string; email?: string };
  theme?: { color?: string };
};
declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void };
  }
}

export function CheckoutButton({
  planKey,
  planName,
  topupAmountMinor,
  label,
  payer,
  className,
  variant,
  disabled,
}: {
  /** A plan purchase… */
  planKey?: string;
  planName?: string;
  /** …or a wallet top-up (whole rupees, in paise). */
  topupAmountMinor?: number;
  label: string;
  payer: { name: string; email: string };
  className?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [scriptReady, setScriptReady] = React.useState(false);

  async function start() {
    if (pending) return; // no double submits
    setPending(true);
    try {
      const created = topupAmountMinor !== undefined ? await startWalletTopupAction({ amountMinor: topupAmountMinor }) : await startPlanCheckoutAction({ planKey });
      if (!created.ok) {
        toast.error(created.error);
        return;
      }
      const { transactionId, providerOrderId, publicKey, amount, currency } = created.data;
      if (!window.Razorpay) {
        toast.error("The payment window could not load. Please check your connection and try again.");
        return;
      }

      const checkout = new window.Razorpay({
        key: publicKey,
        amount,
        currency,
        name: "Refnivo",
        description: topupAmountMinor !== undefined ? "Wallet top-up" : `${planName ?? created.data.planName} plan`,
        order_id: providerOrderId,
        prefill: { name: payer.name, email: payer.email },
        theme: { color: "#4f46e5" },
        handler: (response) => {
          // Hand the callback to the server and let the status page report the outcome.
          void verifyPaymentAction({ transactionId, ...response }).finally(() => {
            router.push(`/dashboard/brand/billing/${transactionId}`);
            router.refresh();
          });
        },
        modal: {
          ondismiss: () => {
            void cancelPaymentAction({ transactionId }).finally(() => {
              router.push(`/dashboard/brand/billing/${transactionId}`);
              router.refresh();
            });
          },
        },
      });
      checkout.open();
    } catch (err) {
      console.error(err);
      toast.error("Could not start the payment. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" onReady={() => setScriptReady(true)} />
      <Button onClick={start} disabled={disabled || pending || !scriptReady} className={className} variant={variant}>
        {pending ? <Loader2Icon className="animate-spin" aria-hidden /> : <LockIcon className="size-4" aria-hidden />}
        {pending ? "Opening secure checkout…" : label}
      </Button>
    </>
  );
}
