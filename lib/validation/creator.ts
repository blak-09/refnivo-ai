import { z } from "zod";
import { optionalImageRef, optionalUrl } from "./brand";

const optionalInt = (label: string, max: number) =>
  z
    .union([z.literal(""), z.null(), z.undefined(), z.coerce.number().int(`${label} must be a whole number`).min(0).max(max)])
    .transform((v) => (v === "" || v === null || v === undefined ? null : v));

const handle = z
  .string()
  .trim()
  .regex(/^@?[A-Za-z0-9._-]{1,60}$/, "Enter a valid handle")
  .transform((v) => v.replace(/^@/, ""))
  .optional()
  .or(z.literal(""));

export const creatorProfileSchema = z.object({
  displayName: z.string().trim().min(2, "Display name is required").max(60),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{3,30}$/, "3–30 characters: letters, numbers, underscores"),
  bio: z.string().trim().max(600).optional().or(z.literal("")),
  profileImageUrl: optionalImageRef,
  category: z.string().trim().max(60).optional().or(z.literal("")),
  location: z.string().trim().max(80).optional().or(z.literal("")),
  instagramHandle: handle,
  instagramUrl: optionalUrl,
  instagramFollowers: optionalInt("Instagram followers", 500_000_000),
  youtubeChannel: z.string().trim().max(80).optional().or(z.literal("")),
  youtubeUrl: optionalUrl,
  youtubeSubscribers: optionalInt("YouTube subscribers", 500_000_000),
  twitterHandle: handle,
  twitterUrl: optionalUrl,
  averageViews: optionalInt("Average views", 1_000_000_000),
  engagementRate: z
    .union([z.literal(""), z.null(), z.undefined(), z.coerce.number().min(0).max(100, "Engagement rate is a percentage")])
    .transform((v) => (v === "" || v === null || v === undefined ? null : v)),
  audienceCategory: z.string().trim().max(60).optional().or(z.literal("")),
  audienceLocation: z.string().trim().max(120).optional().or(z.literal("")),
  previousCampaigns: z.string().trim().max(2000).optional().or(z.literal("")),
  /** One URL per line in the form. */
  contentSamples: z
    .string()
    .trim()
    .max(3000)
    .optional()
    .or(z.literal(""))
    .transform((v) =>
      (v ?? "")
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean),
    )
    .refine((urls) => urls.length <= 10, "At most 10 content samples")
    .refine((urls) => urls.every((u) => /^https?:\/\/\S+$/.test(u)), "Each content sample must be a full URL"),
});

export type CreatorProfileInput = z.input<typeof creatorProfileSchema>;
export type CreatorProfileValues = z.output<typeof creatorProfileSchema>;

export function toCreatorProfileData(v: CreatorProfileValues) {
  const nullable = (s: string | undefined) => (s ? s : null);
  return {
    displayName: v.displayName,
    username: v.username,
    bio: nullable(v.bio),
    profileImageUrl: nullable(v.profileImageUrl),
    category: nullable(v.category),
    location: nullable(v.location),
    instagramHandle: nullable(v.instagramHandle),
    instagramUrl: nullable(v.instagramUrl),
    instagramFollowers: v.instagramFollowers,
    youtubeChannel: nullable(v.youtubeChannel),
    youtubeUrl: nullable(v.youtubeUrl),
    youtubeSubscribers: v.youtubeSubscribers,
    twitterHandle: nullable(v.twitterHandle),
    twitterUrl: nullable(v.twitterUrl),
    averageViews: v.averageViews,
    engagementRate: v.engagementRate,
    audienceCategory: nullable(v.audienceCategory),
    audienceLocation: nullable(v.audienceLocation),
    previousCampaigns: nullable(v.previousCampaigns),
    contentSamples: v.contentSamples,
  };
}

export const applyToCampaignSchema = z.object({
  campaignId: z.string().min(1),
  message: z.string().trim().max(500).optional().or(z.literal("")),
});
