import type { PaymentStatus } from "@prisma/client";

/** Payer-facing wording for each payment state. */
export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  CREATED: "Starting",
  PENDING: "Awaiting payment",
  PROCESSING: "Confirming",
  PAID: "Paid",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
  REFUNDED: "Refunded",
  PARTIALLY_REFUNDED: "Partly refunded",
};

/**
 * Maps a payment state onto the StatusBadge palette already used by orders and
 * payouts, so payments read the same as the rest of the dashboard.
 */
export function paymentStatusTone(status: PaymentStatus): string {
  switch (status) {
    case "PAID":
      return "VERIFIED";
    case "FAILED":
    case "CANCELLED":
    case "EXPIRED":
      return "REJECTED";
    case "REFUNDED":
    case "PARTIALLY_REFUNDED":
      return "REFUNDED";
    default:
      return "PURCHASED"; // in flight
  }
}
