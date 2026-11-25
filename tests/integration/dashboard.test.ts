import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { createCampaign, transitionCampaign } from "@/lib/services/campaigns";
import { recordOrder } from "@/lib/services/conversions";
import { getBrandAttention, recommendCampaigns } from "@/lib/services/dashboard";
import { joinCampaign } from "@/lib/services/partners";
import { campaignValues, makeCreator, makeCustomer, makeOwnerWithBrand, uniq } from "../helpers";

/** Dashboard overview queries are read-only and reflect the same rows the detail pages show. */

async function liveCampaign(owner: Awaited<ReturnType<typeof makeOwnerWithBrand>>, overrides: Record<string, unknown> = {}) {
  const campaign = await createCampaign(owner.brand.id, owner.brand.name, owner.user.id, campaignValues(owner.product.id, { name: `Dash ${uniq("c")}`, ...overrides }));
  await transitionCampaign(owner.brand.id, owner.user.id, campaign.id, "PUBLISH", { confirmed: true });
  return campaign;
}

afterAll(() => prisma.$disconnect());

describe("getBrandAttention", () => {
  it("counts orders to verify and pending applications for this brand only", async () => {
    const owner = await makeOwnerWithBrand(`Dash ${uniq("b")}`);
    const empty = await getBrandAttention(owner.brand.id);
    expect(empty).toMatchObject({ ordersToVerify: 0, applications: 0, buyerClaims: 0, incomingConnections: 0, ugcToReview: 0, ugcToPay: 0, campaignsInReview: 0 });

    const instant = await liveCampaign(owner, { requiresApproval: false });
    const gated = await liveCampaign(owner, { requiresApproval: true });
    const creator = await makeCreator();
    const { code } = await joinCampaign({ id: creator.id, name: creator.name, role: "CREATOR" }, instant.id);
    const applicant = await makeCreator();
    await joinCampaign({ id: applicant.id, name: applicant.name, role: "CREATOR" }, gated.id);
    await recordOrder(owner.brand.id, owner.user.id, { code: code!, orderReference: uniq("ORD"), amountMinor: 150_000 });

    const attention = await getBrandAttention(owner.brand.id);
    expect(attention.ordersToVerify).toBe(1);
    expect(attention.applications).toBe(1);

    // Another brand's dashboard is unaffected.
    const other = await makeOwnerWithBrand(`Dash ${uniq("b")}`);
    expect((await getBrandAttention(other.brand.id)).ordersToVerify).toBe(0);
  });
});

describe("recommendCampaigns", () => {
  it("puts campaigns in the partner's categories first and skips joined ones", async () => {
    const category = `Dash category ${uniq("cat")}`;
    const owner = await makeOwnerWithBrand(`Dash ${uniq("b")}`);
    await prisma.product.update({ where: { id: owner.product.id }, data: { category } });
    const matching = await liveCampaign(owner, { requiresApproval: false });

    const creator = await makeCreator();
    const before = await recommendCampaigns({ userId: creator.id, audience: "CREATOR", categories: [category], limit: 50 });
    expect(before.matched).toBe(true);
    expect(before.campaigns[0]?.id).toBe(matching.id);

    await joinCampaign({ id: creator.id, name: creator.name, role: "CREATOR" }, matching.id);
    const after = await recommendCampaigns({ userId: creator.id, audience: "CREATOR", categories: [category], limit: 50 });
    expect(after.campaigns.map((c) => c.id)).not.toContain(matching.id);
    expect(after.matched).toBe(false);
  });

  it("never offers creator-only campaigns to customers, or customer-only campaigns to creators", async () => {
    const owner = await makeOwnerWithBrand(`Dash ${uniq("b")}`);
    const creatorOnly = await liveCampaign(owner, { campaignType: "CREATOR_AFFILIATE", requiresApproval: false });
    const customerOnly = await liveCampaign(owner, { campaignType: "CUSTOMER_REFERRAL", requiresApproval: false });
    const customer = await makeCustomer();
    const creator = await makeCreator();

    const forCustomer = (await recommendCampaigns({ userId: customer.id, audience: "CUSTOMER", categories: [], limit: 500 })).campaigns.map((c) => c.id);
    expect(forCustomer).not.toContain(creatorOnly.id);
    expect(forCustomer).toContain(customerOnly.id);

    const forCreator = (await recommendCampaigns({ userId: creator.id, audience: "CREATOR", categories: [], limit: 500 })).campaigns.map((c) => c.id);
    expect(forCreator).toContain(creatorOnly.id);
    expect(forCreator).not.toContain(customerOnly.id);
  });
});
