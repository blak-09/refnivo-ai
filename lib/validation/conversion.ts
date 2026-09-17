import { z } from "zod";

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
