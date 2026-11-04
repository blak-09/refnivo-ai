import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { createUser } from "@/lib/services/users";
import {
  changeOnboardingRole,
  getOnboardingContext,
  OnboardingError,
  profileCompletionFor,
  profileFormValues,
  readDraft,
  roleChangeBlockers,
  saveOnboardingDraft,
  saveProfile,
} from "@/lib/services/onboarding";
import { brandProfileSchema, creatorProfileOnboardingSchema, customerProfileSchema } from "@/lib/validation/onboarding";
import { makeCreator, makeOwnerWithBrand, uniq } from "../helpers";

afterAll(() => prisma.$disconnect());

const newUser = (role: "BRAND_OWNER" | "CREATOR" | "CUSTOMER", name = "Riya Shah") =>
  createUser({ name, email: `${uniq("onb")}@test.local`, password: "Password1", role });

const handle = () => uniq("h").replace(/-/g, "_").slice(0, 28);

describe("onboarding drafts", () => {
  it("saves progress for the current role only, and survives a reload", async () => {
    const user = await newUser("BRAND_OWNER");
    await saveOnboardingDraft(user.id, "BRAND_OWNER", { name: "Half done", productCategories: ["Pets"], passwordHash: "x" });
    const ctx = await getOnboardingContext(user.id);
    const draft = readDraft(ctx.onboardingDraft, "BRAND_OWNER");
    expect(draft?.values).toMatchObject({ name: "Half done", productCategories: ["Pets"] });
    expect(draft?.values).not.toHaveProperty("passwordHash");
    // A draft from another role is ignored.
    expect(readDraft(ctx.onboardingDraft, "CREATOR")).toBeNull();
    // Nothing is written to the public brand table until completion.
    expect(await prisma.brand.count({ where: { ownerId: user.id } })).toBe(0);
    // The form re-opens with the draft.
    expect(profileFormValues(ctx, { preferDraft: true }).name).toBe("Half done");
  });

  it("pre-fills a new brand form with what the account already knows", async () => {
    const user = await newUser("BRAND_OWNER", "Kabir Rao");
    const values = profileFormValues(await getOnboardingContext(user.id), { preferDraft: true });
    expect(values.contactName).toBe("Kabir Rao");
    expect(values.businessEmail).toBe(user.email);
  });
});

describe("completing onboarding", () => {
  it("brand: creates the brand with every field, finishes onboarding and clears the draft — atomically audited", async () => {
    const user = await newUser("BRAND_OWNER");
    await saveOnboardingDraft(user.id, "BRAND_OWNER", { name: "draft" });
    const values = brandProfileSchema().parse({
      name: "Soundwave Audio",
      businessEmail: "partners@soundwave.in",
      contactName: "Riya Shah",
      description: "Everyday audio gear designed in India for students and commuters.",
      industry: "Consumer electronics",
      productCategories: ["Electronics & gadgets"],
      collaborationTypes: ["AFFILIATE", "UGC"],
      instagramUrl: "instagram.com/soundwave",
      city: "Pune",
      state: "Maharashtra",
    });
    const res = await saveProfile(user.id, { role: "BRAND_OWNER", values }, { complete: true });
    const brand = await prisma.brand.findUniqueOrThrow({ where: { ownerId: user.id } });
    expect(res.publicPath).toBe(`/brands/${brand.slug}`);
    expect(brand).toMatchObject({ name: "Soundwave Audio", businessEmail: "partners@soundwave.in", city: "Pune", collaborationTypes: ["AFFILIATE", "UGC"] });
    expect(brand.socialLinks).toEqual({ instagram: "https://instagram.com/soundwave" });
    const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(row.onboardingCompletedAt).not.toBeNull();
    expect(row.onboardingDraft).toBeNull();
    const actions = (await prisma.auditLog.findMany({ where: { userId: user.id }, select: { action: true } })).map((a) => a.action);
    expect(actions).toEqual(expect.arrayContaining(["BRAND_CREATED", "ONBOARDING_COMPLETED"]));
    expect((await profileCompletionFor(user.id, "BRAND_OWNER"))?.percent).toBeGreaterThan(0);
  });

  it("creator: creates the public profile and composes the directory location", async () => {
    const user = await newUser("CREATOR");
    const username = handle();
    const values = creatorProfileOnboardingSchema("required").parse({
      displayName: "Arjun Mehta",
      username,
      profileImageUrl: "/uploads/creators/x/a.webp",
      bio: "Honest gadget reviews for students, two videos a week.",
      category: "Technology",
      city: "Bengaluru",
      state: "Karnataka",
      collaborationPreferences: ["PAID"],
      otherLinks: "x.com/arjun",
    });
    await saveProfile(user.id, { role: "CREATOR", values }, { complete: true });
    const profile = await prisma.creatorProfile.findUniqueOrThrow({ where: { userId: user.id } });
    expect(profile).toMatchObject({ username, location: "Bengaluru, Karnataka", category: "Technology", collaborationPreferences: ["PAID"] });
    expect(profile.otherLinks).toEqual(["https://x.com/arjun"]);
  });

  it("customer: writes the customer profile and the account name/photo", async () => {
    const user = await newUser("CUSTOMER");
    const values = customerProfileSchema().parse({ name: "Neha Kapoor", username: handle(), country: "India", city: "Delhi", interests: ["Beauty"], avatarUrl: "/uploads/avatars/n.webp" });
    await saveProfile(user.id, { role: "CUSTOMER", values }, { complete: true });
    const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, include: { customerProfile: true } });
    expect(row).toMatchObject({ name: "Neha Kapoor", avatarUrl: "/uploads/avatars/n.webp" });
    expect(row.customerProfile).toMatchObject({ city: "Delhi", interests: ["Beauty"] });
    expect((await profileCompletionFor(user.id, "CUSTOMER"))?.percent).toBe(75);
  });

  it("a taken username is a friendly error and nothing is half-written", async () => {
    const taken = handle();
    await makeCreator({ username: taken });
    const user = await newUser("CREATOR");
    const values = creatorProfileOnboardingSchema().parse({ displayName: "Copy Cat", username: taken, bio: "Twenty characters of bio text.", category: "Food" });
    await expect(saveProfile(user.id, { role: "CREATOR", values }, { complete: true })).rejects.toMatchObject({ name: "OnboardingError", field: "username" });
    const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(row.onboardingCompletedAt).toBeNull();
    expect(await prisma.creatorProfile.count({ where: { userId: user.id } })).toBe(0);
  });

  it("refuses to save a profile for a role the account does not have", async () => {
    const user = await newUser("CUSTOMER");
    const values = brandProfileSchema().parse({ name: "Sneaky", businessEmail: "a@b.in", contactName: "A B", description: "Trying to create a brand as a customer.", industry: "Other" });
    await expect(saveProfile(user.id, { role: "BRAND_OWNER", values }, { complete: true })).rejects.toBeInstanceOf(OnboardingError);
    expect(await prisma.brand.count({ where: { ownerId: user.id } })).toBe(0);
  });
});

describe("edit profile", () => {
  it("updates an existing brand without touching the slug, and keeps creator extras when absent", async () => {
    const { user, brand } = await makeOwnerWithBrand("Old Name");
    const values = brandProfileSchema().parse({ name: "New Name", businessEmail: "x@y.in", contactName: "X Y", description: "A fresh description of the brand.", industry: "Education" });
    await saveProfile(user.id, { role: "BRAND_OWNER", values }, { complete: false });
    const after = await prisma.brand.findUniqueOrThrow({ where: { id: brand.id } });
    expect(after).toMatchObject({ name: "New Name", slug: brand.slug, industry: "Education" });

    const creator = await makeCreator(); // has instagramFollowers: 1000
    const profile = await prisma.creatorProfile.findUniqueOrThrow({ where: { userId: creator.id } });
    const cv = creatorProfileOnboardingSchema().parse({ displayName: "Renamed", username: profile.username, bio: "An updated bio that is long enough.", category: "Gaming" });
    await saveProfile(creator.id, { role: "CREATOR", values: cv }, { complete: false });
    const updated = await prisma.creatorProfile.findUniqueOrThrow({ where: { userId: creator.id } });
    expect(updated).toMatchObject({ displayName: "Renamed", category: "Gaming", instagramFollowers: 1000 });
  });
});

describe("changing role during onboarding", () => {
  it("is allowed while nothing depends on the role, and audited", async () => {
    const user = await newUser("CUSTOMER");
    expect(await roleChangeBlockers(user.id)).toEqual([]);
    await changeOnboardingRole(user.id, "CUSTOMER", "CREATOR");
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).role).toBe("CREATOR");
    expect(await prisma.auditLog.findFirst({ where: { userId: user.id, action: "ONBOARDING_ROLE_CHANGED" } })).not.toBeNull();
  });

  it("is blocked once a profile exists or onboarding is complete", async () => {
    const { user } = await makeOwnerWithBrand();
    expect((await roleChangeBlockers(user.id)).length).toBeGreaterThan(0);
    await expect(changeOnboardingRole(user.id, "BRAND_OWNER", "CUSTOMER")).rejects.toBeInstanceOf(OnboardingError);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).role).toBe("BRAND_OWNER");
  });
});
