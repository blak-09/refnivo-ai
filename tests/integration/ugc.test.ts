import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import {
  applyToBrief,
  cancelUgcCollaboration,
  confirmUgcPayment,
  createBrief,
  decideUgcApplication,
  getCreatorBrief,
  listOpenBriefs,
  markUgcPaid,
  reviewUgcSubmission,
  submitUgcContent,
  transitionBrief,
  UgcError,
  withdrawUgcApplication,
} from "@/lib/services/ugc";
import { addPartnerNote, getBrandPartner, listBrandPartners, listCreatorPartnerships } from "@/lib/services/partnerships";
import { ugcBriefSchema } from "@/lib/validation/ugc";
import { makeCreator, makeOwnerWithBrand } from "../helpers";

afterAll(() => prisma.$disconnect());

const briefValues = (overrides: Record<string, unknown> = {}) =>
  ugcBriefSchema.parse({
    title: "Unboxing reel for our headphones",
    description: "Show the unboxing and first impressions in a natural, honest tone. Mention battery life.",
    deliverables: "1 vertical video, 30–45 seconds",
    contentTypes: ["VIDEO", "UNBOXING"],
    feeRupees: "2500",
    creatorsNeeded: "1",
    usageRights: "ORGANIC_3M",
    ...overrides,
  });

const pitch = { pitch: "I review audio gear weekly for students; happy to shoot this in my studio.", portfolioLinks: [] };

async function paidBrand(name: string) {
  const o = await makeOwnerWithBrand(name);
  await prisma.brandSubscription.create({ data: { brandId: o.brand.id, planKey: "starter", status: "ACTIVE", currentPeriodEnd: new Date(Date.now() + 86_400_000) } });
  return o;
}

async function openBrief(o: Awaited<ReturnType<typeof makeOwnerWithBrand>>, overrides: Record<string, unknown> = {}) {
  const brief = await createBrief(o.brand.id, o.user.id, briefValues(overrides));
  await transitionBrief(o.brand.id, o.user.id, brief.id, "PUBLISH");
  return brief;
}

describe("UGC briefs", () => {
  it("stores the fee in paise and needs a paid plan to publish (when limits are on)", async () => {
    const o = await makeOwnerWithBrand("UGC Free Brand");
    const brief = await createBrief(o.brand.id, o.user.id, briefValues());
    expect(brief).toMatchObject({ status: "DRAFT", feeAmount: 250_000 });
    process.env.PLAN_LIMITS = "on";
    try {
      await expect(transitionBrief(o.brand.id, o.user.id, brief.id, "PUBLISH")).rejects.toThrow(/Starter and Growth/);
      await prisma.brandSubscription.create({ data: { brandId: o.brand.id, planKey: "starter", status: "ACTIVE", currentPeriodEnd: new Date(Date.now() + 86_400_000) } });
      await expect(transitionBrief(o.brand.id, o.user.id, brief.id, "PUBLISH")).resolves.toMatchObject({ status: "OPEN" });
    } finally {
      process.env.PLAN_LIMITS = "off";
    }
  });

  it("drafts are invisible to creators; open briefs are listed", async () => {
    const o = await paidBrand("UGC Visible Brand");
    const creator = await makeCreator();
    const draft = await createBrief(o.brand.id, o.user.id, briefValues({ title: "Hidden draft brief" }));
    expect(await getCreatorBrief(creator.id, draft.id)).toBeNull();
    const open = await openBrief(o);
    expect((await listOpenBriefs(creator.id)).some((b) => b.id === open.id)).toBe(true);
  });
});

describe("UGC collaboration lifecycle", () => {
  it("apply → accept (fee frozen, brief fills and closes) → submit → revision → approve → paid → confirmed", async () => {
    const o = await paidBrand("UGC Flow Brand");
    const [a, b] = [await makeCreator(), await makeCreator()];
    const brief = await openBrief(o);

    const ca = await applyToBrief(a.id, brief.id, pitch);
    const cb = await applyToBrief(b.id, brief.id, pitch);
    await expect(applyToBrief(a.id, brief.id, pitch)).rejects.toThrow(/already applied/);

    await decideUgcApplication(o.brand.id, o.user.id, ca.id, "ACCEPT");
    const accepted = await prisma.ugcCollaboration.findUniqueOrThrow({ where: { id: ca.id } });
    expect(accepted).toMatchObject({ status: "IN_PROGRESS", agreedFee: 250_000 });
    // One slot: the brief closes and the other applicant is told.
    expect((await prisma.ugcBrief.findUniqueOrThrow({ where: { id: brief.id } })).status).toBe("CLOSED");
    expect((await prisma.ugcCollaboration.findUniqueOrThrow({ where: { id: cb.id } })).status).toBe("DECLINED");

    // Photos must be the creator's own uploads.
    await expect(submitUgcContent(a.id, ca.id, { note: null, imageUrls: [`/uploads/ugc/${b.id}/x.webp`], links: [] })).rejects.toBeInstanceOf(UgcError);
    await submitUgcContent(a.id, ca.id, { note: "First cut", imageUrls: [`/uploads/ugc/${a.id}/x.webp`], links: ["https://drive.google.com/file/abc"] });
    await expect(markUgcPaid(o.brand.id, o.user.id, ca.id, null)).rejects.toThrow(/Approve the content/);

    await reviewUgcSubmission(o.brand.id, o.user.id, ca.id, "REVISION_REQUESTED", "Please mention the battery life in the first 5 seconds.");
    expect((await prisma.ugcCollaboration.findUniqueOrThrow({ where: { id: ca.id } })).status).toBe("REVISION_REQUESTED");
    await submitUgcContent(a.id, ca.id, { note: "v2", imageUrls: [], links: ["https://drive.google.com/file/def"] });
    await reviewUgcSubmission(o.brand.id, o.user.id, ca.id, "APPROVED", null);

    await expect(confirmUgcPayment(a.id, ca.id)).rejects.toThrow(/not marked/);
    await markUgcPaid(o.brand.id, o.user.id, ca.id, "UPI 4521");
    await confirmUgcPayment(a.id, ca.id);
    const done = await prisma.ugcCollaboration.findUniqueOrThrow({ where: { id: ca.id }, include: { submissions: true } });
    expect(done).toMatchObject({ status: "APPROVED", paymentReference: "UPI 4521" });
    expect(done.paidConfirmedAt).not.toBeNull();
    expect(done.submissions.map((s) => s.decision)).toEqual(["REVISION_REQUESTED", "APPROVED"]);

    const actions = (await prisma.auditLog.findMany({ where: { entityId: { in: [ca.id, ...done.submissions.map((s) => s.id)] } }, select: { action: true } })).map((x) => x.action);
    expect(actions).toEqual(expect.arrayContaining(["UGC_APPLIED", "UGC_APPLICATION_ACCEPTED", "UGC_CONTENT_SUBMITTED", "UGC_CONTENT_APPROVED", "UGC_FEE_MARKED_PAID", "UGC_FEE_CONFIRMED"]));
  });

  it("limits revisions to the final round", async () => {
    const o = await paidBrand("UGC Rounds Brand");
    const c = await makeCreator();
    const brief = await openBrief(o);
    const col = await applyToBrief(c.id, brief.id, pitch);
    await decideUgcApplication(o.brand.id, o.user.id, col.id, "ACCEPT");
    for (let round = 1; round <= 2; round++) {
      await submitUgcContent(c.id, col.id, { note: null, imageUrls: [], links: ["https://youtu.be/x"] });
      await reviewUgcSubmission(o.brand.id, o.user.id, col.id, "REVISION_REQUESTED", "Another change please, thank you.");
    }
    await submitUgcContent(c.id, col.id, { note: null, imageUrls: [], links: ["https://youtu.be/y"] });
    await expect(reviewUgcSubmission(o.brand.id, o.user.id, col.id, "REVISION_REQUESTED", "One more change please.")).rejects.toThrow(/final round/);
  });

  it("two acceptances cannot both take the last slot", async () => {
    const o = await paidBrand("UGC Race Brand");
    const [a, b] = [await makeCreator(), await makeCreator()];
    const brief = await openBrief(o);
    const [ca, cb] = [await applyToBrief(a.id, brief.id, pitch), await applyToBrief(b.id, brief.id, pitch)];
    const results = await Promise.allSettled([decideUgcApplication(o.brand.id, o.user.id, ca.id, "ACCEPT"), decideUgcApplication(o.brand.id, o.user.id, cb.id, "ACCEPT")]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.ugcCollaboration.count({ where: { briefId: brief.id, status: "IN_PROGRESS" } })).toBe(1);
  });

  it("brands only touch their own collaborations; creators can withdraw and re-apply; cancel before delivery", async () => {
    const o = await paidBrand("UGC Scope Brand");
    const other = await paidBrand("UGC Other Brand");
    const c = await makeCreator();
    const brief = await openBrief(o, { creatorsNeeded: "2" });
    const col = await applyToBrief(c.id, brief.id, pitch);
    await expect(decideUgcApplication(other.brand.id, other.user.id, col.id, "ACCEPT")).rejects.toThrow(/not found/);
    await withdrawUgcApplication(c.id, col.id);
    await applyToBrief(c.id, brief.id, pitch);
    await decideUgcApplication(o.brand.id, o.user.id, col.id, "ACCEPT");
    await cancelUgcCollaboration(o.brand.id, o.user.id, col.id, "Plans changed");
    expect((await prisma.ugcCollaboration.findUniqueOrThrow({ where: { id: col.id } })).status).toBe("CANCELLED");
  });
});

describe("creator partnerships", () => {
  it("lists creators the brand works with (UGC or connection), with notes kept private to the brand", async () => {
    const o = await paidBrand("Partners Brand");
    const [c, stranger] = [await makeCreator(), await makeCreator()];
    const brief = await openBrief(o);
    const col = await applyToBrief(c.id, brief.id, pitch);
    expect(await listBrandPartners(o.brand.id)).toHaveLength(0); // an application is not a partnership yet
    await decideUgcApplication(o.brand.id, o.user.id, col.id, "ACCEPT");

    const partners = await listBrandPartners(o.brand.id);
    expect(partners.map((p) => p.creator.id)).toEqual([c.id]);
    expect(partners[0].stats.ugc).toBe(1);

    await addPartnerNote(o.brand.id, o.user.id, c.id, "Great energy on camera, quick replies.");
    await expect(addPartnerNote(o.brand.id, o.user.id, stranger.id, "Not a partner")).rejects.toThrow(/creators you work with/);
    const detail = await getBrandPartner(o.brand.id, c.id);
    expect(detail?.notes.map((n) => n.body)).toEqual(["Great energy on camera, quick replies."]);
    expect(await getBrandPartner(o.brand.id, stranger.id)).toBeNull();

    await prisma.connection.create({ data: { brandId: o.brand.id, creatorId: stranger.id, initiator: "BRAND", status: "ACCEPTED" } });
    expect((await listBrandPartners(o.brand.id)).map((p) => p.creator.id).sort()).toEqual([c.id, stranger.id].sort());

    const mine = await listCreatorPartnerships(c.id);
    expect(mine.map((m) => m.brand.id)).toEqual([o.brand.id]);
  });
});
