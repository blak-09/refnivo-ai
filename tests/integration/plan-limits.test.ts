import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { CampaignPlanRequiredError, createCampaign, transitionCampaign } from "@/lib/services/campaigns";
import { getBrandEntitlements, getCampaignAllowance } from "@/lib/services/plan-limits";
import { campaignValues, makeOwnerWithBrand } from "../helpers";

afterAll(() => prisma.$disconnect());

type Owner = Awaited<ReturnType<typeof makeOwnerWithBrand>>;
const draft = (o: Owner, name: string) => createCampaign(o.brand.id, o.brand.name, o.user.id, campaignValues(o.product.id, { name: `Campaign ${name}` }));
const act = (o: Owner, id: string, action: "PUBLISH" | "PAUSE" | "RESUME" | "END", enforcePlanLimit = true) =>
  transitionCampaign(o.brand.id, o.user.id, id, action, { confirmed: true, enforcePlanLimit });

describe("brand free tier: 3 campaign launches, then a plan", () => {
  it("allows three launches, blocks the fourth, and keeps the draft", async () => {
    const o = await makeOwnerWithBrand("Free Tier Brand");
    for (const n of ["One", "Two", "Three"]) await act(o, (await draft(o, n)).id, "PUBLISH");
    expect(await getCampaignAllowance(o.brand.id, { enforced: true })).toMatchObject({ used: 3, remaining: 0, canLaunch: false });

    const fourth = await draft(o, "Four"); // drafts are always free
    await expect(act(o, fourth.id, "PUBLISH")).rejects.toBeInstanceOf(CampaignPlanRequiredError);
    expect((await prisma.campaign.findUniqueOrThrow({ where: { id: fourth.id } })).status).toBe("DRAFT");
    expect(await prisma.auditLog.count({ where: { entityId: fourth.id, action: "CAMPAIGN_PUBLISH" } })).toBe(0);
  });

  it("ending a campaign does not give a launch back, but pausing and resuming is not a new launch", async () => {
    const o = await makeOwnerWithBrand("Pause Brand");
    const ids = [];
    for (const n of ["A", "B", "C"]) {
      const c = await draft(o, n);
      await act(o, c.id, "PUBLISH");
      ids.push(c.id);
    }
    await act(o, ids[0], "PAUSE");
    await act(o, ids[0], "RESUME"); // already launched: allowed at the limit
    await act(o, ids[1], "END");
    await expect(act(o, (await draft(o, "D")).id, "PUBLISH")).rejects.toBeInstanceOf(CampaignPlanRequiredError);
  });

  it("a paid plan unlocks more launches; when it expires, live campaigns keep running", async () => {
    const o = await makeOwnerWithBrand("Paid Brand");
    for (const n of ["A", "B", "C"]) await act(o, (await draft(o, n)).id, "PUBLISH");
    const sub = await prisma.brandSubscription.create({
      data: { brandId: o.brand.id, planKey: "starter", status: "ACTIVE", currentPeriodEnd: new Date(Date.now() + 86_400_000) },
    });
    const fourth = await draft(o, "Four");
    await act(o, fourth.id, "PUBLISH");
    expect(await getCampaignAllowance(o.brand.id, { enforced: true })).toMatchObject({ used: 4, subscribed: true, planName: "Starter", canLaunch: true });

    await prisma.brandSubscription.update({ where: { id: sub.id }, data: { currentPeriodEnd: new Date(Date.now() - 1000) } });
    await expect(act(o, (await draft(o, "Five")).id, "PUBLISH")).rejects.toBeInstanceOf(CampaignPlanRequiredError);
    expect((await prisma.campaign.findUniqueOrThrow({ where: { id: fourth.id } })).status).toBe("ACTIVE");
  });

  it("two launches at once cannot both take the last free slot", async () => {
    const o = await makeOwnerWithBrand("Race Brand");
    for (const n of ["A", "B"]) await act(o, (await draft(o, n)).id, "PUBLISH");
    const [x, y] = [await draft(o, "X"), await draft(o, "Y")];
    const results = await Promise.allSettled([act(o, x.id, "PUBLISH"), act(o, y.id, "PUBLISH")]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.campaign.count({ where: { brandId: o.brand.id, publishedAt: { not: null } } })).toBe(3);
  });

  it("is not applied with PLAN_LIMITS=off", async () => {
    const o = await makeOwnerWithBrand("No Billing Brand");
    for (const n of ["A", "B", "C", "D"]) await act(o, (await draft(o, n)).id, "PUBLISH", false);
    expect(await prisma.campaign.count({ where: { brandId: o.brand.id, publishedAt: { not: null } } })).toBe(4);
  });
});

describe("Growth-only features", () => {
  it("are unlocked by a paid Growth plan and not by Starter", async () => {
    const o = await makeOwnerWithBrand("Feature Brand");
    expect((await getBrandEntitlements(o.brand.id, { enforced: true })).features.analytics).toBe(false);
    const sub = await prisma.brandSubscription.create({
      data: { brandId: o.brand.id, planKey: "starter", status: "ACTIVE", currentPeriodEnd: new Date(Date.now() + 86_400_000) },
    });
    expect((await getBrandEntitlements(o.brand.id, { enforced: true })).features).toMatchObject({ ugc: true, analytics: false, exports: false });
    await prisma.brandSubscription.update({ where: { id: sub.id }, data: { planKey: "growth" } });
    expect(await getBrandEntitlements(o.brand.id, { enforced: true })).toMatchObject({
      planName: "Growth",
      features: { analytics: true, exports: true, prioritySupport: true },
    });
  });
});
