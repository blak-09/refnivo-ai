import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { createCampaign, transitionCampaign } from "@/lib/services/campaigns";
import { decideApplication, joinCampaign, listPartnerApplications, PartnerError } from "@/lib/services/partners";
import { ConversionError, recordOrder, rejectConversion, verifyConversion } from "@/lib/services/conversions";
import { recordClick, resolveReferralCode } from "@/lib/services/tracking";
import { getBrandOverview, getCampaignBreakdown, getPartnerStats, getTopCreators } from "@/lib/services/metrics";
import { buildInsight } from "@/lib/domain/insights";
import { isReferralCodeFormat } from "@/lib/utils/codes";
import { campaignValues, makeCreator, makeCustomer, makeOwnerWithBrand, uniq } from "../helpers";

let a: Awaited<ReturnType<typeof makeOwnerWithBrand>>;
let b: Awaited<ReturnType<typeof makeOwnerWithBrand>>;
let campaignId: string;

beforeAll(async () => {
  a = await makeOwnerWithBrand("Partner Test A");
  b = await makeOwnerWithBrand("Partner Test B");
  const c = await createCampaign(a.brand.id, a.brand.name, a.user.id, campaignValues(a.product.id, { name: "Partner Campaign" }));
  await transitionCampaign(a.brand.id, a.user.id, c.id, "PUBLISH", { confirmed: true });
  campaignId = c.id;
});
afterAll(() => prisma.$disconnect());

describe("joining campaigns", () => {
  it("creators on approval-required campaigns get a PENDING application; approval issues a human-readable link", async () => {
    const creator = await makeCreator({ username: "arjun_test" });
    const joined = await joinCampaign({ id: creator.id, name: creator.name, role: "CREATOR" }, campaignId, "Hi");
    expect(joined).toEqual({ status: "PENDING", code: null });

    const pending = await listPartnerApplications(a.brand.id, "PENDING");
    const app = pending.find((p) => p.user.id === creator.id)!;
    expect(app).toBeDefined();
    expect(app.user.creatorProfile?.instagramFollowers).toBe(1000);
    expect(JSON.stringify(pending)).not.toContain(creator.email); // no contact details exposed

    await decideApplication(a.brand.id, a.user.id, app.id, "APPROVED");
    const link = await prisma.referralLink.findUniqueOrThrow({ where: { campaignId_ownerId: { campaignId, ownerId: creator.id } } });
    expect(link.code.startsWith("ARJUNTEST-PARTNERT-")).toBe(true);
    expect(isReferralCodeFormat(link.code)).toBe(true);
    await expect(decideApplication(a.brand.id, a.user.id, app.id, "REJECTED")).rejects.toBeInstanceOf(PartnerError);

    // Re-joining is idempotent and returns the code.
    expect(await joinCampaign({ id: creator.id, name: creator.name, role: "CREATOR" }, campaignId)).toEqual({ status: "APPROVED", code: link.code });
  });

  it("customers join instantly and get a link", async () => {
    const customer = await makeCustomer();
    const joined = await joinCampaign({ id: customer.id, name: customer.name, role: "CUSTOMER" }, campaignId);
    expect(joined.status).toBe("APPROVED");
    // Customer codes never embed the customer's (real) name.
    expect(joined.code).toMatch(/^C-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/);
  });

  it("creators join instantly when the campaign does not require approval", async () => {
    const open = await createCampaign(a.brand.id, a.brand.name, a.user.id, campaignValues(a.product.id, { name: "Open", requiresApproval: false }));
    await transitionCampaign(a.brand.id, a.user.id, open.id, "PUBLISH", { confirmed: true });
    const creator = await makeCreator();
    expect((await joinCampaign({ id: creator.id, name: creator.name, role: "CREATOR" }, open.id)).status).toBe("APPROVED");
  });

  it("blocks joining draft/paused campaigns, own campaigns and wrong partner types", async () => {
    const draft = await createCampaign(a.brand.id, a.brand.name, a.user.id, campaignValues(a.product.id));
    const creator = await makeCreator();
    await expect(joinCampaign({ id: creator.id, name: creator.name, role: "CREATOR" }, draft.id)).rejects.toThrow(/not accepting/i);
    await expect(joinCampaign({ id: a.user.id, name: a.user.name, role: "CUSTOMER" }, campaignId)).rejects.toThrow(/own campaign/i);
    const creatorOnly = await createCampaign(a.brand.id, a.brand.name, a.user.id, campaignValues(a.product.id, { campaignType: "CREATOR_AFFILIATE", customerRewardValue: 0 }));
    await transitionCampaign(a.brand.id, a.user.id, creatorOnly.id, "PUBLISH", { confirmed: true });
    const customer = await makeCustomer();
    await expect(joinCampaign({ id: customer.id, name: customer.name, role: "CUSTOMER" }, creatorOnly.id)).rejects.toThrow(/creators only/i);
  });

  it("another brand cannot decide applications it does not own", async () => {
    const creator = await makeCreator();
    await joinCampaign({ id: creator.id, name: creator.name, role: "CREATOR" }, campaignId);
    const app = await prisma.partnerApplication.findUniqueOrThrow({ where: { campaignId_userId: { campaignId, userId: creator.id } } });
    await expect(decideApplication(b.brand.id, b.user.id, app.id, "APPROVED")).rejects.toBeInstanceOf(PartnerError);
    expect((await listPartnerApplications(b.brand.id)).some((p) => p.id === app.id)).toBe(false);
  });
});

describe("tracking, orders and ledger", () => {
  async function approvedCreatorLink() {
    const creator = await makeCreator();
    await joinCampaign({ id: creator.id, name: creator.name, role: "CREATOR" }, campaignId);
    const app = await prisma.partnerApplication.findUniqueOrThrow({ where: { campaignId_userId: { campaignId, userId: creator.id } } });
    await decideApplication(a.brand.id, a.user.id, app.id, "APPROVED");
    const link = await prisma.referralLink.findUniqueOrThrow({ where: { campaignId_ownerId: { campaignId, ownerId: creator.id } } });
    return { creator, link };
  }

  it("resolves codes, records clicks (link + QR) and one referral session per visitor", async () => {
    const { link } = await approvedCreatorLink();
    const resolved = await resolveReferralCode(link.code.toLowerCase());
    expect(resolved.ok).toBe(true);
    expect(await resolveReferralCode("NOPE-NOPE-XXXX")).toEqual({ ok: false, reason: "NOT_FOUND" });

    const base = { linkId: link.id, campaignId, referrerId: link.ownerId, visitorId: "visitor-1" as string };
    const t0 = new Date();
    await recordClick({ ...base, source: "LINK" }, t0);
    // Repeat hits inside the de-duplication window are not counted; a later QR scan is.
    expect((await recordClick({ ...base, source: "LINK" }, new Date(t0.getTime() + 1000))).counted).toBe(false);
    await recordClick({ ...base, source: "QR" }, new Date(t0.getTime() + 60_000));
    await recordClick({ ...base, source: "LINK", visitorId: "visitor-2" }, t0);
    expect(await prisma.referralClick.count({ where: { referralLinkId: link.id } })).toBe(3);
    expect(await prisma.referralClick.count({ where: { referralLinkId: link.id, source: "QR" } })).toBe(1);
    expect(await prisma.referral.count({ where: { referralLinkId: link.id, status: "CLICKED" } })).toBe(2);
  });

  it("records an order, computes a pending commission, verifies it → approved, and blocks duplicates", async () => {
    const { creator, link } = await approvedCreatorLink();
    const { referral } = await recordOrder(a.brand.id, a.user.id, { code: link.code, orderReference: `ORD-${link.code}-1`, amountMinor: 149_900 });
    expect(referral.status).toBe("PURCHASED");
    const commission = await prisma.commission.findFirstOrThrow({ where: { referralId: referral.id } });
    expect(commission.amount).toBe(14_990); // 10% of ₹1,499
    expect(commission.status).toBe("PENDING");

    let stats = await getPartnerStats(creator.id);
    expect(stats.commissionPending).toBe(14_990);
    expect(stats.verified).toBe(0);

    await expect(recordOrder(a.brand.id, a.user.id, { code: link.code, orderReference: `ORD-${link.code}-1`, amountMinor: 100 })).rejects.toThrow(/already been recorded/i);
    await expect(recordOrder(b.brand.id, b.user.id, { code: link.code, orderReference: "X", amountMinor: 100 })).rejects.toThrow(/not found for your brand/i);
    await expect(verifyConversion(b.brand.id, b.user.id, referral.id)).rejects.toBeInstanceOf(ConversionError);

    await verifyConversion(a.brand.id, a.user.id, referral.id);
    expect((await prisma.referral.findUniqueOrThrow({ where: { id: referral.id } })).status).toBe("VERIFIED");
    expect((await prisma.commission.findUniqueOrThrow({ where: { id: commission.id } })).status).toBe("APPROVED");
    await expect(verifyConversion(a.brand.id, a.user.id, referral.id)).rejects.toThrow(/pending verification/i);

    stats = await getPartnerStats(creator.id);
    expect(stats.commissionApproved).toBe(14_990);
    expect(stats.sales).toBe(149_900);
    expect(stats.verified).toBe(1);
  });

  it("customer orders create rewards that become AVAILABLE on verification; rejection cancels them", async () => {
    const customer = await makeCustomer();
    const { code } = await joinCampaign({ id: customer.id, name: customer.name, role: "CUSTOMER" }, campaignId);
    const first = await recordOrder(a.brand.id, a.user.id, { code: code!, orderReference: `ORD-${code}-1`, amountMinor: 149_900 });
    const second = await recordOrder(a.brand.id, a.user.id, { code: code!, orderReference: `ORD-${code}-2`, amountMinor: 149_900 });
    expect((await prisma.reward.findFirstOrThrow({ where: { referralId: first.referral.id } })).amount).toBe(5_000);

    await verifyConversion(a.brand.id, a.user.id, first.referral.id);
    await rejectConversion(a.brand.id, a.user.id, second.referral.id, "Returned");
    const stats = await getPartnerStats(customer.id);
    expect(stats.rewardsAvailable).toBe(5_000);
    expect(stats.rewardsPending).toBe(0);
    expect((await prisma.reward.findFirstOrThrow({ where: { referralId: second.referral.id } })).status).toBe("REJECTED");
  });

  it("blocks self-referrals, duplicate customers on new-customer-only campaigns, paused campaigns and low order values", async () => {
    const strict = await createCampaign(a.brand.id, a.brand.name, a.user.id, campaignValues(a.product.id, { name: "Strict", requiresApproval: false, newCustomerOnly: true, minimumPurchaseAmount: 500 }));
    await transitionCampaign(a.brand.id, a.user.id, strict.id, "PUBLISH", { confirmed: true });
    const creator = await makeCreator();
    const { code } = await joinCampaign({ id: creator.id, name: creator.name, role: "CREATOR" }, strict.id);

    await expect(recordOrder(a.brand.id, a.user.id, { code: code!, orderReference: "S-1", amountMinor: 100_000, customerContact: creator.email })).rejects.toThrow(/self-referral/i);
    await expect(recordOrder(a.brand.id, a.user.id, { code: code!, orderReference: "S-2", amountMinor: 10_000 })).rejects.toThrow(/minimum order/i);
    await recordOrder(a.brand.id, a.user.id, { code: code!, orderReference: "S-3", amountMinor: 100_000, customerContact: "friend@example.com" });
    await expect(recordOrder(a.brand.id, a.user.id, { code: code!, orderReference: "S-4", amountMinor: 100_000, customerContact: "FRIEND@example.com " })).rejects.toThrow(/duplicate referral/i);

    await transitionCampaign(a.brand.id, a.user.id, strict.id, "PAUSE");
    await expect(recordOrder(a.brand.id, a.user.id, { code: code!, orderReference: "S-5", amountMinor: 100_000 })).rejects.toThrow(/not active/i);
  });

  it("verification respects the campaign budget", async () => {
    const tight = await createCampaign(a.brand.id, a.brand.name, a.user.id, campaignValues(a.product.id, { name: "Tight", requiresApproval: false, budget: 200, creatorCommissionType: "FIXED_AMOUNT", creatorCommissionValue: 150 }));
    await transitionCampaign(a.brand.id, a.user.id, tight.id, "PUBLISH", { confirmed: true });
    const creator = await makeCreator();
    const { code } = await joinCampaign({ id: creator.id, name: creator.name, role: "CREATOR" }, tight.id);
    const o1 = await recordOrder(a.brand.id, a.user.id, { code: code!, orderReference: "T-1", amountMinor: 100_000 });
    const o2 = await recordOrder(a.brand.id, a.user.id, { code: code!, orderReference: "T-2", amountMinor: 100_000 });
    await verifyConversion(a.brand.id, a.user.id, o1.referral.id);
    await expect(verifyConversion(a.brand.id, a.user.id, o2.referral.id)).rejects.toThrow(/budget/i);
  });
});

describe("metrics", () => {
  it("overview and insight report honestly when there is no data", async () => {
    const fresh = await makeOwnerWithBrand("Empty Metrics");
    const overview = await getBrandOverview(fresh.brand.id);
    expect(overview.revenue).toBe(0);
    expect(overview.roi).toBeNull();
    expect(overview.conversionRate).toBeNull();
    expect(overview.totalProducts).toBe(1);
    const insight = buildInsight(overview, await getCampaignBreakdown(fresh.brand.id));
    expect(insight.sufficient).toBe(false);
    expect(insight.text).toMatch(/not enough data/i);
  });

  it("brand overview aggregates only verified orders and approved costs; other brands see nothing", async () => {
    const overview = await getBrandOverview(a.brand.id);
    expect(overview.verifiedConversions).toBeGreaterThan(0);
    expect(overview.revenue).toBeGreaterThan(0);
    expect(overview.approvedCommissionCost).toBeGreaterThan(0);
    const top = await getTopCreators(a.brand.id);
    expect(top.length).toBeGreaterThan(0);
    expect(top[0].revenue).toBeGreaterThan(0);
    expect((await getBrandOverview(b.brand.id)).revenue).toBe(0);
    expect(await getTopCreators(b.brand.id)).toEqual([]);
  });
});

describe("batch 2: re-record after rejection, live-campaign rule changes, one brand per owner, device dedupe", () => {
  it("CONV-01: an order reference rejected once can be recorded again; the old row is kept under a suffixed reference", async () => {
    const { createCampaign, transitionCampaign } = await import("@/lib/services/campaigns");
    const { recordOrder, rejectConversion } = await import("@/lib/services/conversions");
    const { joinCampaign } = await import("@/lib/services/partners");
    const owner = await makeOwnerWithBrand(`Rerec ${uniq("b")}`);
    const campaign = await createCampaign(owner.brand.id, owner.brand.name, owner.user.id, campaignValues(owner.product.id, { name: `Rerec ${uniq("c")}`, requiresApproval: false }));
    await transitionCampaign(owner.brand.id, owner.user.id, campaign.id, "PUBLISH", { confirmed: true });
    const creator = await makeCreator();
    const { code } = await joinCampaign({ id: creator.id, name: creator.name, role: "CREATOR" }, campaign.id);
    const ref = uniq("ORD");
    const first = await recordOrder(owner.brand.id, owner.user.id, { code: code!, orderReference: ref, amountMinor: 50_000 });
    await rejectConversion(owner.brand.id, owner.user.id, first.referral.id, "typo");
    const second = await recordOrder(owner.brand.id, owner.user.id, { code: code!, orderReference: ref, amountMinor: 55_000 });
    expect(second.conversion.orderReference).toBe(ref);
    const old = await prisma.conversion.findUniqueOrThrow({ where: { id: first.conversion.id } });
    expect(old.orderReference.startsWith(`${ref}~rejected~`)).toBe(true);
    // A PURCHASED (not rejected) duplicate is still refused.
    await expect(recordOrder(owner.brand.id, owner.user.id, { code: code!, orderReference: ref, amountMinor: 1_000 })).rejects.toThrow(/already been recorded/);
  });

  it("CAMP-02: campaign type is locked after publishing; a commission change notifies creators with a live link", async () => {
    const { createCampaign, transitionCampaign, updateCampaign, CampaignError } = await import("@/lib/services/campaigns");
    const { joinCampaign } = await import("@/lib/services/partners");
    const owner = await makeOwnerWithBrand(`Lock ${uniq("b")}`);
    const campaign = await createCampaign(owner.brand.id, owner.brand.name, owner.user.id, campaignValues(owner.product.id, { name: `Lock ${uniq("c")}`, requiresApproval: false }));
    await transitionCampaign(owner.brand.id, owner.user.id, campaign.id, "PUBLISH", { confirmed: true });
    const creator = await makeCreator();
    await joinCampaign({ id: creator.id, name: creator.name, role: "CREATOR" }, campaign.id);
    await expect(
      updateCampaign(owner.brand.id, owner.brand.name, owner.user.id, campaign.id, campaignValues(owner.product.id, { name: campaign.name, campaignType: "CUSTOMER_REFERRAL" })),
    ).rejects.toBeInstanceOf(CampaignError);
    await updateCampaign(owner.brand.id, owner.brand.name, owner.user.id, campaign.id, campaignValues(owner.product.id, { name: campaign.name, creatorCommissionValue: 12 }));
    expect(await prisma.notification.count({ where: { userId: creator.id, title: { startsWith: "Commission updated" } } })).toBe(1);
  });

  it("DB-01: a second brand for the same owner is refused", async () => {
    const { createBrand, BrandExistsError } = await import("@/lib/services/brands");
    const { brandSchema } = await import("@/lib/validation/brand");
    const owner = await makeOwnerWithBrand(`One ${uniq("b")}`);
    await expect(createBrand(owner.user.id, brandSchema.parse({ name: "Second", industry: "Consumer electronics" }))).rejects.toBeInstanceOf(BrandExistsError);
  });

  it("REF-02: the same IP + user agent on a link counts once per hour even when the visitor cookie changes", async () => {
    const { createCampaign, transitionCampaign } = await import("@/lib/services/campaigns");
    const { joinCampaign } = await import("@/lib/services/partners");
    const { recordClick, resolveReferralCode } = await import("@/lib/services/tracking");
    const owner = await makeOwnerWithBrand(`Click ${uniq("b")}`);
    const campaign = await createCampaign(owner.brand.id, owner.brand.name, owner.user.id, campaignValues(owner.product.id, { name: `Click ${uniq("c")}`, requiresApproval: false }));
    await transitionCampaign(owner.brand.id, owner.user.id, campaign.id, "PUBLISH", { confirmed: true });
    const customer = await makeCustomer();
    const { code } = await joinCampaign({ id: customer.id, name: customer.name, role: "CUSTOMER" }, campaign.id);
    const resolved = await resolveReferralCode(code!);
    if (!resolved.ok) throw new Error("expected live link");
    const base = { linkId: resolved.link.id, campaignId: campaign.id, referrerId: customer.id, source: "LINK" as const, ip: "203.0.113.9", userAgent: "UA/1" };
    expect((await recordClick({ ...base, visitorId: uniq("v") })).counted).toBe(true);
    expect((await recordClick({ ...base, visitorId: uniq("v") })).counted).toBe(false); // new cookie, same device
    expect((await recordClick({ ...base, visitorId: uniq("v"), ip: "203.0.113.10" })).counted).toBe(true); // different device
  });
});
