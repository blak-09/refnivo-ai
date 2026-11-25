import { z } from "zod";
import type { RegistrableRole } from "@/lib/validation/auth";
import { optionalImageRef } from "./brand";
import { creatorProfileSchema } from "./creator";
import {
  AUDIENCE_SIZE_OPTIONS,
  BRAND_COLLABORATION_OPTIONS,
  BRAND_INDUSTRIES,
  CONTENT_LANGUAGE_OPTIONS,
  CREATOR_CATEGORIES,
  CREATOR_COLLABORATION_OPTIONS,
  CUSTOMER_INTEREST_OPTIONS,
  GENDER_OPTIONS,
  PRIMARY_PLATFORM_OPTIONS,
  PRODUCT_CATEGORY_OPTIONS,
  valuesOf,
} from "@/lib/onboarding/options";

/*
 * Profile schemas for onboarding (role → profile → review) and for Settings →
 * Edit profile. One schema per role; `images: "required"` is used during
 * onboarding when uploads are available, so a deployment without storage never
 * blocks signup. Pure; unit-tested.
 */

const text = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));
const required = (label: string, min: number, max: number) =>
  z.string({ error: `${label} is required` }).trim().min(min, min <= 1 ? `${label} is required` : `${label} must be at least ${min} characters`).max(max);

/** Accepts "instagram.com/x" as well as full URLs; stores https://… or "". */
const profileUrl = z
  .string()
  .trim()
  .max(300)
  .optional()
  .or(z.literal(""))
  .transform((v) => (v && !/^https?:\/\//i.test(v) ? `https://${v}` : v ?? ""))
  .refine((v) => v === "" || /^https?:\/\/[^\s/$.?#][^\s]*\.[^\s]+$/i.test(v), "Enter a valid URL");

const oneOf = (options: readonly string[], message: string) =>
  z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || options.includes(v), message);

/** Checkbox groups post repeated keys; keep only known values, de-duplicated. */
const multi = (options: readonly string[], max = 12) =>
  z
    .union([z.string(), z.array(z.string()), z.null()])
    .optional() // a group with nothing ticked posts no key at all
    .transform((v) => {
      const list = v == null ? [] : Array.isArray(v) ? v : [v];
      return [...new Set(list.map((s) => s.trim()).filter((s) => options.includes(s)))].slice(0, max);
    });

const username = z
  .string({ error: "Username is required" })
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,30}$/, "3–30 characters: letters, numbers and underscores");

const linkList = z
  .string()
  .trim()
  .max(1500)
  .optional()
  .or(z.literal(""))
  .transform((v) =>
    (v ?? "")
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => (/^https?:\/\//i.test(s) ? s : `https://${s}`)),
  )
  .refine((urls) => urls.length <= 5, "Add at most 5 links")
  .refine((urls) => urls.every((u) => /^https?:\/\/\S+\.\S+$/.test(u)), "Each link must be a valid URL");

export type ImageRule = "required" | "optional";

// A required image must not be optional at the schema level: Zod skips an
// optional key that is missing, so a refinement on it would never run.
const image = (rule: ImageRule, message: string) =>
  rule === "required"
    ? z
        .string({ error: message })
        .trim()
        .max(500)
        .refine((v) => v.startsWith("/uploads/") || v.startsWith("https://") || v.startsWith("http://"), message)
    : optionalImageRef;

// ---------------------------------------------------------------------------
// Brand
// ---------------------------------------------------------------------------

/** The logo is optional in the brief ("Brand Logo (Upload)" has no asterisk), so no image rule applies. */
export function brandProfileSchema() {
  return z.object({
    name: required("Brand name", 2, 80),
    logoUrl: optionalImageRef,
    coverImageUrl: optionalImageRef,
    website: profileUrl,
    businessEmail: z.string({ error: "Business email is required" }).trim().toLowerCase().email("Enter a valid business email").max(120),
    contactName: required("Contact person name", 2, 80),
    description: required("Brand description", 20, 2000),
    industry: z
      .string({ error: "Select an industry" })
      .trim()
      .refine((v) => (BRAND_INDUSTRIES as readonly string[]).includes(v), "Select an industry"),
    productCategories: multi(PRODUCT_CATEGORY_OPTIONS),
    instagramUrl: profileUrl,
    facebookUrl: profileUrl,
    linkedinUrl: profileUrl,
    youtubeUrl: profileUrl,
    country: text(60).transform((v) => v || "India"),
    state: text(60),
    city: text(60),
    targetAudience: text(500),
    productDescription: text(2000),
    collaborationTypes: multi(valuesOf(BRAND_COLLABORATION_OPTIONS)),
    // Edit-profile extras (kept from the original brand form).
    tagline: text(120),
    supportEmail: z.string().trim().email("Enter a valid email").max(120).optional().or(z.literal("")),
    twitterUrl: profileUrl,
  });
}

export type BrandProfileValues = z.output<ReturnType<typeof brandProfileSchema>>;

// ---------------------------------------------------------------------------
// Creator
// ---------------------------------------------------------------------------

/** Self-reported audience numbers etc. from the original creator form (edit only). */
const creatorExtras = creatorProfileSchema.pick({
  instagramHandle: true,
  instagramFollowers: true,
  youtubeChannel: true,
  youtubeSubscribers: true,
  twitterHandle: true,
  twitterUrl: true,
  averageViews: true,
  engagementRate: true,
  audienceCategory: true,
  audienceLocation: true,
  previousCampaigns: true,
  contentSamples: true,
});

export function creatorProfileOnboardingSchema(images: ImageRule = "optional") {
  return z
    .object({
      displayName: required("Full name", 2, 60),
      profileImageUrl: image(images, "Upload a profile picture"),
      username,
      bio: required("Professional bio", 40, 600),
      category: z
        .string({ error: "Select a creator category" })
        .trim()
        .refine((v) => (CREATOR_CATEGORIES as readonly string[]).includes(v), "Select a creator category"),
      instagramUrl: profileUrl,
      youtubeUrl: profileUrl,
      linkedinUrl: profileUrl,
      facebookUrl: profileUrl,
      otherLinks: linkList,
      primaryPlatform: oneOf(PRIMARY_PLATFORM_OPTIONS, "Select a platform"),
      audienceSize: oneOf(AUDIENCE_SIZE_OPTIONS, "Select an audience size"),
      contentLanguage: oneOf(CONTENT_LANGUAGE_OPTIONS, "Select a language"),
      country: text(60).transform((v) => v || "India"),
      state: text(60),
      city: text(60),
      contentDescription: text(1000),
      collaborationPreferences: multi(valuesOf(CREATOR_COLLABORATION_OPTIONS)),
      interestedCategories: multi(PRODUCT_CATEGORY_OPTIONS),
    })
    .extend(creatorExtras.partial().shape);
}

export type CreatorOnboardingValues = z.output<ReturnType<typeof creatorProfileOnboardingSchema>>;

// ---------------------------------------------------------------------------
// Customer
// ---------------------------------------------------------------------------

export function customerProfileSchema() {
  return z.object({
    name: required("Full name", 2, 80),
    avatarUrl: optionalImageRef,
    username,
    bio: text(300),
    country: required("Country", 2, 60),
    state: text(60),
    city: text(60),
    gender: oneOf(valuesOf(GENDER_OPTIONS), "Select an option"),
    interests: multi(CUSTOMER_INTEREST_OPTIONS),
    preferredCategories: multi(PRODUCT_CATEGORY_OPTIONS),
    favouriteBrands: text(300),
  });
}

export type CustomerProfileValues = z.output<ReturnType<typeof customerProfileSchema>>;

// ---------------------------------------------------------------------------
// Form plumbing
// ---------------------------------------------------------------------------

/** Field names that post as checkbox groups (repeated keys) for each role. */
export const ARRAY_FIELDS: Record<RegistrableRole, readonly string[]> = {
  BRAND_OWNER: ["productCategories", "collaborationTypes"],
  CREATOR: ["collaborationPreferences", "interestedCategories"],
  CUSTOMER: ["interests", "preferredCategories"],
};

const FIELDS: Record<RegistrableRole, readonly string[]> = {
  BRAND_OWNER: Object.keys(brandProfileSchema().shape),
  CREATOR: Object.keys(creatorProfileOnboardingSchema().shape),
  CUSTOMER: Object.keys(customerProfileSchema().shape),
};

export type ProfileFormValues = Record<string, string | string[]>;

/**
 * FormData → plain object for one role: only that role's fields, repeated keys
 * collected for checkbox groups, files and framework keys ignored.
 */
export function profileFormObject(role: RegistrableRole, formData: FormData): ProfileFormValues {
  const out: ProfileFormValues = {};
  for (const key of FIELDS[role]) {
    if (ARRAY_FIELDS[role].includes(key)) {
      out[key] = formData.getAll(key).filter((v): v is string => typeof v === "string");
    } else {
      const v = formData.get(key);
      if (typeof v === "string") out[key] = v;
    }
  }
  return out;
}

/**
 * "Save progress" stores whatever was typed without full validation — but only
 * known fields, as bounded strings, so the draft column can never grow
 * unbounded or hold anything else.
 */
export function sanitizeDraft(role: RegistrableRole, raw: unknown): ProfileFormValues {
  const src = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const out: ProfileFormValues = {};
  for (const key of FIELDS[role]) {
    const v = src[key];
    if (ARRAY_FIELDS[role].includes(key)) {
      const list = Array.isArray(v) ? v : typeof v === "string" ? [v] : [];
      out[key] = list.filter((s): s is string => typeof s === "string").map((s) => s.slice(0, 100)).slice(0, 20);
    } else if (typeof v === "string") {
      out[key] = v.slice(0, 3000);
    }
  }
  return out;
}

export function profileSchemaFor(role: RegistrableRole, images: ImageRule) {
  if (role === "BRAND_OWNER") return brandProfileSchema();
  if (role === "CREATOR") return creatorProfileOnboardingSchema(images);
  return customerProfileSchema();
}
