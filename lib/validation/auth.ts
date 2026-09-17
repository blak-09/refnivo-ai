import { z } from "zod";

export const REGISTRABLE_ROLES = ["BRAND_OWNER", "CREATOR", "CUSTOMER"] as const;
export type RegistrableRole = (typeof REGISTRABLE_ROLES)[number];

/** Categories offered at signup. Kept broad on purpose — refined later in onboarding. */
export const BRAND_CATEGORIES = [
  "Electronics",
  "Fashion & Apparel",
  "Beauty & Personal Care",
  "Health & Nutrition",
  "Home & Kitchen",
  "Food & Beverage",
  "Sports & Fitness",
  "Other",
] as const;

export const CREATOR_CATEGORIES = [
  "Tech",
  "Fashion",
  "Beauty",
  "Fitness",
  "Food",
  "Lifestyle",
  "Gaming",
  "Education",
  "Other",
] as const;

const nameField = z.string().trim().min(2, "Name must be at least 2 characters").max(80);
const emailField = z.string().trim().toLowerCase().email("Enter a valid email address").max(120);
const passwordField = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128)
  .regex(/[A-Za-z]/, "Password must include a letter")
  .regex(/[0-9]/, "Password must include a number");

const optionalString = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal(""));

const phoneField = z
  .string()
  .trim()
  .regex(/^[+0-9 ()-]{8,16}$/, "Enter a valid phone number")
  .optional()
  .or(z.literal(""));

// A non-negative integer typed as a string in the form (followers / subscribers).
const countField = z
  .string()
  .trim()
  .regex(/^\d{0,12}$/, "Enter a number")
  .optional()
  .or(z.literal(""));

/**
 * Single flat schema for the whole registration form. Role-specific fields are
 * optional at the type level and made required per role in `superRefine`, so the
 * form can post a flat FormData and the server enforces the real rules.
 */
export const registerSchema = z
  .object({
    role: z.enum(REGISTRABLE_ROLES),
    name: nameField,
    email: emailField,
    phone: phoneField,
    password: passwordField,
    confirmPassword: z.string().min(1, "Please confirm your password"),

    // Brand owner
    brandName: optionalString(120),
    brandWebsite: optionalString(200),
    brandCategory: optionalString(60),
    brandDescription: optionalString(500),

    // Creator
    creatorName: optionalString(80),
    instagramHandle: optionalString(60),
    instagramFollowers: countField,
    youtubeChannel: optionalString(120),
    youtubeSubscribers: countField,
    creatorCategory: optionalString(60),
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["confirmPassword"], message: "Passwords do not match" });
    }

    if (data.role === "BRAND_OWNER") {
      if (!data.brandName?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["brandName"], message: "Brand name is required" });
      }
      if (!data.brandCategory?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["brandCategory"], message: "Select a brand category" });
      }
      if (data.brandWebsite?.trim() && !/^https?:\/\/.+\..+/.test(data.brandWebsite.trim())) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["brandWebsite"], message: "Enter a valid URL (https://…)" });
      }
    }

    if (data.role === "CREATOR") {
      if (!data.creatorName?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["creatorName"], message: "Creator name is required" });
      }
      if (!data.creatorCategory?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["creatorCategory"], message: "Select a content category" });
      }
    }
  });

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const checkRegistrationSchema = z
  .object({
    registrationId: z.string().trim().max(40).optional().or(z.literal("")),
    email: z.string().trim().toLowerCase().max(120).optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    const hasId = !!data.registrationId?.trim();
    const hasEmail = !!data.email?.trim();
    if (!hasId && !hasEmail) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["registrationId"], message: "Enter your Registration ID or email" });
    }
    if (hasEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email!.trim())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["email"], message: "Enter a valid email address" });
    }
  });

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(120),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(20, "Reset link is invalid").max(200),
    password: passwordField,
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CheckRegistrationInput = z.infer<typeof checkRegistrationSchema>;

/** Non-sensitive role-specific details, ready to persist (JSON) for admin review. */
export function extractRegistrationDetails(data: RegisterInput): Record<string, string | number> {
  const clean = (v: string | undefined) => (v && v.trim() ? v.trim() : "");
  const num = (v: string | undefined) => {
    const n = v && v.trim() ? Number(v.trim()) : NaN;
    return Number.isFinite(n) ? n : "";
  };

  if (data.role === "BRAND_OWNER") {
    return {
      brandName: clean(data.brandName),
      brandWebsite: clean(data.brandWebsite),
      brandCategory: clean(data.brandCategory),
      brandDescription: clean(data.brandDescription),
    };
  }
  if (data.role === "CREATOR") {
    return {
      creatorName: clean(data.creatorName),
      creatorCategory: clean(data.creatorCategory),
      instagramHandle: clean(data.instagramHandle),
      instagramFollowers: num(data.instagramFollowers),
      youtubeChannel: clean(data.youtubeChannel),
      youtubeSubscribers: num(data.youtubeSubscribers),
    };
  }
  return {};
}
