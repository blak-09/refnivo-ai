import { z } from "zod";

export const optionalUrl = z
  .string()
  .trim()
  .url("Enter a valid URL (include https://)")
  .max(300)
  .optional()
  .or(z.literal(""));

export const brandSchema = z.object({
  name: z.string().trim().min(2, "Brand name is required").max(80),
  tagline: z.string().trim().max(120).optional().or(z.literal("")),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  industry: z.string().trim().max(60).optional().or(z.literal("")),
  website: optionalUrl,
  logoUrl: optionalUrl,
  coverImageUrl: optionalUrl,
  supportEmail: z.string().trim().email("Enter a valid email").max(120).optional().or(z.literal("")),
  country: z.string().trim().max(60).default("India"),
  instagramUrl: optionalUrl,
  youtubeUrl: optionalUrl,
  twitterUrl: optionalUrl,
  facebookUrl: optionalUrl,
  linkedinUrl: optionalUrl,
});

export type BrandInput = z.input<typeof brandSchema>;
export type BrandValues = z.output<typeof brandSchema>;

export type BrandSocialLinks = {
  instagram?: string;
  youtube?: string;
  twitter?: string;
  facebook?: string;
  linkedin?: string;
};

export function toSocialLinks(v: BrandValues): BrandSocialLinks {
  const out: BrandSocialLinks = {};
  if (v.instagramUrl) out.instagram = v.instagramUrl;
  if (v.youtubeUrl) out.youtube = v.youtubeUrl;
  if (v.twitterUrl) out.twitter = v.twitterUrl;
  if (v.facebookUrl) out.facebook = v.facebookUrl;
  if (v.linkedinUrl) out.linkedin = v.linkedinUrl;
  return out;
}
