import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { createCampaign, transitionCampaign } from "@/lib/services/campaigns";
import { decideApplication, joinCampaign } from "@/lib/services/partners";
import { recordOrder, verifyConversion } from "@/lib/services/conversions";
import { recordClick } from "@/lib/services/tracking";
import { getBrandSeries, getBrandTrackingLinks, getPartnerCampaignPerformance, getPartnerSeries, parseRange } from "@/lib/services/metrics";
import { getBrandCollaborators } from "@/lib/services/brands";
import { listDirectory } from "@/lib/services/directory";
import { campaignValues, makeCreator, makeOwnerWithBrand, uniq } from "../helpers";

/**
 * Queries behind the redesigned pages: the creator's campaign directory, brand
 * tracking/analytics series, and the public brand profile tabs.
 */
let owner: Awaited<ReturnType<typeof makeOwnerWithBrand>>;
let campaignId: string;
let brandName: string;

beforeAll(async () => {
  brandName = `Dir ${uniq("b")}`;
  owner = await makeOwnerWithBrand(brandName);
  const c = await createCampaign(owner.brand.id, owner.brand.name, owner.user.id, campaignValues(owner.product.id, { name: "Directory Campaign" }));
  await transitionCampaign(owner.brand.id, owner.user.id, c.id, "PUBLISH", { confirmed: true });
  campaignId = c.id;
});
afterAll(() => prisma.$disconnect());

async function approvedCreator() {
  const creator = await makeCreator();
  await prisma.user.update({ where: { id: creator.id }, data: { status: "APPROVED" } });
  await joinCampaign({ id: creator.id, name: creator.name, role: "CREATOR" }, campaignId);
  const app = await prisma.partnerApplication.findUniqueOrThrow({ where: { campaignId_userId: { campaignId, userId: creator.id } } });
  await decideApplication(owner.brand.id, owner.user.id, app.id, "APPROVED");
  const link = await prisma.referralLink.findUniqueOrThrow({ where: { campaignId_ownerId_source: { campaignId, ownerId: creator.id, source: "GENERAL" } } });
  return { creator, link };
}

describe("tracking and analytics series", () => {
  it("counts clicks, verified conversions, revenue and commission per link and per day", async () => {
    const { creator, link } = await approvedCreator();
    await recordClick({ linkId: link.id, campaignId, referrerId: creator.id, visitorId: uniq("v"), source: "LINK" });
    await recordClick({ linkId: link.id, campaignId, referrerId: creator.id, visitorId: uniq("v"), source: "QR" });
    const { referral } = await recordOrder(owner.brand.id, owner.user.id, { code: link.code, orderReference: uniq("ORD"), amountMinor: 100_000 });

    // Unverified orders are not conversions yet.
    let row = (await getBrandTrackingLinks(owner.brand.id)).find((r) => r.id === link.id)!;
    expect(row.clicks).toBe(2);
    expect(row.conversions).toBe(0);

    await verifyConversion(owner.brand.id, owner.user.id, referral.id);
    row = (await getBrandTrackingLinks(owner.brand.id, { campaignId, partnerType: "CREATOR" })).find((r) => r.id === link.id)!;
    expect(row).toMatchObject({ clicks: 2, conversions: 1, revenue: 100_000, commission: 10_000, partnerType: "CREATOR" });
    expect(await getBrandTrackingLinks(owner.brand.id, { partnerType: "CUSTOMER" })).not.toContainEqual(expect.objectContaining({ id: link.id }));

    const series = await getBrandSeries(owner.brand.id, 7);
    expect(series).toHaveLength(7);
    const today = series.at(-1)!;
    expect(today.clicks).toBeGreaterThanOrEqual(2);
    expect(today.conversions).toBeGreaterThanOrEqual(1);
    expect(today.revenue).toBeGreaterThanOrEqual(100_000);

    const mine = await getPartnerSeries(creator.id, 1);
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ clicks: 2, conversions: 1, revenue: 100_000 });
    const perf = await getPartnerCampaignPerformance(creator.id);
    expect(perf.length).toBeGreaterThan(0);
  });

  it("accepts only the offered ranges", () => {
    expect(parseRange("7")).toBe(7);
    expect(parseRange("1")).toBe(1);
    expect(parseRange("13")).toBe(30);
    expect(parseRange(undefined, 90)).toBe(90);
  });
});

describe("campaign directory and brand profile", () => {
  it("lists live Refnivo campaigns with search, category chips and category filter", async () => {
    const all = await listDirectory({ q: brandName });
    expect(all.total).toBe(1);
    expect(all.items[0].campaign.id).toBe(campaignId);
    expect(all.items[0].commission).toMatch(/per sale|Customer rewards/);
    expect(all.categories).toEqual(["Electronics"]); // "Headphones & audio" maps onto Electronics

    expect((await listDirectory({ q: brandName, category: "Electronics" })).total).toBe(1);
    expect((await listDirectory({ q: brandName, category: "Fashion" })).items).toHaveLength(0);
    expect((await listDirectory({ q: `${brandName}-no-such-brand` })).total).toBe(0);
  });

  it("only lists campaigns that are live, and pages results", async () => {
    const tag = uniq("Page");
    const o = await makeOwnerWithBrand(`${tag} brand`);
    const draft = await createCampaign(o.brand.id, o.brand.name, o.user.id, campaignValues(o.product.id, { name: `${tag} draft` }));
    expect((await listDirectory({ q: tag })).total).toBe(0); // drafts are not listed
    await transitionCampaign(o.brand.id, o.user.id, draft.id, "PUBLISH", { confirmed: true });
    expect((await listDirectory({ q: tag })).total).toBe(1);

    const page1 = await listDirectory({ q: brandName.split(" ")[0] }, 1);
    expect(page1.items.length).toBeLessThanOrEqual(1);
    expect(page1.total).toBeGreaterThanOrEqual(page1.items.length);
    // Unknown sort values fall back to "newest" instead of failing.
    expect((await listDirectory({ q: tag, sort: "commission" })).total).toBe(1);
  });

  it("shows only approved or connected creators as collaborations, without social numbers", async () => {
    const { creator } = await approvedCreator();
    const pending = await makeCreator();
    await prisma.user.update({ where: { id: pending.id }, data: { status: "APPROVED" } });
    await joinCampaign({ id: pending.id, name: pending.name, role: "CREATOR" }, campaignId);

    const rows = await getBrandCollaborators(owner.brand.id, 100);
    const usernames = rows.map((r) => r.username);
    const profile = await prisma.creatorProfile.findUniqueOrThrow({ where: { userId: creator.id } });
    const pendingProfile = await prisma.creatorProfile.findUniqueOrThrow({ where: { userId: pending.id } });
    expect(usernames).toContain(profile.username);
    expect(usernames).not.toContain(pendingProfile.username);
    expect(JSON.stringify(rows)).not.toContain("instagramFollowers");
  });
});
