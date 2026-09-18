import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { toCreatorProfileData, type CreatorProfileValues } from "@/lib/validation/creator";
import { recordAudit } from "./audit";
import { creatorReviewSelect } from "./partners";

export class CreatorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CreatorError";
  }
}

export async function getCreatorProfile(userId: string) {
  return prisma.creatorProfile.findUnique({ where: { userId } });
}

export async function upsertCreatorProfile(userId: string, values: CreatorProfileValues) {
  const data = toCreatorProfileData(values);
  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.creatorProfile.findUnique({ where: { userId }, select: { id: true } });
      const profile = existing
        ? await tx.creatorProfile.update({ where: { userId }, data })
        : await tx.creatorProfile.create({ data: { userId, ...data } });
      await recordAudit(
        { userId, action: existing ? "CREATOR_PROFILE_UPDATED" : "CREATOR_PROFILE_CREATED", entityType: "CreatorProfile", entityId: profile.id },
        tx,
      );
      return profile;
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new CreatorError("That username is already taken.");
    }
    throw err;
  }
}

/** Public creator profile + campaign history (no contact details). */
export async function getPublicCreator(username: string) {
  const profile = await prisma.creatorProfile.findFirst({
    where: { username, user: { status: "APPROVED" } },
    select: {
      ...creatorReviewSelect,
      createdAt: true,
      user: {
        select: {
          partnerApplications: {
            where: { status: "APPROVED", partnerType: "CREATOR" },
            orderBy: { createdAt: "desc" },
            take: 12,
            select: {
              createdAt: true,
              campaign: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  status: true,
                  brand: { select: { name: true, slug: true, logoUrl: true } },
                  product: { select: { name: true, imageUrl: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!profile) return null;
  const verifiedSales = await prisma.referral.count({
    where: { status: "VERIFIED", referralLink: { partnerType: "CREATOR", owner: { creatorProfile: { username } } } },
  });
  return { ...profile, campaigns: profile.user.partnerApplications, verifiedSales };
}

/** Creator dashboard: campaigns the creator has joined / applied to. */
export async function listCreatorCampaigns(userId: string) {
  return prisma.partnerApplication.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      createdAt: true,
      campaign: {
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          startDate: true,
          endDate: true,
          campaignType: true,
          rewardType: true,
          customerRewardValue: true,
          creatorCommissionType: true,
          creatorCommissionValue: true,
          currency: true,
          brand: { select: { name: true, slug: true, logoUrl: true } },
          product: { select: { name: true, slug: true, imageUrl: true, price: true, currency: true, purchaseUrl: true } },
          referralLinks: { where: { ownerId: userId }, select: { id: true, code: true, status: true, _count: { select: { clicks: true, referrals: true } } } },
        },
      },
    },
  });
}

export const CREATOR_PROFILE_FIELDS = [
  "displayName",
  "username",
  "bio",
  "profileImageUrl",
  "category",
  "location",
  "instagramHandle",
  "youtubeChannel",
  "twitterHandle",
  "audienceCategory",
] as const;

/** Fraction (0–1) of key profile fields that are filled in. */
export function profileCompletion(p: Record<string, unknown>): number {
  const filled = CREATOR_PROFILE_FIELDS.filter((f) => {
    const v = p[f];
    return typeof v === "string" ? v.trim().length > 0 : v != null;
  }).length;
  return Math.round((filled / CREATOR_PROFILE_FIELDS.length) * 100);
}

export type PublicCreatorCard = {
  displayName: string;
  username: string;
  bio: string | null;
  profileImageUrl: string | null;
  category: string | null;
  location: string | null;
  instagramFollowers: number | null;
  youtubeSubscribers: number | null;
  engagementRate: number | null;
  verificationStatus: string;
};

/** Directory of creators for brands to discover. Never exposes contact details. */
export async function listPublicCreators(opts: { q?: string; category?: string; limit?: number } = {}): Promise<PublicCreatorCard[]> {
  return prisma.creatorProfile.findMany({
    where: {
      user: { status: "APPROVED" },
      ...(opts.category ? { category: opts.category } : {}),
      ...(opts.q
        ? {
            OR: [
              { displayName: { contains: opts.q, mode: "insensitive" } },
              { username: { contains: opts.q, mode: "insensitive" } },
              { category: { contains: opts.q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ verificationStatus: "desc" }, { instagramFollowers: "desc" }, { createdAt: "desc" }],
    take: opts.limit ?? 60,
    select: {
      displayName: true,
      username: true,
      bio: true,
      profileImageUrl: true,
      category: true,
      location: true,
      instagramFollowers: true,
      youtubeSubscribers: true,
      engagementRate: true,
      verificationStatus: true,
    },
  });
}
