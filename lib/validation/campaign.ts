import { z } from "zod";
import { rupeesToPaise, percentToBasisPoints } from "@/lib/money";

export const CAMPAIGN_TYPES = ["CREATOR_AFFILIATE", "CUSTOMER_REFERRAL", "HYBRID"] as const;
export const REWARD_TYPES = ["FIXED_AMOUNT", "PERCENTAGE", "VOUCHER", "DISCOUNT"] as const;
export const COMMISSION_TYPES = ["FIXED_AMOUNT", "PERCENTAGE"] as const;

const MAX_RUPEES = 10_000_000; // ₹1 crore cap for any single value in v1

const rupees = (label: string) =>
  z.coerce
    .number({ message: `${label} must be a number` })
    .min(0, `${label} cannot be negative`)
    .max(MAX_RUPEES, `${label} is too large`);

const optionalRupees = (label: string) =>
  z
    .union([z.literal(""), z.null(), z.undefined(), rupees(label)])
    .transform((v) => (v === "" || v === null || v === undefined ? null : v));

const emptyToUndef = (v: unknown) => (v === "" || v === null ? undefined : v);

// -------------------------------------------------------------------------
// Step schemas — each wizard step validates independently on the client and
// the combined schema is re-validated server-side before any write.
// -------------------------------------------------------------------------

export const campaignProductSchema = z.object({
  productId: z.string().min(1, "Select the product this campaign promotes"),
});

export const campaignBasicsSchema = z.object({
  name: z.string().trim().min(3, "Campaign name must be at least 3 characters").max(80),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  offerTitle: z.string().trim().max(100).optional().or(z.literal("")),
  offerDescription: z.string().trim().max(600).optional().or(z.literal("")),
  campaignType: z.enum(CAMPAIGN_TYPES),
});

export const campaignRewardsSchema = z
  .object({
    rewardType: z.enum(REWARD_TYPES),
    /** Rupees for FIXED_AMOUNT/VOUCHER/DISCOUNT, percent for PERCENTAGE (form units). */
    customerRewardValue: rupees("Customer reward"),
    creatorCommissionType: z.enum(COMMISSION_TYPES),
    /** Rupees for FIXED_AMOUNT, percent for PERCENTAGE (form units). */
    creatorCommissionValue: rupees("Creator commission"),
    currency: z.literal("INR"),
    campaignType: z.enum(CAMPAIGN_TYPES),
  })
  .superRefine((v, ctx) => {
    if (v.campaignType !== "CREATOR_AFFILIATE" && v.customerRewardValue <= 0) {
      ctx.addIssue({ code: "custom", path: ["customerRewardValue"], message: "Customer reward must be greater than 0" });
    }
    if (v.rewardType === "PERCENTAGE" && v.customerRewardValue > 100) {
      ctx.addIssue({ code: "custom", path: ["customerRewardValue"], message: "Percentage cannot exceed 100%" });
    }
    if (v.campaignType !== "CUSTOMER_REFERRAL" && v.creatorCommissionValue <= 0) {
      ctx.addIssue({ code: "custom", path: ["creatorCommissionValue"], message: "Creator commission must be greater than 0" });
    }
    if (v.creatorCommissionType === "PERCENTAGE" && v.creatorCommissionValue > 50) {
      ctx.addIssue({ code: "custom", path: ["creatorCommissionValue"], message: "Commission percentage cannot exceed 50%" });
    }
  });

export const campaignRulesSchema = z
  .object({
    requiresApproval: z.coerce.boolean(),
    newCustomerOnly: z.coerce.boolean(),
    minimumPurchaseAmount: optionalRupees("Minimum order value"),
    attributionWindowDays: z.coerce
      .number()
      .int("Must be a whole number of days")
      .min(1, "At least 1 day")
      .max(90, "At most 90 days"),
    /** Cap on the reward for ONE order (column name predates the clarification). */
    maxRewardPerCustomer: optionalRupees("Maximum reward per order"),
    budget: optionalRupees("Budget"),
    terms: z.string().trim().max(3000).optional().or(z.literal("")),
  })
  .superRefine((v, ctx) => {
    if (v.budget !== null && v.budget <= 0) {
      ctx.addIssue({ code: "custom", path: ["budget"], message: "Budget must be greater than 0 or left empty" });
    }
  });

export const campaignDurationSchema = z
  .object({
    startDate: z.preprocess(emptyToUndef, z.coerce.date({ message: "Start date is required" })),
    endDate: z.preprocess(emptyToUndef, z.coerce.date().optional()),
  })
  .superRefine((v, ctx) => {
    if (v.endDate && v.endDate <= v.startDate) {
      ctx.addIssue({ code: "custom", path: ["endDate"], message: "End date must be after the start date" });
    }
  });

export const campaignFormSchema = campaignProductSchema
  .and(campaignBasicsSchema)
  .and(campaignRewardsSchema)
  .and(campaignRulesSchema)
  .and(campaignDurationSchema);

export type CampaignFormInput = z.input<typeof campaignFormSchema>;
export type CampaignFormValues = z.output<typeof campaignFormSchema>;

/** Convert validated form values (rupees / percent) into persisted units (paise / basis points). */
export function toCampaignData(v: CampaignFormValues) {
  return {
    productId: v.productId,
    name: v.name,
    description: v.description || null,
    offerTitle: v.offerTitle || null,
    offerDescription: v.offerDescription || null,
    campaignType: v.campaignType,
    terms: v.terms || null,
    rewardType: v.rewardType,
    customerRewardValue:
      v.rewardType === "PERCENTAGE" ? percentToBasisPoints(v.customerRewardValue) : rupeesToPaise(v.customerRewardValue),
    creatorCommissionType: v.creatorCommissionType,
    creatorCommissionValue:
      v.creatorCommissionType === "PERCENTAGE"
        ? percentToBasisPoints(v.creatorCommissionValue)
        : rupeesToPaise(v.creatorCommissionValue),
    currency: v.currency,
    requiresApproval: v.requiresApproval,
    newCustomerOnly: v.newCustomerOnly,
    minimumPurchaseAmount: v.minimumPurchaseAmount === null ? null : rupeesToPaise(v.minimumPurchaseAmount),
    maxRewardPerCustomer: v.maxRewardPerCustomer === null ? null : rupeesToPaise(v.maxRewardPerCustomer),
    budget: v.budget === null ? null : rupeesToPaise(v.budget),
    attributionWindowDays: v.attributionWindowDays,
    startDate: v.startDate,
    endDate: v.endDate ?? null,
  };
}

export const CAMPAIGN_ACTIONS = ["PUBLISH", "PAUSE", "RESUME", "END", "ARCHIVE"] as const;
export type CampaignAction = (typeof CAMPAIGN_ACTIONS)[number];

export const campaignStatusActionSchema = z.object({
  campaignId: z.string().min(1),
  action: z.enum(CAMPAIGN_ACTIONS),
  confirmed: z.boolean().optional(),
});
