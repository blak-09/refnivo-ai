import { z } from "zod";

const id = z.string().min(1).max(64);
const reason = z.string().trim().min(3, "Please give a reason.").max(500);

export const suspendUserSchema = z.object({ userId: id, reason });
export const reactivateUserSchema = z.object({ userId: id });

export const verificationSchema = z.object({
  target: z.enum(["BRAND", "CREATOR"]),
  id,
  decision: z.enum(["VERIFIED", "REJECTED", "UNVERIFIED"]),
  note: z.string().trim().max(500).optional().or(z.literal("")),
});

export const moderateCampaignSchema = z.object({
  campaignId: id,
  action: z.enum(["PAUSE", "END", "ARCHIVE"]),
  reason,
});

export const payoutReviewSchema = z.object({
  payoutId: id,
  action: z.enum(["UNDER_REVIEW", "APPROVE", "MARK_PAID", "REJECT", "FAIL"]),
  reference: z.string().trim().max(120).optional().or(z.literal("")),
  note: z.string().trim().max(500).optional().or(z.literal("")),
});

export const payoutRequestSchema = z.object({
  kind: z.enum(["COMMISSION", "REWARD"]),
  method: z.enum(["UPI", "Bank transfer", "Brand voucher"]),
});

export const notificationIdSchema = z.object({ id });
