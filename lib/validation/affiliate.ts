import { z } from "zod";
import { optionalImageRef, optionalUrl } from "./brand";

/** Only real web links: no javascript:, data: or other schemes that could run in a browser. */
const httpUrl = z
  .string()
  .trim()
  .max(1000)
  .url("Enter a full link starting with https://")
  .refine((v) => /^https?:\/\//i.test(v), "Only http(s) links are allowed");

const optionalInt = (min: number, max: number) =>
  z.preprocess((v) => (v === "" || v === null || v === undefined ? undefined : v), z.coerce.number().int().min(min).max(max).optional());

export const AFFILIATE_CATEGORIES = [
  "Electronics",
  "Fashion",
  "Beauty",
  "Fitness",
  "Sports",
  "Home",
  "Food",
  "Lifestyle",
  "Personal Care",
  "E-commerce",
  "Travel",
  "Baby Products",
  "Technology",
  "Education",
  "Finance",
  "Other",
] as const;

/** How a programme works. A customer referral scheme must never be shown as a creator affiliate programme. */
export const AFFILIATE_PROGRAM_TYPES = ["AFFILIATE", "CREATOR_AFFILIATE", "REFERRAL", "INFLUENCER", "PARTNER", "AFFILIATE_NETWORK", "CREATOR_COMMERCE"] as const;
export type AffiliateProgramTypeValue = (typeof AFFILIATE_PROGRAM_TYPES)[number];

export const PROGRAM_TYPE_LABEL: Record<AffiliateProgramTypeValue, string> = {
  AFFILIATE: "Affiliate",
  CREATOR_AFFILIATE: "Creator Affiliate",
  REFERRAL: "Referral",
  INFLUENCER: "Influencer",
  PARTNER: "Partner",
  AFFILIATE_NETWORK: "Affiliate Network",
  CREATOR_COMMERCE: "Creator Commerce",
};

/** Creator audiences, for discovery only — never a claim about the programme's own criteria. */
export const BEST_FOR_OPTIONS = [
  "Tech creators",
  "Beauty creators",
  "Fashion creators",
  "Fitness creators",
  "Lifestyle creators",
  "Gaming creators",
  "Home creators",
  "Food creators",
  "Travel creators",
  "Parenting creators",
  "Finance creators",
  "General creators",
] as const;

/** Checkbox values arrive as "on" (or are absent). */
const checkbox = z.preprocess((v) => v === true || v === "on" || v === "true", z.boolean());

export const SOCIAL_PLATFORM_VALUES = ["INSTAGRAM", "YOUTUBE", "FACEBOOK", "LINKEDIN", "X"] as const;

/**
 * A brand's listing for an affiliate programme it already runs.
 *
 * Only the signup URL and a name are required: many external programmes do not
 * publish a cookie window, a network name or requirements, and the form must not
 * force a brand to invent them.
 */
export const affiliateProgramSchema = z.object({
  name: z.string().trim().min(2, "Give the programme a name").max(120),
  programType: z.enum(AFFILIATE_PROGRAM_TYPES).default("AFFILIATE"),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  category: z.enum(AFFILIATE_CATEGORIES).optional().or(z.literal("")),
  subcategory: z.string().trim().max(60).optional().or(z.literal("")),
  bestFor: z.array(z.enum(BEST_FOR_OPTIONS)).max(6).default([]),
  websiteUrl: optionalUrl,
  programUrl: optionalUrl,
  signupUrl: httpUrl,
  logoUrl: optionalImageRef,
  /** Empty = not stated. Never defaulted: a default would claim terms nobody gave. */
  commissionType: z.enum(["PERCENTAGE", "FIXED", "VARIES"]).optional().or(z.literal("")),
  commissionDescription: z.string().trim().max(300).optional().or(z.literal("")),
  cookieDurationDays: optionalInt(1, 365),
  networkName: z.string().trim().max(80).optional().or(z.literal("")),
  approvalType: z.enum(["AUTOMATIC", "APPLICATION", "INVITE_ONLY"]).optional().or(z.literal("")),
  minFollowers: optionalInt(0, 100_000_000),
  supportedPlatforms: z.array(z.enum(SOCIAL_PLATFORM_VALUES)).max(5).default([]),
  geography: z.string().trim().max(120).optional().or(z.literal("")),
  requirements: z.string().trim().max(1000).optional().or(z.literal("")),
  /** Only when the network documents one, e.g. "subId" or "aff_sub". Letters, digits, _ and - only. */
  subIdParam: z
    .string()
    .trim()
    .max(40)
    .regex(/^[A-Za-z][A-Za-z0-9_-]*$/, "Use the exact parameter name your network documents (letters, digits, _ or -)")
    .optional()
    .or(z.literal("")),
});

export type AffiliateProgramValues = z.output<typeof affiliateProgramSchema>;
export type AffiliateProgramInput = z.input<typeof affiliateProgramSchema>;

/**
 * Admin-maintained listing. Either attach it to a brand's Refnivo account, or —
 * for a programme Refnivo lists from public information before the brand joins —
 * give the brand's name.
 */
export const adminAffiliateProgramSchema = affiliateProgramSchema
  .extend({
    brandId: z.string().trim().max(40).optional().or(z.literal("")),
    brandName: z.string().trim().max(120).optional().or(z.literal("")),
    featured: checkbox.default(false),
    /** The official page the listed facts were checked against. */
    sourceUrl: optionalUrl,
    /**
     * Admin states the programme was verified, and on which date. The service
     * re-checks the official URL before accepting it (see affiliate-link-check).
     */
    verified: checkbox.default(false),
    verifiedOn: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date format YYYY-MM-DD")
      .optional()
      .or(z.literal("")),
  })
  .refine((v) => !!v.brandId || (v.brandName?.length ?? 0) >= 2, { path: ["brandName"], message: "Choose a Refnivo brand or enter the brand's name" });

export type AdminAffiliateProgramValues = z.output<typeof adminAffiliateProgramSchema>;

export const affiliateLinkSchema = z.object({
  programId: z.string().min(1).max(40),
  targetUrl: httpUrl,
  externalAffiliateId: z.string().trim().max(120).optional().or(z.literal("")),
  note: z.string().trim().max(300).optional().or(z.literal("")),
});

export const affiliateCodeSchema = z.object({
  linkId: z.string().min(1).max(40),
  source: z.enum(["GENERAL", ...SOCIAL_PLATFORM_VALUES]),
});
