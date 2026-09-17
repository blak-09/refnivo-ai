import { z } from "zod";

export const applicationDecisionSchema = z.object({
  applicationId: z.string().min(1),
  decision: z.enum(["APPROVED", "REJECTED"]),
});

export const removePartnerSchema = z.object({
  applicationId: z.string().min(1),
  reason: z.string().trim().max(300).optional().or(z.literal("")),
});

export const withdrawApplicationSchema = z.object({
  applicationId: z.string().min(1),
});

export type ApplicationDecisionInput = z.infer<typeof applicationDecisionSchema>;
