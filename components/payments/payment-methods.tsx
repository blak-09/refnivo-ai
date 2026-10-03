import { BuildingIcon, CreditCardIcon, ShieldCheckIcon, SmartphoneIcon, WalletIcon } from "lucide-react";

const METHODS = [
  { icon: SmartphoneIcon, label: "UPI", hint: "GPay, PhonePe, Paytm, BHIM" },
  { icon: CreditCardIcon, label: "Cards", hint: "Visa, Mastercard, RuPay, Amex" },
  { icon: BuildingIcon, label: "Netbanking", hint: "All major Indian banks" },
  { icon: WalletIcon, label: "Wallets", hint: "Paytm, Mobikwik, Amazon Pay" },
];

/** What the Razorpay checkout accepts. Details are entered in Razorpay's window, never in Refnivo. */
export function PaymentMethodsStrip({ className }: { className?: string }) {
  return (
    <div className={className}>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {METHODS.map((m) => (
          <li key={m.label} className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5">
            <m.icon className="size-5 shrink-0 text-primary" aria-hidden />
            <div className="min-w-0">
              <p className="text-sm font-medium">{m.label}</p>
              <p className="truncate text-xs text-muted-foreground">{m.hint}</p>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <ShieldCheckIcon className="size-3.5" aria-hidden />
        Secured by Razorpay (PCI-DSS). Refnivo never sees or stores your card or bank details.
      </p>
    </div>
  );
}
