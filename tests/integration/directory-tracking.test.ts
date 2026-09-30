import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { createCampaign, transitionCampaign } from "@/lib/services/campaigns";
import { decideApplication, joinCampaign } from "@/lib/services/partners";
import { recordOrder, verifyConversion } from "@/lib/services/conversions";
import { recordClick } from "@/lib/services/tracking";
import { getBrandSeries, getBrandTrackingLinks, getPartnerCampaignPerformance, getPartnerSeries, parseRange } from "@/lib/services/metrics";
import { createAffiliateProgram, listPublicProgramsForBrand, reviewAffiliateProgram } from "@/lib/services/affiliate-programs";
import { getBrandCollaborators } from "@/lib/services/brands";
import { listDirectory } from "@/lib/services/directory";
import { affiliateProgramSchema } from "@/lib/validation/affiliate";
import { campaignValues, makeCreator, makeOwnerWithBrand, uniq } from "../helpers";

/**
 * Queries behind the redesigned pages: the unified programme directory, brand
 * tracking/analytics series, and the public brand profile tabs.
 */
let owner: Awaited<ReturnType<typeof makeOwnerWithBrand>>;
let campaignId: string;
let brandName: string;

const okLink = async () => ({ reachable: true, status: "ok 200", checkedAt: new Date() });

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

describe("programme directory and brand profile", () => {
  it("lists Refnivo campaigns and external programmes separately, with counts for every tab", async () => {
    const program = await createAffiliateProgram(
      owner.brand.id,
      owner.user.id,
      affiliateProgramSchema.parse({
        name: `${brandName} Affiliates`,
        signupUrl: `https://network.example.com/join/${uniq("u")}`,
        commissionType: "PERCENTAGE",
        commissionDescription: "Up to 8%",
        approvalType: "APPLICATION",
        category: "Electronics",
      }),
      { submit: true },
    );
    // Pending listings are not public.
    expect(await listPublicProgramsForBrand({ id: owner.brand.id, name: brandName })).toHaveLength(0);
    const reviewer = await prisma.user.create({ data: { name: "Admin", email: `${uniq("admin")}@test.local`, role: "ADMIN", status: "APPROVED" } });
    await reviewAffiliateProgram(reviewer.id, program.id, { decision: "APPROVE", verified: true }, { checkLink: okLink });

    const all = await listDirectory({ q: brandName });
    expect(all.items.map((i) => i.kind).sort()).toEqual(["EXTERNAL", "REFNIVO"]);
    expect(all.counts).toEqual({ all: 2, refnivo: 1, external: 1 });

    const ext = await listDirectory({ q: brandName, kind: "external" });
    expect(ext.items.map((i) => i.kind)).toEqual(["EXTERNAL"]);
    // Counts stay accurate while a tab is selected.
    expect(ext.counts).toEqual({ all: 2, refnivo: 1, external: 1 });

    const ref = await listDirectory({ q: brandName, kind: "refnivo" });
    expect(ref.items).toHaveLength(1);
    expect(ref.items[0].kind === "REFNIVO" && ref.items[0].campaign.id).toBe(campaignId);
    expect(ref.categories).toEqual(["Electronics"]); // "Headphones & audio" maps onto Electronics

    const none = await listDirectory({ q: brandName, category: "Fashion" });
    expect(none.items).toHaveLength(0);

    const listed = await listPublicProgramsForBrand({ id: owner.brand.id, name: brandName });
    expect(listed.map((p) => p.id)).toEqual([program.id]);
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
