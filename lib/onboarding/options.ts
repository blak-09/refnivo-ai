import { BRAND_INDUSTRIES, CREATOR_CATEGORIES } from "@/lib/utils/labels";

/**
 * Choice lists for the onboarding and edit-profile forms. Values are stored as
 * the visible label (or the key for collaboration types) so existing rows stay
 * readable; validation only accepts values from these lists. Pure.
 */

export { BRAND_INDUSTRIES, CREATOR_CATEGORIES };

/** Shared by brand product categories, creator "interested brand categories" and customer preferred categories. */
export const PRODUCT_CATEGORY_OPTIONS = [
  "Fashion & apparel",
  "Beauty & personal care",
  "Electronics & gadgets",
  "Health & fitness",
  "Food & beverages",
  "Home & kitchen",
  "Baby & kids",
  "Books & education",
  "Travel & experiences",
  "Software & apps",
  "Jewellery & accessories",
  "Pets",
  "Other",
] as const;

export const CUSTOMER_INTEREST_OPTIONS = [
  "Fashion",
  "Beauty",
  "Technology",
  "Electronics",
  "Food",
  "Fitness",
  "Lifestyle",
  "Travel",
  "Education",
  "Other",
] as const;

export const BRAND_COLLABORATION_OPTIONS = [
  { value: "AFFILIATE", label: "Affiliate" },
  { value: "PAID", label: "Paid collaboration" },
  { value: "BARTER", label: "Barter" },
  { value: "UGC", label: "UGC" },
  { value: "REFERRAL", label: "Referral campaigns" },
] as const;

export const CREATOR_COLLABORATION_OPTIONS = [
  { value: "AFFILIATE", label: "Affiliate" },
  { value: "PAID", label: "Paid" },
  { value: "BARTER", label: "Barter" },
  { value: "UGC", label: "UGC" },
  { value: "PRODUCT_REVIEW", label: "Product reviews" },
] as const;

export const COLLABORATION_LABEL: Record<string, string> = Object.fromEntries(
  [...BRAND_COLLABORATION_OPTIONS, ...CREATOR_COLLABORATION_OPTIONS].map((o) => [o.value, o.label]),
);

export const PRIMARY_PLATFORM_OPTIONS = ["Instagram", "YouTube", "LinkedIn", "Facebook", "X (Twitter)", "Blog / website", "Other"] as const;

/** Self-reported audience size buckets — always labelled "self-reported" where shown. */
export const AUDIENCE_SIZE_OPTIONS = ["Under 1K", "1K–10K", "10K–50K", "50K–100K", "100K–500K", "500K–1M", "1M+"] as const;

export const CONTENT_LANGUAGE_OPTIONS = [
  "English",
  "Hindi",
  "Hinglish",
  "Bengali",
  "Marathi",
  "Tamil",
  "Telugu",
  "Kannada",
  "Malayalam",
  "Gujarati",
  "Punjabi",
  "Other",
] as const;

export const GENDER_OPTIONS = [
  { value: "FEMALE", label: "Female" },
  { value: "MALE", label: "Male" },
  { value: "NON_BINARY", label: "Non-binary" },
  { value: "PREFER_NOT_TO_SAY", label: "Prefer not to say" },
] as const;

export const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand",
  "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan",
  "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry",
] as const;

export const valuesOf = <T extends readonly ({ value: string } | string)[]>(list: T): string[] =>
  list.map((o) => (typeof o === "string" ? o : o.value));
