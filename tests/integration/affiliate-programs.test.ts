import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import {
  addAffiliateCode,
  AffiliateLinkError,
  assertSafeTarget,
  creatorAffiliateStats,
  programTrafficStats,
  recordAffiliateClick,
  removeAffiliateLink,
  resolveAffiliateCode,
  saveAffiliateLink,
  subIdFor,
  withSubId,
} from "@/lib/services/affiliate-links";
import {
  adminCreateAffiliateProgram,
  adminDeleteAffiliateProgram,
  adminSetAffiliateProgramState,
  adminUpdateAffiliateProgram,
  AffiliateProgramError,
  createAffiliateProgram,
  getPublishedProgram,
  listPublishedPrograms,
  reviewAffiliateProgram,
  setAffiliateProgramState,
  updateAffiliateProgram,
} from "@/lib/services/affiliate-programs";
import { resolveReferralCode } from "@/lib/services/tracking";
import { adminAffiliateProgramSchema, affiliateProgramSchema } from "@/lib/validation/affiliate";
import { EXAMPLE_AFFILIATE_PROGRAMS, seedExampleAffiliatePrograms } from "../../prisma/seed-data/affiliate-programs";
import { makeCreator, makeOwnerWithBrand, uniq } from "../helpers";

/**
 * External affiliate programmes: listed by a brand, published only after an
 * admin review, joined OUTSIDE Refnivo, then tracked by click only.
 */
const values = (over: Record<string, unknown> = {}) =>
  affiliateProgramSchema.parse({
    name: `Affiliate ${uniq("p")}`,
    signupUrl: "https://network.example.com/join/brand",
    commissionType: "PERCENTAGE",
    commissionDescription: "Up to 8%",
    approvalType: "APPLICATION",
    category: "Electronics",
    ...over,
  });

async function admin() {
  return prisma.user.create({ data: { name: "Admin", email: `${uniq("admin")}@test.local`, role: "ADMIN", status: "APPROVED" } });
}

async function publishedProgram(over: Record<string, unknown> = {}) {
  const owner = await makeOwnerWithBrand(`Aff ${uniq("b")}`);
  const program = await createAffiliateProgram(owner.brand.id, owner.user.id, values(over), { submit: true });
  const reviewer = await admin();
  await reviewAffiliateProgram(reviewer.id, program.id, { decision: "APPROVE", verified: true });
  return { owner, program, reviewer };
}

async function creatorWithProfile() {
  const creator = await makeCreator();
  await prisma.user.update({ where: { id: creator.id }, data: { status: "APPROVED" } });
  return creator;
}

afterAll(() => prisma.$disconnect());

describe("listing and review", () => {
  it("is invisible to creators until an admin approves it", async () => {
    const owner = await makeOwnerWithBrand(`Aff ${uniq("b")}`);
    const program = await createAffiliateProgram(owner.brand.id, owner.user.id, values(), { submit: true });
    expect(program.status).toBe("PENDING_REVIEW");
    expect(await getPublishedProgram(program.slug)).toBeNull();
    expect((await listPublishedPrograms({ q: program.name })).map((p) => p.id)).not.toContain(program.id);

    const reviewer = await admin();
    await reviewAffiliateProgram(reviewer.id, program.id, { decision: "APPROVE", verified: false });
    const live = await getPublishedProgram(program.slug);
    expect(live?.status).toBe("APPROVED");
    // Approved but not checked: never shown as verified.
    expect(live?.verifiedAt).toBeNull();
  });

  it("marks a listing verified only when the reviewer says they checked it", async () => {
    const { program } = await publishedProgram();
    expect((await getPublishedProgram(program.slug))?.verifiedAt).not.toBeNull();
  });

  it("requires a reason to reject, and sends an edited live listing back to review", async () => {
    const owner = await makeOwnerWithBrand(`Aff ${uniq("b")}`);
    const program = await createAffiliateProgram(owner.brand.id, owner.user.id, values(), { submit: true });
    const reviewer = await admin();
    await expect(reviewAffiliateProgram(reviewer.id, program.id, { decision: "REJECT" })).rejects.toBeInstanceOf(AffiliateProgramError);
    await reviewAffiliateProgram(reviewer.id, program.id, { decision: "APPROVE", verified: true });

    // Editing a published listing (e.g. swapping the signup URL) takes it off the marketplace until re-reviewed.
    const edited = await updateAffiliateProgram(owner.brand.id, owner.user.id, program.id, values({ name: program.name, signupUrl: "https://other.example.com/join" }), { submit: false });
    expect(edited.status).toBe("PENDING_REVIEW");
    expect(edited.verifiedAt).toBeNull();
    expect(await getPublishedProgram(program.slug)).toBeNull();
  });

  it("lets a brand manage only its own listings", async () => {
    const { program } = await publishedProgram();
    const other = await makeOwnerWithBrand(`Other ${uniq("b")}`);
    await expect(setAffiliateProgramState(other.brand.id, other.user.id, program.id, "PAUSE")).rejects.toThrow(/not found/i);
    await expect(updateAffiliateProgram(other.brand.id, other.user.id, program.id, values(), { submit: false })).rejects.toThrow(/not found/i);
  });

  it("has no Refnivo commission, reward or payout fields at all", async () => {
    const { program } = await publishedProgram();
    const row = (await prisma.affiliateProgram.findUniqueOrThrow({ where: { id: program.id } })) as Record<string, unknown>;
    for (const field of ["creatorCommissionValue", "customerRewardValue", "budget", "payoutMinimum"]) expect(row).not.toHaveProperty(field);
    // The commission is stored only as the brand's own description.
    expect(row.commissionDescription).toBe("Up to 8%");
  });
});

describe("creator links and tracking", () => {
  it("saves the creator's external URL and issues a general tracking code that resolves", async () => {
    const { program } = await publishedProgram();
    const creator = await creatorWithProfile();
    const link = await saveAffiliateLink({ creatorId: creator.id, programId: program.id, targetUrl: "https://network.example.com/aff/12345" });
    expect(link.targetUrl).toBe("https://network.example.com/aff/12345");
    expect(link.codes).toHaveLength(1);
    expect(link.codes[0].source).toBe("GENERAL");

    const resolved = await resolveAffiliateCode(link.codes[0].code);
    expect(resolved?.ok).toBe(true);
    // Not mistaken for a campaign referral link.
    expect((await resolveReferralCode(link.codes[0].code)).ok).toBe(false);
  });

  it("issues one code per platform, idempotently, all forwarding to the same URL", async () => {
    const { program } = await publishedProgram();
    const creator = await creatorWithProfile();
    const link = await saveAffiliateLink({ creatorId: creator.id, programId: program.id, targetUrl: "https://network.example.com/aff/777" });
    const yt = await addAffiliateCode({ creatorId: creator.id, linkId: link.id, source: "YOUTUBE" });
    const again = await addAffiliateCode({ creatorId: creator.id, linkId: link.id, source: "YOUTUBE" });
    expect(again.id).toBe(yt.id);
    expect(yt.code).toMatch(/-YT$/);
    const resolved = await resolveAffiliateCode(yt.code);
    expect(resolved?.ok && resolved.row.link.targetUrl).toBe("https://network.example.com/aff/777");
  });

  it("refuses a link for an unpublished programme, another creator's link, and unsafe destinations", async () => {
    const owner = await makeOwnerWithBrand(`Aff ${uniq("b")}`);
    const draft = await createAffiliateProgram(owner.brand.id, owner.user.id, values(), { submit: false });
    const creator = await creatorWithProfile();
    await expect(saveAffiliateLink({ creatorId: creator.id, programId: draft.id, targetUrl: "https://x.example.com/a" })).rejects.toBeInstanceOf(AffiliateLinkError);

    const { program } = await publishedProgram();
    const link = await saveAffiliateLink({ creatorId: creator.id, programId: program.id, targetUrl: "https://network.example.com/aff/1" });
    const intruder = await creatorWithProfile();
    await expect(addAffiliateCode({ creatorId: intruder.id, linkId: link.id, source: "X" })).rejects.toThrow(/not found/i);

    expect(() => assertSafeTarget("javascript:alert(1)", "https://www.refnivo.com")).toThrow(AffiliateLinkError);
    expect(() => assertSafeTarget("https://www.refnivo.com/r/LOOP", "https://www.refnivo.com")).toThrow(/not a Refnivo link/i);
    expect(() => assertSafeTarget("https://refnivo.com/r/LOOP", "https://www.refnivo.com")).toThrow(/not a Refnivo link/i);
    expect(assertSafeTarget("https://amzn.to/abc", "https://www.refnivo.com")).toBe("https://amzn.to/abc");
  });

  it("counts a click once per visitor window and records the platform", async () => {
    const { program } = await publishedProgram();
    const creator = await creatorWithProfile();
    const link = await saveAffiliateLink({ creatorId: creator.id, programId: program.id, targetUrl: "https://network.example.com/aff/9" });
    const ig = await addAffiliateCode({ creatorId: creator.id, linkId: link.id, source: "INSTAGRAM" });

    const click = (visitorId: string) =>
      recordAffiliateClick({ code: ig.code, trackingCodeId: ig.id, linkId: link.id, programId: program.id, creatorId: creator.id, source: "INSTAGRAM", visitorId, ip: null, userAgent: null, referer: null, subIdParam: null });
    expect((await click("v1")).counted).toBe(true);
    expect((await click("v1")).counted).toBe(false); // same visitor, inside the window
    expect((await click("v2")).counted).toBe(true);

    const stats = await creatorAffiliateStats(creator.id);
    expect(stats).toMatchObject({ clicks: 2, uniqueVisitors: 2 });
    expect(stats.bySource).toEqual([{ source: "INSTAGRAM", clicks: 2 }]);
    // Clicks only: there is no sales figure to report for an external programme.
    expect(stats).not.toHaveProperty("revenue");
    expect(stats).not.toHaveProperty("conversions");

    expect(await programTrafficStats(program.id)).toMatchObject({ creators: 1, clicks: 2 });
  });

  it("appends a sub id only when the programme declares its parameter", async () => {
    expect(withSubId("https://net.example.com/a?x=1", null, "abc")).toBe("https://net.example.com/a?x=1");
    expect(withSubId("https://net.example.com/a?x=1", "aff_sub", "abc")).toBe("https://net.example.com/a?x=1&aff_sub=abc");
    expect(subIdFor("ARJUN-BOAT-4K7Q-YT", "f00d")).toBe("rfn_arjun-boat-4k7q-yt_f00d");

    const { program } = await publishedProgram({ subIdParam: "aff_sub" });
    const creator = await creatorWithProfile();
    const link = await saveAffiliateLink({ creatorId: creator.id, programId: program.id, targetUrl: "https://network.example.com/aff/5" });
    const code = link.codes[0];
    const result = await recordAffiliateClick({ code: code.code, trackingCodeId: code.id, linkId: link.id, programId: program.id, creatorId: creator.id, source: "GENERAL", visitorId: "vx", ip: null, userAgent: null, referer: null, subIdParam: "aff_sub" });
    expect(result.subId).toMatch(/^rfn_/);
    // The sub id never contains an internal database id.
    expect(result.subId).not.toContain(link.id);
  });

  it("stops forwarding once the programme is paused, and keeps history when a link is removed", async () => {
    const { owner, program } = await publishedProgram();
    const creator = await creatorWithProfile();
    const link = await saveAffiliateLink({ creatorId: creator.id, programId: program.id, targetUrl: "https://network.example.com/aff/3" });
    const code = link.codes[0].code;
    await setAffiliateProgramState(owner.brand.id, owner.user.id, program.id, "PAUSE");
    expect((await resolveAffiliateCode(code))?.ok).toBe(false);

    await recordAffiliateClick({ code, trackingCodeId: link.codes[0].id, linkId: link.id, programId: program.id, creatorId: creator.id, source: "GENERAL", visitorId: "h1", ip: null, userAgent: null, referer: null, subIdParam: null });
    await removeAffiliateLink(creator.id, link.id);
    expect(await prisma.affiliateClick.count({ where: { creatorAffiliateLinkId: link.id } })).toBe(1);
    expect((await prisma.creatorAffiliateLink.findUniqueOrThrow({ where: { id: link.id } })).status).toBe("DISABLED");
  });
});

/**
 * Curated listings: a programme Refnivo lists from public information before the
 * brand has an account (e.g. the boAt example). No brandId, only a brand name.
 */
const adminValues = (over: Record<string, unknown> = {}) =>
  adminAffiliateProgramSchema.parse({ name: `Curated ${uniq("c")}`, brandName: `Brand ${uniq("n")}`, signupUrl: "https://network.example.com/offers/brand", ...over });

describe("curated listings (brand not on Refnivo)", () => {
  it("enters the review queue, then publishes under the brand name with nothing invented", async () => {
    const reviewer = await admin();
    const program = await adminCreateAffiliateProgram(reviewer.id, adminValues({ brandName: "Curatedco", networkName: "Admitad" }));
    expect(program.status).toBe("PENDING_REVIEW");
    expect(program.brandId).toBeNull();
    expect(program.verifiedAt).toBeNull();
    // Unstated terms stay unstated — no default commission type or joining rule.
    expect(program.commissionType).toBeNull();
    expect(program.approvalType).toBeNull();
    expect(await getPublishedProgram(program.slug)).toBeNull();

    await reviewAffiliateProgram(reviewer.id, program.id, { decision: "APPROVE", verified: false });
    const published = await getPublishedProgram(program.slug);
    expect(published?.brand).toBeNull();
    expect(published?.brandName).toBe("Curatedco");
    expect(published?.verifiedAt).toBeNull();
    expect((await listPublishedPrograms({ q: "Curatedco" })).map((p) => p.id)).toContain(program.id);
  });

  it("requires a brand one way or the other — in validation and in the database", async () => {
    expect(adminAffiliateProgramSchema.safeParse({ name: "No brand", signupUrl: "https://x.example.com" }).success).toBe(false);
    const owner = await makeOwnerWithBrand(`Aff ${uniq("b")}`);
    const program = await createAffiliateProgram(owner.brand.id, owner.user.id, values(), { submit: false });
    await expect(prisma.affiliateProgram.update({ where: { id: program.id }, data: { brandId: null, brandName: null } })).rejects.toThrow();
  });

  it("lets a creator save a link and get a working tracking code", async () => {
    const reviewer = await admin();
    const program = await adminCreateAffiliateProgram(reviewer.id, adminValues({ brandName: "Boatish" }));
    await reviewAffiliateProgram(reviewer.id, program.id, { decision: "APPROVE" });
    const creator = await creatorWithProfile();
    const link = await saveAffiliateLink({ creatorId: creator.id, programId: program.id, targetUrl: "https://network.example.com/aff/curated" });
    expect(link.program.brand).toBeNull();
    expect(link.codes[0].code).toMatch(/BOATISH/);
    expect((await resolveAffiliateCode(link.codes[0].code))?.ok).toBe(true);
    const yt = await addAffiliateCode({ creatorId: creator.id, linkId: link.id, source: "YOUTUBE" });
    expect(yt.code).toMatch(/-YT$/);
  });

  it("admin edits keep the status, and a changed URL removes the Verified mark", async () => {
    const reviewer = await admin();
    const program = await adminCreateAffiliateProgram(reviewer.id, adminValues());
    await reviewAffiliateProgram(reviewer.id, program.id, { decision: "APPROVE", verified: true });

    const base = { name: program.name, brandName: program.brandName, signupUrl: program.signupUrl };
    const described = await adminUpdateAffiliateProgram(reviewer.id, program.id, adminValues({ ...base, description: "Now with a description" }));
    expect(described.status).toBe("APPROVED");
    expect(described.verifiedAt).not.toBeNull();

    const moved = await adminUpdateAffiliateProgram(reviewer.id, program.id, adminValues({ ...base, signupUrl: "https://elsewhere.example.com/join" }));
    expect(moved.status).toBe("APPROVED");
    expect(moved.verifiedAt).toBeNull();
  });

  it("admin can attach a curated listing to a brand that joins later", async () => {
    const reviewer = await admin();
    const program = await adminCreateAffiliateProgram(reviewer.id, adminValues());
    const owner = await makeOwnerWithBrand(`Aff ${uniq("b")}`);
    const attached = await adminUpdateAffiliateProgram(reviewer.id, program.id, adminValues({ name: program.name, signupUrl: program.signupUrl, brandId: owner.brand.id }));
    expect(attached.brandId).toBe(owner.brand.id);
    expect(attached.brandName).toBeNull();
  });

  it("deletes only while unused; once creators have links, closing keeps their history", async () => {
    const reviewer = await admin();
    const unused = await adminCreateAffiliateProgram(reviewer.id, adminValues());
    await adminDeleteAffiliateProgram(reviewer.id, unused.id);
    expect(await prisma.affiliateProgram.findUnique({ where: { id: unused.id } })).toBeNull();

    const used = await adminCreateAffiliateProgram(reviewer.id, adminValues());
    await reviewAffiliateProgram(reviewer.id, used.id, { decision: "APPROVE" });
    const creator = await creatorWithProfile();
    const link = await saveAffiliateLink({ creatorId: creator.id, programId: used.id, targetUrl: "https://network.example.com/aff/used" });
    await expect(adminDeleteAffiliateProgram(reviewer.id, used.id)).rejects.toBeInstanceOf(AffiliateProgramError);

    await adminSetAffiliateProgramState(reviewer.id, used.id, "CLOSE");
    expect(await getPublishedProgram(used.slug)).toBeNull();
    expect((await resolveAffiliateCode(link.codes[0].code))?.ok).toBe(false);
    expect(await prisma.creatorAffiliateLink.count({ where: { id: link.id } })).toBe(1);

    const reopened = await adminSetAffiliateProgramState(reviewer.id, used.id, "REOPEN");
    expect(reopened.status).toBe("PENDING_REVIEW");
  });

  it("hides a suspended brand's listing, while curated listings need no brand account", async () => {
    const { owner, program } = await publishedProgram();
    await prisma.brand.update({ where: { id: owner.brand.id }, data: { status: "SUSPENDED" } });
    expect(await getPublishedProgram(program.slug)).toBeNull();
  });
});

describe("example seed listings", () => {
  it("inserts the boAt example once, unpublished and unverified, with only sourced facts", async () => {
    await prisma.$transaction((tx) => seedExampleAffiliatePrograms(tx));
    const again = await prisma.$transaction((tx) => seedExampleAffiliatePrograms(tx));
    expect(again.created).toEqual([]);

    const boat = await prisma.affiliateProgram.findUniqueOrThrow({ where: { slug: "boat-affiliate-program" } });
    expect(boat.brandId).toBeNull();
    expect(boat.brandName).toBe("boAt");
    expect(boat.status).toBe("PENDING_REVIEW");
    expect(boat.verifiedAt).toBeNull();
    for (const field of ["commissionType", "commissionDescription", "cookieDurationDays", "approvalType", "subIdParam"] as const) expect(boat[field]).toBeNull();
    expect(boat.signupUrl).toMatch(/^https:\/\//);
  });

  it("every example cites its sources and is a curated listing", () => {
    for (const example of EXAMPLE_AFFILIATE_PROGRAMS) {
      expect(example.sources.urls.length).toBeGreaterThan(0);
      expect(example.sources.checkedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(example.brandName.length).toBeGreaterThan(1);
    }
  });
});
