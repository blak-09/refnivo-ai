import { Prisma, type Brand, type CreatorProfile, type CustomerProfile, type UserRole } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { cleanupReplacedImages } from "@/lib/storage/cleanup";
import { brandCompletion, creatorCompletion, customerCompletion, type Completion } from "@/lib/onboarding/completion";
import type { RegistrableRole } from "@/lib/validation/auth";
import {
  sanitizeDraft,
  type BrandProfileValues,
  type CreatorOnboardingValues,
  type CustomerProfileValues,
  type ProfileFormValues,
} from "@/lib/validation/onboarding";
import type { BrandSocialLinks } from "@/lib/validation/brand";
import { recordAudit } from "./audit";
import { uniqueSlug } from "./brands";

/*
 * Onboarding: role → profile → review → complete.
 *
 * Until "Complete registration" nothing is written to the profile tables — the
 * form lives in `users.onboardingDraft` ("Save progress", survives refresh), so
 * a half-finished brand never appears in the public directory. Completion
 * writes the profile and sets `onboardingCompletedAt` in one transaction,
 * together with its audit entry. Settings → Edit profile reuses `saveProfile`.
 */

export class OnboardingError extends Error {
  constructor(
    message: string,
    readonly field?: string,
  ) {
    super(message);
    this.name = "OnboardingError";
  }
}

export type OnboardingDraft = { role: RegistrableRole; values: ProfileFormValues; savedAt: string };

export function isRegistrable(role: UserRole): role is RegistrableRole {
  return role === "BRAND_OWNER" || role === "CREATOR" || role === "CUSTOMER";
}

export async function getOnboardingContext(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      avatarUrl: true,
      onboardingCompletedAt: true,
      onboardingDraft: true,
      registrationDetails: true,
      brands: { take: 1, orderBy: { createdAt: "asc" } },
      creatorProfile: true,
      customerProfile: true,
    },
  });
  return { ...user, brand: user.brands[0] ?? null };
}

export type OnboardingContext = Awaited<ReturnType<typeof getOnboardingContext>>;

/** The saved draft, if it belongs to the account's current role. */
export function readDraft(raw: unknown, role: UserRole): OnboardingDraft | null {
  if (!raw || typeof raw !== "object" || !isRegistrable(role)) return null;
  const d = raw as Partial<OnboardingDraft>;
  if (d.role !== role) return null;
  return { role, values: sanitizeDraft(role, d.values), savedAt: typeof d.savedAt === "string" ? d.savedAt : "" };
}

const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
const list = (v: unknown) => (Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : []);

function brandToValues(b: Brand): ProfileFormValues {
  const social = (b.socialLinks ?? {}) as BrandSocialLinks;
  return {
    name: b.name,
    logoUrl: str(b.logoUrl),
    coverImageUrl: str(b.coverImageUrl),
    website: str(b.website),
    businessEmail: str(b.businessEmail),
    contactName: str(b.contactName),
    description: str(b.description),
    industry: str(b.industry),
    productCategories: b.productCategories,
    instagramUrl: str(social.instagram),
    facebookUrl: str(social.facebook),
    linkedinUrl: str(social.linkedin),
    youtubeUrl: str(social.youtube),
    country: b.country,
    state: str(b.state),
    city: str(b.city),
    targetAudience: str(b.targetAudience),
    productDescription: str(b.productDescription),
    collaborationTypes: b.collaborationTypes,
    tagline: str(b.tagline),
    supportEmail: str(b.supportEmail),
    twitterUrl: str(social.twitter),
  };
}

function creatorToValues(c: CreatorProfile): ProfileFormValues {
  return {
    displayName: c.displayName,
    profileImageUrl: str(c.profileImageUrl),
    username: c.username,
    bio: str(c.bio),
    category: str(c.category),
    instagramUrl: str(c.instagramUrl),
    youtubeUrl: str(c.youtubeUrl),
    linkedinUrl: str(c.linkedinUrl),
    facebookUrl: str(c.facebookUrl),
    otherLinks: list(c.otherLinks).join("\n"),
    primaryPlatform: str(c.primaryPlatform),
    audienceSize: str(c.audienceSize),
    contentLanguage: str(c.contentLanguage),
    country: str(c.country) || "India",
    state: str(c.state),
    city: str(c.city),
    contentDescription: str(c.contentDescription),
    collaborationPreferences: c.collaborationPreferences,
    interestedCategories: c.interestedCategories,
    instagramHandle: str(c.instagramHandle),
    instagramFollowers: str(c.instagramFollowers),
    youtubeChannel: str(c.youtubeChannel),
    youtubeSubscribers: str(c.youtubeSubscribers),
    twitterHandle: str(c.twitterHandle),
    twitterUrl: str(c.twitterUrl),
    averageViews: str(c.averageViews),
    engagementRate: str(c.engagementRate),
    audienceCategory: str(c.audienceCategory),
    audienceLocation: str(c.audienceLocation),
    previousCampaigns: str(c.previousCampaigns),
    contentSamples: list(c.contentSamples).join("\n"),
  };
}

function customerToValues(p: CustomerProfile | null, user: { name: string; avatarUrl: string | null }): ProfileFormValues {
  return {
    name: user.name,
    avatarUrl: str(user.avatarUrl),
    username: str(p?.username),
    bio: str(p?.bio),
    country: p?.country ?? "India",
    state: str(p?.state),
    city: str(p?.city),
    gender: str(p?.gender),
    interests: p?.interests ?? [],
    preferredCategories: p?.preferredCategories ?? [],
    favouriteBrands: str(p?.favouriteBrands),
  };
}

/** A username suggestion from a name: lowercase, a–z/0–9/_ only, 3–30 chars. */
export function suggestUsername(name: string): string {
  const base = name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 24);
  return base.length >= 3 ? base : "";
}

/**
 * Values the profile form opens with: the saved draft, else the existing
 * profile (Edit profile / returning users), else what we already know — the
 * account name and e-mail, and any details typed into the old signup form.
 */
export function profileFormValues(ctx: OnboardingContext, opts: { preferDraft: boolean }): ProfileFormValues {
  const role = ctx.role;
  if (!isRegistrable(role)) return {};
  const draft = opts.preferDraft ? readDraft(ctx.onboardingDraft, role) : null;
  if (draft) return draft.values;

  if (role === "BRAND_OWNER" && ctx.brand) return brandToValues(ctx.brand);
  if (role === "CREATOR" && ctx.creatorProfile) return creatorToValues(ctx.creatorProfile);
  if (role === "CUSTOMER") {
    const values = customerToValues(ctx.customerProfile, ctx);
    if (!ctx.customerProfile) values.username = suggestUsername(ctx.name);
    return values;
  }

  const details = (ctx.registrationDetails && typeof ctx.registrationDetails === "object" ? ctx.registrationDetails : {}) as Record<string, unknown>;
  if (role === "BRAND_OWNER") {
    return {
      name: str(details.brandName),
      website: str(details.brandWebsite),
      description: str(details.brandDescription),
      businessEmail: ctx.email,
      contactName: ctx.name,
      country: "India",
    };
  }
  return {
    displayName: str(details.creatorName) || ctx.name,
    username: suggestUsername(str(details.creatorName) || ctx.name),
    profileImageUrl: str(ctx.avatarUrl).startsWith("/uploads/") ? str(ctx.avatarUrl) : "",
    instagramHandle: str(details.instagramHandle),
    instagramFollowers: str(details.instagramFollowers),
    youtubeChannel: str(details.youtubeChannel),
    youtubeSubscribers: str(details.youtubeSubscribers),
    country: "India",
  };
}

export async function saveOnboardingDraft(userId: string, role: RegistrableRole, values: unknown): Promise<OnboardingDraft> {
  const draft: OnboardingDraft = { role, values: sanitizeDraft(role, values), savedAt: new Date().toISOString() };
  await prisma.user.update({ where: { id: userId }, data: { onboardingDraft: draft as unknown as Prisma.InputJsonValue } });
  return draft;
}

// ---------------------------------------------------------------------------
// Role change (only while onboarding is unfinished and nothing depends on it)
// ---------------------------------------------------------------------------

/**
 * Reasons the account's role cannot be changed safely. Empty = safe: onboarding
 * is unfinished and the account owns nothing role-specific yet (no profile,
 * links, applications, money or payments).
 */
export async function roleChangeBlockers(userId: string): Promise<string[]> {
  const u = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      onboardingCompletedAt: true,
      _count: {
        select: {
          brands: true,
          referralLinks: true,
          partnerApplications: true,
          commissions: true,
          rewards: true,
          payoutRequests: true,
          orderClaims: true,
          payments: true,
          connections: true,
          socialAccounts: true,
          affiliateLinks: true,
        },
      },
      creatorProfile: { select: { id: true } },
      customerProfile: { select: { id: true } },
    },
  });
  const reasons: string[] = [];
  if (u.onboardingCompletedAt) reasons.push("onboarding is already complete");
  if (u.creatorProfile || u.customerProfile || u._count.brands) reasons.push("a profile already exists");
  const activity = Object.entries(u._count).filter(([k, n]) => k !== "brands" && n > 0);
  if (activity.length) reasons.push("the account already has activity");
  return reasons;
}

export async function changeOnboardingRole(userId: string, from: RegistrableRole, to: RegistrableRole): Promise<void> {
  if (from === to) return;
  const blockers = await roleChangeBlockers(userId);
  if (blockers.length) throw new OnboardingError(`Your account type can't be changed because ${blockers.join(" and ")}. Contact support if you need help.`);
  await prisma.$transaction(async (tx) => {
    // Guarded on the old role so a concurrent change cannot be overwritten.
    const res = await tx.user.updateMany({ where: { id: userId, role: from, onboardingCompletedAt: null }, data: { role: to, onboardingDraft: Prisma.DbNull } });
    if (res.count !== 1) throw new OnboardingError("Your account changed in the meantime. Please reload and try again.");
    await recordAudit({ userId, actorRole: to, action: "ONBOARDING_ROLE_CHANGED", entityType: "User", entityId: userId, metadata: { from, to } }, tx);
  });
}

// ---------------------------------------------------------------------------
// Writing the profile (onboarding completion and Edit profile)
// ---------------------------------------------------------------------------

const orNull = (v: string | undefined | null) => (v ? v : null);
const place = (...parts: (string | undefined | null)[]) => parts.filter((p) => p && p.trim()).join(", ") || null;

function brandData(v: BrandProfileValues) {
  const socialLinks: BrandSocialLinks = {};
  if (v.instagramUrl) socialLinks.instagram = v.instagramUrl;
  if (v.youtubeUrl) socialLinks.youtube = v.youtubeUrl;
  if (v.twitterUrl) socialLinks.twitter = v.twitterUrl;
  if (v.facebookUrl) socialLinks.facebook = v.facebookUrl;
  if (v.linkedinUrl) socialLinks.linkedin = v.linkedinUrl;
  return {
    name: v.name,
    tagline: orNull(v.tagline),
    description: v.description,
    industry: v.industry,
    website: orNull(v.website),
    logoUrl: orNull(v.logoUrl),
    coverImageUrl: orNull(v.coverImageUrl),
    supportEmail: orNull(v.supportEmail),
    businessEmail: v.businessEmail,
    contactName: v.contactName,
    country: v.country || "India",
    state: orNull(v.state),
    city: orNull(v.city),
    productCategories: v.productCategories,
    targetAudience: orNull(v.targetAudience),
    productDescription: orNull(v.productDescription),
    collaborationTypes: v.collaborationTypes,
    socialLinks: socialLinks as Prisma.InputJsonValue,
  };
}

function creatorData(v: CreatorOnboardingValues, existingLocation: string | null) {
  const data: Prisma.CreatorProfileUncheckedUpdateInput = {
    displayName: v.displayName,
    username: v.username,
    bio: v.bio,
    profileImageUrl: orNull(v.profileImageUrl),
    category: v.category,
    // `location` stays the public one-line place used by the directory filter.
    location: place(v.city, v.state) ?? existingLocation,
    instagramUrl: orNull(v.instagramUrl),
    youtubeUrl: orNull(v.youtubeUrl),
    linkedinUrl: orNull(v.linkedinUrl),
    facebookUrl: orNull(v.facebookUrl),
    otherLinks: v.otherLinks,
    primaryPlatform: orNull(v.primaryPlatform),
    audienceSize: orNull(v.audienceSize),
    contentLanguage: orNull(v.contentLanguage),
    country: orNull(v.country),
    state: orNull(v.state),
    city: orNull(v.city),
    contentDescription: orNull(v.contentDescription),
    collaborationPreferences: v.collaborationPreferences,
    interestedCategories: v.interestedCategories,
  };
  // Self-reported extras are only on the Edit-profile form; absent = keep.
  const extras = [
    "instagramHandle",
    "instagramFollowers",
    "youtubeChannel",
    "youtubeSubscribers",
    "twitterHandle",
    "twitterUrl",
    "averageViews",
    "engagementRate",
    "audienceCategory",
    "audienceLocation",
    "previousCampaigns",
    "contentSamples",
  ] as const;
  for (const key of extras) {
    const value = v[key];
    if (value === undefined) continue;
    (data as Record<string, unknown>)[key] = typeof value === "string" ? orNull(value) : value;
  }
  return data;
}

type SaveInput =
  | { role: "BRAND_OWNER"; values: BrandProfileValues }
  | { role: "CREATOR"; values: CreatorOnboardingValues }
  | { role: "CUSTOMER"; values: CustomerProfileValues };

export type SaveResult = { role: RegistrableRole; publicPath: string | null };

function isUniqueOn(err: unknown, field: string) {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2002") return false;
  const target = err.meta?.target;
  return (Array.isArray(target) ? target.join(",") : String(target ?? "")).includes(field);
}

/**
 * Writes the role's profile for `userId` (create or update). With
 * `complete: true` it also finishes onboarding — sets the timestamp and clears
 * the draft — in the same transaction. The role is re-read from the database
 * and must match `input.role`.
 */
export async function saveProfile(userId: string, input: SaveInput, opts: { complete: boolean }): Promise<SaveResult> {
  const replaced: { previous: string | null | undefined; next: string | null | undefined }[] = [];
  try {
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { role: true, avatarUrl: true, onboardingCompletedAt: true } });
      if (user.role !== input.role) throw new OnboardingError("Your account type changed. Please reload the page.");
      let publicPath: string | null = null;
      let entity: { type: string; id: string };

      if (input.role === "BRAND_OWNER") {
        const data = brandData(input.values);
        const existing = await tx.brand.findUnique({ where: { ownerId: userId } });
        if (existing) {
          const brand = await tx.brand.update({ where: { id: existing.id }, data });
          replaced.push({ previous: existing.logoUrl, next: brand.logoUrl }, { previous: existing.coverImageUrl, next: brand.coverImageUrl });
          entity = { type: "Brand", id: brand.id };
          publicPath = `/brands/${brand.slug}`;
          await recordAudit({ userId, actorRole: "BRAND_OWNER", action: "BRAND_UPDATED", entityType: "Brand", entityId: brand.id }, tx);
        } else {
          const slug = await uniqueSlug(data.name, async (s) => !!(await tx.brand.findUnique({ where: { slug: s }, select: { id: true } })));
          const brand = await tx.brand.create({ data: { ownerId: userId, slug, ...data } });
          entity = { type: "Brand", id: brand.id };
          publicPath = `/brands/${brand.slug}`;
          await recordAudit({ userId, actorRole: "BRAND_OWNER", action: "BRAND_CREATED", entityType: "Brand", entityId: brand.id, metadata: { name: brand.name } }, tx);
        }
      } else if (input.role === "CREATOR") {
        const existing = await tx.creatorProfile.findUnique({ where: { userId } });
        const data = creatorData(input.values, existing?.location ?? null);
        const profile = existing
          ? await tx.creatorProfile.update({ where: { userId }, data })
          : await tx.creatorProfile.create({ data: { ...(data as Prisma.CreatorProfileUncheckedCreateInput), userId } });
        if (existing) replaced.push({ previous: existing.profileImageUrl, next: profile.profileImageUrl });
        entity = { type: "CreatorProfile", id: profile.id };
        publicPath = `/creators/${profile.username}`;
        await recordAudit(
          { userId, actorRole: "CREATOR", action: existing ? "CREATOR_PROFILE_UPDATED" : "CREATOR_PROFILE_CREATED", entityType: "CreatorProfile", entityId: profile.id },
          tx,
        );
      } else {
        const v = input.values;
        const data = {
          username: v.username,
          bio: orNull(v.bio),
          country: v.country,
          state: orNull(v.state),
          city: orNull(v.city),
          gender: orNull(v.gender),
          interests: v.interests,
          preferredCategories: v.preferredCategories,
          favouriteBrands: orNull(v.favouriteBrands),
        };
        const profile = await tx.customerProfile.upsert({ where: { userId }, create: { userId, ...data }, update: data });
        await tx.user.update({ where: { id: userId }, data: { name: v.name, avatarUrl: orNull(v.avatarUrl) } });
        replaced.push({ previous: user.avatarUrl, next: orNull(v.avatarUrl) });
        entity = { type: "CustomerProfile", id: profile.id };
        await recordAudit({ userId, actorRole: "CUSTOMER", action: "CUSTOMER_PROFILE_SAVED", entityType: "CustomerProfile", entityId: profile.id }, tx);
      }

      if (opts.complete && !user.onboardingCompletedAt) {
        await tx.user.update({ where: { id: userId }, data: { onboardingCompletedAt: new Date(), onboardingDraft: Prisma.DbNull } });
        await recordAudit({ userId, actorRole: input.role, action: "ONBOARDING_COMPLETED", entityType: entity.type, entityId: entity.id, metadata: { role: input.role } }, tx);
      }
      return { role: input.role, publicPath };
    });
    cleanupReplacedImages(replaced);
    return result;
  } catch (err) {
    if (isUniqueOn(err, "username")) throw new OnboardingError("That username is already taken. Try another one.", "username");
    if (isUniqueOn(err, "ownerId")) throw new OnboardingError("You already have a brand profile.");
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Completion (dashboard card, profile pages)
// ---------------------------------------------------------------------------

export async function profileCompletionFor(userId: string, role: UserRole): Promise<Completion | null> {
  if (role === "BRAND_OWNER") {
    const brand = await prisma.brand.findUnique({ where: { ownerId: userId } });
    return brand ? brandCompletion(brand) : null;
  }
  if (role === "CREATOR") {
    const profile = await prisma.creatorProfile.findUnique({ where: { userId } });
    return profile ? creatorCompletion(profile) : null;
  }
  if (role === "CUSTOMER") {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true, avatarUrl: true, customerProfile: true } });
    return customerCompletion({ ...user.customerProfile, name: user.name, avatarUrl: user.avatarUrl });
  }
  return null;
}
