import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { createCampaign, transitionCampaign } from "@/lib/services/campaigns";
import { recordOrder, verifyConversion } from "@/lib/services/conversions";
import { joinCampaign } from "@/lib/services/partners";
import { disconnectSocialAccount, listSocialAccounts, SocialAccountError, upsertSocialAccount } from "@/lib/services/social-accounts";
import { campaignValues, makeCreator, makeOwnerWithBrand, uniq } from "../helpers";

/**
 * Storing and removing a linked account. The rule that matters: disconnecting
 * destroys the tokens but never the creator's earnings history.
 */
const KEY = Buffer.alloc(32, 5).toString("base64");
const profile = (id: string, followers: number | null = 12400) => ({
  providerAccountId: id,
  handle: "@creator",
  profileUrl: "https://www.instagram.com/creator/",
  avatarUrl: null,
  followers,
});
const tokens = { accessToken: "access-token-value", refreshToken: "refresh-token-value", expiresAt: null, scopes: ["instagram_basic"] };

beforeAll(() => {
  process.env.SOCIAL_TOKEN_ENCRYPTION_KEY = KEY;
});
afterAll(() => prisma.$disconnect());

describe("linking an account", () => {
  it("stores the profile, encrypts the tokens, and never returns them", async () => {
    const creator = await makeCreator();
    const shown = await upsertSocialAccount({ userId: creator.id, platform: "INSTAGRAM", profile: profile(`ig_${uniq("a")}`), tokens });
    expect(shown).toMatchObject({ platform: "INSTAGRAM", handle: "@creator", followers: 12400 });
    expect(JSON.stringify(shown)).not.toContain("access-token-value");

    const row = await prisma.socialAccount.findUniqueOrThrow({ where: { userId_platform: { userId: creator.id, platform: "INSTAGRAM" } } });
    expect(row.accessToken).not.toBeNull();
    expect(row.accessToken).not.toContain("access-token-value"); // encrypted at rest
    expect(row.refreshToken).not.toContain("refresh-token-value");
    expect(row.followersSyncedAt).not.toBeNull();
  });

  it("stores an unknown follower count as null rather than zero", async () => {
    const creator = await makeCreator();
    const shown = await upsertSocialAccount({ userId: creator.id, platform: "LINKEDIN", profile: profile(`li_${uniq("a")}`, null), tokens });
    expect(shown.followers).toBeNull();
    expect(shown.followersSyncedAt).toBeNull();
    expect(shown.followersUnavailableReason).toBeTruthy();
  });

  it("refuses to link the same platform account to a second Refnivo user", async () => {
    const first = await makeCreator();
    const second = await makeCreator();
    const shared = `ig_${uniq("a")}`;
    await upsertSocialAccount({ userId: first.id, platform: "INSTAGRAM", profile: profile(shared), tokens });
    await expect(upsertSocialAccount({ userId: second.id, platform: "INSTAGRAM", profile: profile(shared), tokens })).rejects.toBeInstanceOf(SocialAccountError);
  });

  it("re-linking the same platform updates in place instead of adding a row", async () => {
    const creator = await makeCreator();
    await upsertSocialAccount({ userId: creator.id, platform: "YOUTUBE", profile: profile(`yt_${uniq("a")}`, 100), tokens });
    await upsertSocialAccount({ userId: creator.id, platform: "YOUTUBE", profile: { ...profile(`yt_${uniq("a")}`, 250), handle: "@newhandle" }, tokens });
    const rows = await prisma.socialAccount.findMany({ where: { userId: creator.id, platform: "YOUTUBE" } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ handle: "@newhandle", followers: 250 });
  });
});

describe("disconnecting", () => {
  it("destroys the tokens but keeps every referral, order and commission the creator earned", async () => {
    const owner = await makeOwnerWithBrand(`Social ${uniq("b")}`);
    const campaign = await createCampaign(
      owner.brand.id,
      owner.brand.name,
      owner.user.id,
      campaignValues(owner.product.id, { name: `Social ${uniq("c")}`, requiresApproval: false, creatorCommissionType: "FIXED_AMOUNT", creatorCommissionValue: 600 }),
    );
    await transitionCampaign(owner.brand.id, owner.user.id, campaign.id, "PUBLISH", { confirmed: true });

    const creator = await makeCreator();
    const { code } = await joinCampaign({ id: creator.id, name: creator.name, role: "CREATOR" }, campaign.id);
    const order = await recordOrder(owner.brand.id, owner.user.id, { code: code!, orderReference: uniq("ORD"), amountMinor: 250_000 });
    await verifyConversion(owner.brand.id, owner.user.id, order.referral.id);
    await upsertSocialAccount({ userId: creator.id, platform: "INSTAGRAM", profile: profile(`ig_${uniq("a")}`), tokens });

    const before = {
      links: await prisma.referralLink.count({ where: { ownerId: creator.id } }),
      referrals: await prisma.referral.count({ where: { referrerId: creator.id } }),
      commissions: await prisma.commission.count({ where: { creatorId: creator.id } }),
    };

    await disconnectSocialAccount(creator.id, "INSTAGRAM");

    const row = await prisma.socialAccount.findUniqueOrThrow({ where: { userId_platform: { userId: creator.id, platform: "INSTAGRAM" } } });
    expect(row).toMatchObject({ status: "DISCONNECTED", accessToken: null, refreshToken: null, followers: null });
    expect(row.scopes).toEqual([]);
    // History is untouched.
    expect(await prisma.referralLink.count({ where: { ownerId: creator.id } })).toBe(before.links);
    expect(await prisma.referral.count({ where: { referrerId: creator.id } })).toBe(before.referrals);
    expect(await prisma.commission.count({ where: { creatorId: creator.id } })).toBe(before.commissions);
    expect((await prisma.commission.findFirstOrThrow({ where: { creatorId: creator.id } })).status).toBe("APPROVED");
    // And it no longer shows as a connected account.
    expect(await listSocialAccounts(creator.id)).toHaveLength(0);
  });

  it("refuses to disconnect something that is not connected", async () => {
    const creator = await makeCreator();
    await expect(disconnectSocialAccount(creator.id, "X")).rejects.toBeInstanceOf(SocialAccountError);
  });
});
