import { z } from "zod";

/** UPI ID (VPA): handle@bank, e.g. arjun.k@okicici. */
export const VPA_PATTERN = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z][a-zA-Z0-9]{1,63}$/;
/** Indian Financial System Code: 4 letters, a zero, 6 alphanumerics. */
export const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;

const holderName = z
  .string()
  .trim()
  .min(2, "Enter the account holder's name.")
  .max(120)
  .regex(/^[\p{L} .'-]+$/u, "Use letters, spaces, dots or hyphens only.");

export const payoutAccountSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("UPI"),
    holderName,
    vpa: z
      .string()
      .trim()
      .toLowerCase()
      .regex(VPA_PATTERN, "Enter a valid UPI ID, like name@okicici."),
  }),
  z
    .object({
      type: z.literal("BANK"),
      holderName,
      accountNumber: z
        .string()
        .trim()
        .regex(/^\d{9,18}$/, "Account numbers are 9 to 18 digits."),
      confirmAccountNumber: z.string().trim(),
      ifsc: z
        .string()
        .trim()
        .toUpperCase()
        .regex(IFSC_PATTERN, "Enter a valid IFSC, like HDFC0001234."),
    })
    .refine((v) => v.accountNumber === v.confirmAccountNumber, { message: "The account numbers do not match.", path: ["confirmAccountNumber"] }),
]);

export type PayoutAccountInput = z.infer<typeof payoutAccountSchema>;

/** What is encrypted at rest. */
export type PayoutAccountDetails = { vpa: string } | { accountNumber: string; ifsc: string };

export function maskVpa(vpa: string): string {
  const [handle, bank] = vpa.split("@");
  return `${handle.slice(0, 2)}•••@${bank}`;
}

export function maskBank(accountNumber: string, ifsc: string): string {
  return `${ifsc} · ••••${accountNumber.slice(-4)}`;
}
