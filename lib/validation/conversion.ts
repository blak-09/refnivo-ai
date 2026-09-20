import { z } from "zod";

// CUSTOMER_CLAIM is set by the order-handshake service only, never chosen in the manual form.
export const CONVERSION_SOURCES = ["MANUAL", "REFERRAL_CODE", "QR_SCAN", "IMPORT"] as const;

export const recordOrderSchema = z.object({
  code: z.string().trim().min(3, "Enter the referral code").max(40),
  orderReference: z.string().trim().min(1, "Order reference is required").max(80),
  /** Rupees in the form. */
  amount: z.coerce.number({ message: "Order value must be a number" }).min(1, "Order value must be at least ₹1").max(10_000_000),
  quantity: z.coerce.number().int().min(1).max(1000).default(1),
  source: z.enum(CONVERSION_SOURCES).default("REFERRAL_CODE"),
  customerContact: z.string().trim().max(120).optional().or(z.literal("")),
  note: z.string().trim().max(300).optional().or(z.literal("")),
});

export type RecordOrderInput = z.input<typeof recordOrderSchema>;

export const conversionReversalSchema = z.object({
  referralId: z.string().min(1),
  reason: z.string().trim().min(3, "Please give a reason (e.g. order returned).").max(300),
});

export const conversionDecisionSchema = z.object({
  referralId: z.string().min(1),
  decision: z.enum(["VERIFY", "REJECT"]),
  reason: z.string().trim().max(300).optional(),
});

/** Customer-facing order claim (order handshake) on the public campaign page. */
export const orderClaimSchema = z.object({
  campaignId: z.string().min(1),
  code: z.string().trim().min(3, "Enter the referral code you were given").max(40),
  orderReference: z.string().trim().min(2, "Enter your order number").max(80),
  contact: z
    .string()
    .trim()
    .min(5, "Enter the email or phone you used for the order")
    .max(120)
    .refine((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || /^\+?[\d\s()-]{8,20}$/.test(v), "Enter a valid email address or phone number"),
  note: z.string().trim().max(300).optional().or(z.literal("")),
  // Honeypot: real visitors never fill this.
  website: z.string().max(0).optional().or(z.literal("")),
});

export type OrderClaimInput = z.input<typeof orderClaimSchema>;

export const orderClaimDecisionSchema = z.discriminatedUnion("decision", [
  z.object({
    claimId: z.string().min(1),
    decision: z.literal("CONFIRM"),
    /** Rupees in the form. */
    amount: z.coerce.number({ message: "Order value must be a number" }).min(1, "Order value must be at least ₹1").max(10_000_000),
    quantity: z.coerce.number().int().min(1).max(1000).default(1),
  }),
  z.object({
    claimId: z.string().min(1),
    decision: z.literal("REJECT"),
    reason: z.string().trim().min(3, "Please say why (the customer sees this).").max(300),
  }),
]);
