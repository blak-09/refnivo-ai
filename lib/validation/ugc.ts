import { z } from "zod";
import {
  UGC_CONTENT_TYPES,
  UGC_FEE_MAX,
  UGC_FEE_MIN,
  UGC_MAX_CREATORS,
  UGC_MAX_IMAGES,
  UGC_MAX_LINKS,
  UGC_USAGE_RIGHTS,
} from "@/lib/ugc/options";

/*
 * UGC collaboration inputs. Every schema runs on the server (actions re-validate
 * whatever the browser sends). Money: the form takes whole rupees, the schema
 * outputs integer paise. Pure; unit-tested.
 */

const CONTENT_VALUES = UGC_CONTENT_TYPES.map((o) => o.value) as string[];
const USAGE_VALUES = UGC_USAGE_RIGHTS.map((o) => o.value) as string[];

const text = (label: string, min: number, max: number) =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .min(min, min <= 1 ? `${label} is required` : `${label} must be at least ${min} characters`)
    .max(max, `${label} must be at most ${max} characters`);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be at most ${max} characters`)
    .optional()
    .transform((v) => (v ? v : null));

/** "2026-12-01" → Date at the end of that day (IST-agnostic: 23:59:59 UTC). Empty → null. */
const optionalDate = z
  .string()
  .trim()
  .optional()
  .refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), "Enter a valid date")
  .transform((v) => (v ? new Date(`${v}T23:59:59.000Z`) : null));

/** Checkbox groups post repeated keys (or nothing when none is ticked). */
const multi = (options: string[]) =>
  z
    .union([z.string(), z.array(z.string()), z.null()])
    .optional()
    .transform((v) => [...new Set((v == null ? [] : Array.isArray(v) ? v : [v]).map((s) => s.trim()).filter((s) => options.includes(s)))]);

const url = (s: string) => (/^https?:\/\//i.test(s) ? s : `https://${s}`);
const isUrl = (s: string) => /^https?:\/\/[^\s/$.?#][^\s]*\.[^\s]+$/i.test(s);

/** One URL per line (textarea) or repeated keys → up to `max` normalised URLs. */
const linkList = (max: number) =>
  z
    .union([z.string(), z.array(z.string()), z.null()])
    .optional()
    .transform((v) =>
      (v == null ? [] : Array.isArray(v) ? v : v.split(/\r?\n/))
        .map((s) => s.trim())
        .filter(Boolean)
        .map(url),
    )
    .refine((list) => list.length <= max, `Add at most ${max} links`)
    .refine((list) => list.every(isUrl), "Each link must be a valid URL");

export const ugcBriefSchema = z
  .object({
    title: text("Title", 5, 100),
    description: text("Brief", 30, 3000),
    deliverables: text("Deliverables", 5, 500),
    contentTypes: multi(CONTENT_VALUES).refine((v) => v.length > 0, "Pick at least one content type"),
    feeRupees: z.coerce
      .number({ error: "Enter the fee per creator" })
      .int("Use whole rupees")
      .min(UGC_FEE_MIN / 100, `The fee must be at least ₹${UGC_FEE_MIN / 100}`)
      .max(UGC_FEE_MAX / 100, `The fee must be at most ₹${(UGC_FEE_MAX / 100).toLocaleString("en-IN")}`),
    creatorsNeeded: z.coerce
      .number({ error: "How many creators?" })
      .int()
      .min(1, "At least 1 creator")
      .max(UGC_MAX_CREATORS, `At most ${UGC_MAX_CREATORS} creators`),
    usageRights: z.string({ error: "Choose how you will use the content" }).refine((v) => USAGE_VALUES.includes(v), "Choose how you will use the content"),
    usageNotes: optionalText(500),
    productId: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v : null)),
    productShipped: z
      .union([z.literal("on"), z.literal("true"), z.literal(""), z.boolean()])
      .optional()
      .transform((v) => v === "on" || v === "true" || v === true),
    applyBy: optionalDate,
    deliverBy: optionalDate,
  })
  .refine((v) => !v.applyBy || !v.deliverBy || v.deliverBy >= v.applyBy, { path: ["deliverBy"], message: "Delivery must be on or after the application deadline" })
  .transform(({ feeRupees, ...rest }) => ({ ...rest, feeAmount: feeRupees * 100 }));

export type UgcBriefValues = z.output<typeof ugcBriefSchema>;

export const ugcApplySchema = z.object({
  pitch: text("Your pitch", 20, 1500),
  portfolioLinks: linkList(UGC_MAX_LINKS),
});

export type UgcApplyValues = z.output<typeof ugcApplySchema>;

/** Uploaded images must be the creator's own UGC uploads (checked again in the service). */
const imageRef = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v.startsWith("/uploads/") || v.startsWith("https://"), "Upload the photo again");

export const ugcSubmissionSchema = z
  .object({
    note: optionalText(1500),
    imageUrls: z
      .union([z.string(), z.array(z.string()), z.null()])
      .optional()
      .transform((v) => (v == null ? [] : Array.isArray(v) ? v : [v]).map((s) => s.trim()).filter(Boolean))
      .pipe(z.array(imageRef).max(UGC_MAX_IMAGES, `Add at most ${UGC_MAX_IMAGES} photos`)),
    links: linkList(UGC_MAX_LINKS),
  })
  .refine((v) => v.imageUrls.length > 0 || v.links.length > 0, { path: ["links"], message: "Upload at least one photo or add a video link" });

export type UgcSubmissionValues = z.output<typeof ugcSubmissionSchema>;

export const ugcReviewSchema = z
  .object({
    decision: z.enum(["APPROVED", "REVISION_REQUESTED"], { error: "Choose approve or request changes" }),
    feedback: optionalText(1500),
  })
  .refine((v) => v.decision === "APPROVED" || (v.feedback?.length ?? 0) >= 10, { path: ["feedback"], message: "Tell the creator what to change (at least 10 characters)" });

export const ugcNoteSchema = z.object({ note: optionalText(500) });
export const ugcPaymentSchema = z.object({ reference: optionalText(100) });

export const partnerNoteSchema = z.object({ body: text("Note", 2, 2000) });
