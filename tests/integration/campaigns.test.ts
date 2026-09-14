import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import {
  CampaignError,
  createCampaign,
  deleteDraftCampaign,
  getCampaign,
  listCampaigns,
  listMarketplaceCampaigns,
  transitionCampaign,
  updateCampaign,
} from "@/lib/services/campaigns";
import { campaignValues, makeOwnerWithBrand } from "../helpers";

let a: Awaited<ReturnType<typeof makeOwnerWithBrand>>;
let b: Awaited<ReturnType<typeof makeOwnerWithBrand>>;

beforeAll(async () => {
  a = await makeOwnerWithBrand("Campaign Test A");
  b = await makeOwnerWithBrand("Campaign Test B");
});
afterAll(() => prisma.$disconnect());

const create = (ctx: typeof a, overrides: Partial<Record<string, unknown>> = {}) =>
  createCampaign(ctx.brand.id, ctx.brand.name, ctx.user.id, campaignValues(ctx.product.id, overrides));

describe("campaign CRUD", () => {
  it("creates a draft tied to a product, money in minor units / basis points", async () => {
    const c = await create(a);
    expect(c.status).toBe("DRAFT");
    expect(c.productId).toBe(a.product.id);
    expect(c.customerRewardValue).toBe(5_000);
    expect(c.creatorCommissionValue).toBe(1_000);
    expect(c.requiresApproval).toBe(true);
    expect(c.slug).toBe("campaign-test-a-launch-campaign");
    expect((await prisma.auditLog.findFirst({ where: { entityId: c.id, action: "CAMPAIGN_CREATED" } }))?.userId).toBe(a.user.id);
  });

  it("rejects a product that belongs to another brand", async () => {
    await expect(createCampaign(a.brand.id, a.brand.name, a.user.id, campaignValues(b.product.id))).rejects.toThrow(/own products/i);
  });

  it("slugs are globally unique", async () => {
    const c1 = await create(a, { name: "Same Name" });
    const c2 = await create(a, { name: "Same Name" });
    expect(c1.slug).toBe("campaign-test-a-same-name");
    expect(c2.slug).toBe("campaign-test-a-same-name-2");
  });

  it("updates rewards and records the change; product locked after publish", async () => {
    const c = await create(a);
    const updated = await updateCampaign(a.brand.id, a.brand.name, a.user.id, c.id, campaignValues(a.product.id, { rewardType: "PERCENTAGE", customerRewardValue: 12.5, creatorCommissionType: "FIXED_AMOUNT", creatorCommissionValue: 150 }));
    expect(updated.customerRewardValue).toBe(1_250);
    expect(updated.creatorCommissionValue).toBe(15_000);
    const audit = await prisma.auditLog.findFirst({ where: { entityId: c.id, action: "CAMPAIGN_UPDATED" } });
    expect((audit?.metadata as { rewardChanged: boolean }).rewardChanged).toBe(true);

    await transitionCampaign(a.brand.id, a.user.id, c.id, "PUBLISH", { confirmed: true });
    const other = await prisma.product.create({ data: { brandId: a.brand.id, name: "Other", slug: `other-${c.id}`, price: 100, purchaseUrl: "https://example.com" } });
    await expect(updateCampaign(a.brand.id, a.brand.name, a.user.id, c.id, campaignValues(other.id))).rejects.toThrow(/product cannot be changed/i);
  });

  it("brand B cannot read, edit, transition or delete brand A's campaign", async () => {
    const c = await create(a, { name: "Private" });
    expect(await getCampaign(b.brand.id, c.id)).toBeNull();
    expect((await listCampaigns(b.brand.id)).some((x) => x.id === c.id)).toBe(false);
    await expect(updateCampaign(b.brand.id, b.brand.name, b.user.id, c.id, campaignValues(b.product.id))).rejects.toBeInstanceOf(CampaignError);
    await expect(transitionCampaign(b.brand.id, b.user.id, c.id, "PUBLISH", { confirmed: true })).rejects.toBeInstanceOf(CampaignError);
    await expect(deleteDraftCampaign(b.brand.id, b.user.id, c.id)).rejects.toBeInstanceOf(CampaignError);
    expect((await getCampaign(a.brand.id, c.id))?.status).toBe("DRAFT");
  });
});

describe("campaign lifecycle", () => {
  it("publishing requires confirmation and passes validation", async () => {
    const c = await create(a);
    await expect(transitionCampaign(a.brand.id, a.user.id, c.id, "PUBLISH")).rejects.toThrow(/confirm/i);
    const published = await transitionCampaign(a.brand.id, a.user.id, c.id, "PUBLISH", { confirmed: true });
    expect(published.status).toBe("ACTIVE");
    expect(published.publishedAt).not.toBeNull();
  });

  it("cannot publish with a past end date or a zero creator commission", async () => {
    const past = await create(a, { startDate: "2025-01-01", endDate: "2025-02-01" });
    await expect(transitionCampaign(a.brand.id, a.user.id, past.id, "PUBLISH", { confirmed: true })).rejects.toThrow(/past/i);
    expect(() => campaignValues(a.product.id, { campaignType: "CREATOR_AFFILIATE", creatorCommissionValue: 0 })).toThrow(); // schema blocks it
    const zero = await create(a, { campaignType: "CREATOR_AFFILIATE" });
    await prisma.campaign.update({ where: { id: zero.id }, data: { creatorCommissionValue: 0 } });
    await expect(transitionCampaign(a.brand.id, a.user.id, zero.id, "PUBLISH", { confirmed: true })).rejects.toThrow(/commission/i);
  });

  it("creator-only campaigns may have a zero customer reward", async () => {
    const c = await create(a, { campaignType: "CREATOR_AFFILIATE", customerRewardValue: 0 });
    expect((await transitionCampaign(a.brand.id, a.user.id, c.id, "PUBLISH", { confirmed: true })).status).toBe("ACTIVE");
  });

  it("pause → resume → end → archive, invalid transitions rejected, audit trail complete", async () => {
    const c = await create(a);
    await transitionCampaign(a.brand.id, a.user.id, c.id, "PUBLISH", { confirmed: true });
    await expect(transitionCampaign(a.brand.id, a.user.id, c.id, "PUBLISH", { confirmed: true })).rejects.toBeInstanceOf(CampaignError);
    expect((await transitionCampaign(a.brand.id, a.user.id, c.id, "PAUSE")).status).toBe("PAUSED");
    expect((await transitionCampaign(a.brand.id, a.user.id, c.id, "RESUME")).status).toBe("ACTIVE");
    expect((await transitionCampaign(a.brand.id, a.user.id, c.id, "END")).status).toBe("ENDED");
    await expect(transitionCampaign(a.brand.id, a.user.id, c.id, "RESUME")).rejects.toBeInstanceOf(CampaignError);
    await expect(updateCampaign(a.brand.id, a.brand.name, a.user.id, c.id, campaignValues(a.product.id))).rejects.toThrow(/cannot be edited/i);
    expect((await transitionCampaign(a.brand.id, a.user.id, c.id, "ARCHIVE")).status).toBe("ARCHIVED");
    const logs = await prisma.auditLog.findMany({ where: { entityId: c.id }, orderBy: { createdAt: "asc" } });
    expect(logs.map((l) => l.action)).toEqual(["CAMPAIGN_CREATED", "CAMPAIGN_PUBLISH", "CAMPAIGN_PAUSE", "CAMPAIGN_RESUME", "CAMPAIGN_END", "CAMPAIGN_ARCHIVE"]);
  });

  it("only drafts can be deleted", async () => {
    const draft = await create(a);
    const live = await create(a);
    await transitionCampaign(a.brand.id, a.user.id, live.id, "PUBLISH", { confirmed: true });
    await expect(deleteDraftCampaign(a.brand.id, a.user.id, live.id)).rejects.toThrow(/draft/i);
    await deleteDraftCampaign(a.brand.id, a.user.id, draft.id);
    expect(await getCampaign(a.brand.id, draft.id)).toBeNull();
  });
});

describe("marketplace", () => {
  it("lists only live campaigns and sorts by commission value", async () => {
    const ctx = await makeOwnerWithBrand("Market Brand");
    const low = await create(ctx, { name: "Low", creatorCommissionType: "FIXED_AMOUNT", creatorCommissionValue: 20 });
    const high = await create(ctx, { name: "High", creatorCommissionType: "PERCENTAGE", creatorCommissionValue: 20 }); // 20% of ₹1499 = ₹299.80
    const draft = await create(ctx, { name: "Draft" });
    const future = await create(ctx, { name: "Future", startDate: "2099-01-01" });
    await transitionCampaign(ctx.brand.id, ctx.user.id, low.id, "PUBLISH", { confirmed: true });
    await transitionCampaign(ctx.brand.id, ctx.user.id, high.id, "PUBLISH", { confirmed: true });
    await transitionCampaign(ctx.brand.id, ctx.user.id, future.id, "PUBLISH", { confirmed: true });

    const rows = await listMarketplaceCampaigns({ q: "Market Brand", sort: "commission" });
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(low.id);
    expect(ids).toContain(high.id);
    expect(ids).not.toContain(draft.id);
    expect(ids).not.toContain(future.id);
    expect(ids.indexOf(high.id)).toBeLessThan(ids.indexOf(low.id));
    expect(rows.find((r) => r.id === high.id)?.product.name).toBe("Test Headphones");
  });
});
