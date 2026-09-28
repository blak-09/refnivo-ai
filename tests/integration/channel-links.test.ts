import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { createCampaign, transitionCampaign } from "@/lib/services/campaigns";
import { ChannelLinkError, brandSourcePerformance, createChannelLink, listPartnerChannelLinks, partnerSourcePerformance } from "@/lib/services/channel-links";
import { recordOrder, verifyConversion } from "@/lib/services/conversions";
import { joinCampaign } from "@/lib/services/partners";
import { recordClick, resolveReferralCode } from "@/lib/services/tracking";
import { isReferralCodeFormat } from "@/lib/utils/codes";
import { campaignValues, makeCreator, makeOwnerWithBrand, uniq } from "../helpers";

/**
 * Channel links: one referral link per platform for the same campaign, with the
 * platform carried by the link itself — the only honest way to say which
 * channel produced a sale.
 */
let owner: Awaited<ReturnType<typeof makeOwnerWithBrand>>;
let campaign: { id: string };
let creator: Awaited<ReturnType<typeof makeCreator>>;
let generalCode: string;

beforeAll(async () => {
  owner = await makeOwnerWithBrand(`Channel ${uniq("b")}`);
  campaign = await createCampaign(
    owner.brand.id,
    owner.brand.name,
    owner.user.id,
    campaignValues(owner.product.id, { name: `Channel ${uniq("c")}`, requiresApproval: false, creatorCommissionType: "PERCENTAGE", creatorCommissionValue: 10 }),
  );
  await transitionCampaign(owner.brand.id, owner.user.id, campaign.id, "PUBLISH", { confirmed: true });
  creator = await makeCreator();
  const joined = await joinCampaign({ id: creator.id, name: creator.name, role: "CREATOR" }, campaign.id);
  generalCode = joined.code!;
});

afterAll(() => prisma.$disconnect());

describe("issuing channel links", () => {
  it("gives the same campaign one link per platform, each a valid resolvable code", async () => {
    const ig = await createChannelLink({ ownerId: creator.id, campaignId: campaign.id, source: "INSTAGRAM" });
    const yt = await createChannelLink({ ownerId: creator.id, campaignId: campaign.id, source: "YOUTUBE" });

    expect(ig.code).toMatch(/-IG$/);
    expect(yt.code).toMatch(/-YT$/);
    expect(ig.code).not.toBe(yt.code);
    expect(ig.code).not.toBe(generalCode);
    // The public code format accepts the channel suffix, so /r/CODE resolves it.
    expect(isReferralCodeFormat(ig.code)).toBe(true);
    const resolved = await resolveReferralCode(ig.code);
    expect(resolved.ok).toBe(true);

    const all = await listPartnerChannelLinks(creator.id);
    expect(all.filter((l) => l.campaign.id === campaign.id).map((l) => l.source).sort()).toEqual(["GENERAL", "INSTAGRAM", "YOUTUBE"]);
  });

  it("is idempotent: asking again returns the same link rather than a second one", async () => {
    const first = await createChannelLink({ ownerId: creator.id, campaignId: campaign.id, source: "X" });
    const again = await createChannelLink({ ownerId: creator.id, campaignId: campaign.id, source: "X" });
    expect(again.id).toBe(first.id);
    expect(await prisma.referralLink.count({ where: { ownerId: creator.id, campaignId: campaign.id, source: "X" } })).toBe(1);
  });

  it("refuses a channel link for someone who has not joined, or for a campaign that is not running", async () => {
    const outsider = await makeCreator();
    await expect(createChannelLink({ ownerId: outsider.id, campaignId: campaign.id, source: "INSTAGRAM" })).rejects.toBeInstanceOf(ChannelLinkError);

    const paused = await createCampaign(
      owner.brand.id,
      owner.brand.name,
      owner.user.id,
      campaignValues(owner.product.id, { name: `Paused ${uniq("c")}`, requiresApproval: false }),
    );
    await transitionCampaign(owner.brand.id, owner.user.id, paused.id, "PUBLISH", { confirmed: true });
    const joiner = await makeCreator();
    await joinCampaign({ id: joiner.id, name: joiner.name, role: "CREATOR" }, paused.id);
    await transitionCampaign(owner.brand.id, owner.user.id, paused.id, "PAUSE");
    await expect(createChannelLink({ ownerId: joiner.id, campaignId: paused.id, source: "YOUTUBE" })).rejects.toThrow(/not running/i);
  });
});

describe("attribution by channel", () => {
  it("credits clicks and verified revenue to the channel whose link was used, and to no other", async () => {
    const ig = await prisma.referralLink.findFirstOrThrow({ where: { ownerId: creator.id, campaignId: campaign.id, source: "INSTAGRAM" } });
    const yt = await prisma.referralLink.findFirstOrThrow({ where: { ownerId: creator.id, campaignId: campaign.id, source: "YOUTUBE" } });

    // Two clicks on Instagram (one a QR scan), one on YouTube.
    await recordClick({ linkId: ig.id, campaignId: campaign.id, referrerId: creator.id, visitorId: uniq("v"), source: "LINK", ip: null, userAgent: null, referer: null });
    await recordClick({ linkId: ig.id, campaignId: campaign.id, referrerId: creator.id, visitorId: uniq("v"), source: "QR", ip: null, userAgent: null, referer: null });
    await recordClick({ linkId: yt.id, campaignId: campaign.id, referrerId: creator.id, visitorId: uniq("v"), source: "LINK", ip: null, userAgent: null, referer: null });

    // One verified ₹2,000 order through the YouTube link only.
    const order = await recordOrder(owner.brand.id, owner.user.id, { code: yt.code, orderReference: uniq("ORD"), amountMinor: 200_000 });
    await verifyConversion(owner.brand.id, owner.user.id, order.referral.id);

    const perf = await partnerSourcePerformance(creator.id);
    const bySource = Object.fromEntries(perf.map((p) => [p.source, p]));

    expect(bySource.YOUTUBE).toMatchObject({ clicks: 1, orders: 1, revenue: 200_000, commission: 20_000 }); // 10% of ₹2,000
    expect(bySource.INSTAGRAM).toMatchObject({ clicks: 2, qrScans: 1, orders: 0, revenue: 0, commission: 0 });
    expect(bySource.YOUTUBE.conversionRate).toBe(1);
    expect(bySource.INSTAGRAM.conversionRate).toBe(0);
    // A channel the creator never shared on simply is not listed — nothing is invented.
    expect(bySource.LINKEDIN).toBeUndefined();
  });

  it("gives the brand the same breakdown across its partners", async () => {
    const perf = await brandSourcePerformance(owner.brand.id);
    const youtube = perf.find((p) => p.source === "YOUTUBE");
    expect(youtube).toMatchObject({ orders: 1, revenue: 200_000 });
    // Another brand sees none of it.
    const other = await makeOwnerWithBrand(`Other ${uniq("b")}`);
    expect(await brandSourcePerformance(other.brand.id)).toEqual([]);
  });

  it("does not count an unverified order as revenue", async () => {
    const ig = await prisma.referralLink.findFirstOrThrow({ where: { ownerId: creator.id, campaignId: campaign.id, source: "INSTAGRAM" } });
    await recordOrder(owner.brand.id, owner.user.id, { code: ig.code, orderReference: uniq("ORD"), amountMinor: 500_000 });
    const perf = await partnerSourcePerformance(creator.id);
    // Still zero: the brand has not verified it.
    expect(perf.find((p) => p.source === "INSTAGRAM")).toMatchObject({ orders: 0, revenue: 0, commission: 0 });
  });
});
