import { z } from "zod";

export const applicationDecisionSchema = z.object({
  applicationId: z.string().min(1),
  decision: z.enum(["APPROVED", "REJECTED"]),
});

export type ApplicationDecisionInput = z.infer<typeof applicationDecisionSchema>;
