import { describe, expect, it } from "vitest";
import { brandCompletion, creatorCompletion, customerCompletion } from "@/lib/onboarding/completion";
import { safeNext, withNext } from "@/lib/onboarding/paths";
import {
  brandProfileSchema,
  creatorProfileOnboardingSchema,
  customerProfileSchema,
  profileFormObject,
  sanitizeDraft,
} from "@/lib/validation/onboarding";

const brand = {
  name: "Soundwave Audio",
  businessEmail: "Partners@Soundwave.in",
  contactName: "Riya Shah",
  description: "Everyday audio gear designed in India for students and commuters.",
  industry: "Consumer electronics",
};

const creator = {
  displayName: "Arjun Mehta",
  username: "Arjun_Tech",
  bio: "Honest gadget reviews for students, two videos a week.",
  category: "Technology",
};

describe("brand profile schema", () => {
  it("accepts the required fields and normalises them", () => {
    const r = brandProfileSchema().safeParse({ ...brand, instagramUrl: "instagram.com/soundwave", productCategories: ["Electronics & gadgets", "Not a category"], collaborationTypes: "UGC" });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.businessEmail).toBe("partners@soundwave.in");
    expect(r.data.instagramUrl).toBe("https://instagram.com/soundwave");
    expect(r.data.productCategories).toEqual(["Electronics & gadgets"]);
    expect(r.data.collaborationTypes).toEqual(["UGC"]);
    expect(r.data.country).toBe("India");
  });

  it("requires name, business email, contact person, description and industry", () => {
    const r = brandProfileSchema().safeParse({});
    expect(r.success).toBe(false);
    if (r.success) return;
    const fields = new Set(r.error.issues.map((i) => i.path[0]));
    for (const f of ["name", "businessEmail", "contactName", "description", "industry"]) expect(fields.has(f)).toBe(true);
    // Social links, logo and location stay optional.
    for (const f of ["logoUrl", "instagramUrl", "city", "productCategories"]) expect(fields.has(f)).toBe(false);
  });

  it("rejects an unknown industry, a short description and a bad URL", () => {
    expect(brandProfileSchema().safeParse({ ...brand, industry: "Spaceships" }).success).toBe(false);
    expect(brandProfileSchema().safeParse({ ...brand, description: "Too short" }).success).toBe(false);
    expect(brandProfileSchema().safeParse({ ...brand, website: "not a url" }).success).toBe(false);
  });
});

describe("creator profile schema", () => {
  it("lowercases the username and keeps only known choices", () => {
    const r = creatorProfileOnboardingSchema().safeParse({ ...creator, collaborationPreferences: ["PAID", "PRODUCT_REVIEW", "HACK"], audienceSize: "10K–50K" });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.username).toBe("arjun_tech");
    expect(r.data.collaborationPreferences).toEqual(["PAID", "PRODUCT_REVIEW"]);
    // Edit-only self-reported extras are absent (undefined), so saving keeps the stored values.
    expect(r.data.instagramFollowers).toBeUndefined();
  });

  it("requires a profile picture only when uploads are available", () => {
    expect(creatorProfileOnboardingSchema("optional").safeParse(creator).success).toBe(true);
    const r = creatorProfileOnboardingSchema("required").safeParse(creator);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path[0]).toBe("profileImageUrl");
    expect(creatorProfileOnboardingSchema("required").safeParse({ ...creator, profileImageUrl: "/uploads/creators/u1/a.webp" }).success).toBe(true);
  });

  it("rejects bad usernames, unknown categories and invalid audience sizes", () => {
    expect(creatorProfileOnboardingSchema().safeParse({ ...creator, username: "a!" }).success).toBe(false);
    expect(creatorProfileOnboardingSchema().safeParse({ ...creator, category: "Astrology" }).success).toBe(false);
    expect(creatorProfileOnboardingSchema().safeParse({ ...creator, audienceSize: "a lot" }).success).toBe(false);
  });

  it("parses other links one per line and caps them at five", () => {
    const ok = creatorProfileOnboardingSchema().safeParse({ ...creator, otherLinks: "x.com/arjun\nhttps://threads.net/@arjun" });
    expect(ok.success && ok.data.otherLinks).toEqual(["https://x.com/arjun", "https://threads.net/@arjun"]);
    const tooMany = Array.from({ length: 6 }, (_, i) => `https://site${i}.com`).join("\n");
    expect(creatorProfileOnboardingSchema().safeParse({ ...creator, otherLinks: tooMany }).success).toBe(false);
  });
});

describe("customer profile schema", () => {
  it("needs name, username and country; gender accepts 'prefer not to say'", () => {
    expect(customerProfileSchema().safeParse({ name: "Neha", username: "neha_k", country: "India", gender: "PREFER_NOT_TO_SAY", interests: ["Beauty", "Fitness"] }).success).toBe(true);
    expect(customerProfileSchema().safeParse({ name: "Neha", username: "neha_k", country: "" }).success).toBe(false);
    expect(customerProfileSchema().safeParse({ name: "Neha", username: "neha_k", country: "India", gender: "other" }).success).toBe(false);
  });
});

describe("form plumbing", () => {
  it("collects checkbox groups as arrays and ignores unknown keys", () => {
    const fd = new FormData();
    fd.append("name", "Soundwave");
    fd.append("productCategories", "Pets");
    fd.append("productCategories", "Baby & kids");
    fd.append("role", "ADMIN");
    fd.append("$ACTION_ID_abc", "");
    const obj = profileFormObject("BRAND_OWNER", fd);
    expect(obj.name).toBe("Soundwave");
    expect(obj.productCategories).toEqual(["Pets", "Baby & kids"]);
    expect(obj).not.toHaveProperty("role");
    expect(Object.keys(obj).some((k) => k.startsWith("$"))).toBe(false);
  });

  it("bounds a saved draft: known fields only, capped lengths and list sizes", () => {
    const draft = sanitizeDraft("CUSTOMER", { name: "x".repeat(5000), interests: Array.from({ length: 50 }, () => "Fitness"), passwordHash: "nope", nested: { a: 1 } });
    expect((draft.name as string).length).toBe(3000);
    expect((draft.interests as string[]).length).toBe(20);
    expect(draft).not.toHaveProperty("passwordHash");
    expect(draft).not.toHaveProperty("nested");
    expect(sanitizeDraft("CREATOR", "garbage")).toEqual({ collaborationPreferences: [], interestedCategories: [] });
  });
});

describe("profile completion", () => {
  it("scores by weight and lists the most valuable suggestions first", () => {
    const empty = brandCompletion({});
    expect(empty.percent).toBe(0);
    expect(empty.suggestions[0]).toMatch(/logo|Describe/);

    const partial = brandCompletion({ logoUrl: "/uploads/x.png", description: "A".repeat(50), website: "https://a.in", industry: "Education" });
    expect(partial.percent).toBe(50);
    expect(partial.suggestions).toContain("Add your social media links.");
    expect(partial.suggestions).not.toContain("Add your website.");
  });

  it("reaches 100% only with the meaningful fields filled", () => {
    const full = creatorCompletion({
      profileImageUrl: "/p.png",
      bio: "B".repeat(60),
      instagramUrl: "https://instagram.com/a",
      category: "Food",
      contentDescription: "Reels",
      displayName: "A",
      username: "a_a",
      primaryPlatform: "Instagram",
      audienceSize: "1K–10K",
      contentLanguage: "Hindi",
      city: "Pune",
      collaborationPreferences: ["PAID"],
      interestedCategories: ["Pets"],
    });
    expect(full.percent).toBe(100);
    expect(full.suggestions).toEqual([]);
    // A one-word bio does not count as a bio.
    expect(creatorCompletion({ bio: "Hi" }).checks.find((c) => c.key === "bio")?.done).toBe(false);
  });

  it("customer interests weigh the most", () => {
    expect(customerCompletion({ interests: ["Food"] }).percent).toBe(25);
    expect(customerCompletion({}).suggestions[0]).toBe("Add your interests.");
  });
});

describe("post-onboarding destination", () => {
  it("keeps same-site paths only, never loops back into onboarding", () => {
    expect(safeNext("/campaigns/abc")).toBe("/campaigns/abc");
    for (const bad of ["https://evil.com", "//evil.com", "/\\evil.com", "/onboarding/review", "/get-started", "/auth/login", 42, null]) {
      expect(safeNext(bad)).toBeNull();
    }
    expect(withNext("/onboarding/profile", "/campaigns/a b")).toBe("/onboarding/profile?next=%2Fcampaigns%2Fa%20b");
    expect(withNext("/onboarding/profile", null)).toBe("/onboarding/profile");
  });
});
