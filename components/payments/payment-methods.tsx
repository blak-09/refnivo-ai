import { BuildingIcon, CreditCardIcon, ShieldCheckIcon, SmartphoneIcon, WalletIcon } from "lucide-react";

/** What Razorpay Checkout offers. All of them run inside Razorpay's window — Refnivo has no other payment gateway. */
const METHODS = [
  { icon: SmartphoneIcon, label: "UPI", hint: "Any UPI app or QR" },
  { icon: CreditCardIcon, label: "Cards", hint: "Visa, Mastercard, RuPay, Amex" },
  { icon: BuildingIcon, label: "Netbanking", hint: "All major Indian banks" },
  { icon: WalletIcon, label: "Wallets", hint: "As offered by Razorpay" },
];

/** Payments go through Razorpay only. Details are entered in Razorpay's window, never in Refnivo. */
export function PaymentMethodsStrip({ className }: { className?: string }) {
  return (
    <div className={className}>
      <div className="rounded-2xl border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold">
            Pay securely with <span className="text-[#0C2451]">Razorpay</span>
          </p>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success-strong">
            <ShieldCheckIcon className="size-3.5" aria-hidden /> PCI-DSS compliant
          </span>
        </div>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {METHODS.map((m) => (
            <li key={m.label} className="flex items-center gap-3 rounded-lg border bg-background px-3 py-2.5">
              <m.icon className="size-5 shrink-0 text-primary" aria-hidden />
              <div className="min-w-0">
                <p className="text-sm font-medium">{m.label}</p>
                <p className="truncate text-xs text-muted-foreground">{m.hint}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          Every payment opens Razorpay Checkout. Refnivo never sees or stores your card, UPI or bank details, and nothing is switched on or credited until
          Razorpay confirms the payment.
        </p>
      </div>
    </div>
  );
}
