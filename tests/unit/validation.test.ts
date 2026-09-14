import { describe, expect, it } from "vitest";
import { registerSchema, loginSchema } from "@/lib/validation/auth";
import { brandSchema } from "@/lib/validation/brand";
import { productSchema } from "@/lib/validation/product";
import { campaignFormSchema, toCampaignData, type CampaignFormInput } from "@/lib/validation/campaign";
import { generateReferralCode, isReferralCodeFormat, normalizeReferralCode } from "@/lib/utils/codes";
import { slugify } from "@/lib/utils/slug";
import { roleForDashboardPath, roleHome } from "@/lib/auth/roles";

const validCampaign: CampaignFormInput = {
  productId: "prod_1",
  name: "Weekend Burger Offer",
  description: "",
  offerTitle: "₹100 off",
  offerDescription: "",
  campaignType: "HYBRID",
  rewardType: "FIXED_AMOUNT",
  customerRewardValue: "50" as unknown as number,
  creatorCommissionType: "PERCENTAGE",
  creatorCommissionValue: "10" as unknown as number,
  currency: "INR",
  requiresApproval: true,
  newCustomerOnly: true,
  minimumPurchaseAmount: "500" as unknown as number,
  attributionWindowDays: "30" as unknown as number,
  maxRewardPerCustomer: "" as unknown as number,
  budget: "10000" as unknown as number,
  startDate: "2026-09-13" as unknown as Date,
  endDate: "2026-12-31" as unknown as Date,
};

describe("auth validation", () => {
  it("accepts a valid registration and normalises email", () => {
    const r = registerSchema.safeParse({ name: "Rohan", email: "  Rohan@Example.com ", password: "Password1", role: "CREATOR" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe("rohan@example.com");
  });
  it("rejects weak passwords, bad emails and admin self-registration", () => {
    expect(registerSchema.safeParse({ name: "R", email: "x", password: "short", role: "CREATOR" }).success).toBe(false);
    expect(registerSchema.safeParse({ name: "Rohan", email: "r@x.com", password: "onlyletters", role: "CREATOR" }).success).toBe(false);
    expect(registerSchema.safeParse({ name: "Rohan", email: "r@x.com", password: "Password1", role: "ADMIN" }).success).toBe(false);
    expect(registerSchema.safeParse({ name: "Rohan", email: "r@x.com", password: "Password1", role: "RESTAURANT_OWNER" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "r@x.com", password: "" }).success).toBe(false);
  });
});

describe("brand & product validation", () => {
  it("brand requires a name and validates URLs", () => {
    expect(brandSchema.safeParse({ name: "X" }).success).toBe(false);
    expect(brandSchema.safeParse({ name: "Soundwave", website: "nope" }).success).toBe(false);
    const ok = brandSchema.safeParse({ name: "Soundwave", website: "", supportEmail: "" });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.country).toBe("India");
  });
  it("product requires a price and purchase URL", () => {
    expect(productSchema.safeParse({ name: "Buds", price: 0, purchaseUrl: "https://x.com" }).success).toBe(false);
    expect(productSchema.safeParse({ name: "Buds", price: 999, purchaseUrl: "store" }).success).toBe(false);
    const ok = productSchema.safeParse({ name: "Buds", price: "999", purchaseUrl: "https://x.com/p" });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.status).toBe("ACTIVE");
  });
});

describe("campaign validation", () => {
  it("accepts a valid campaign and converts to minor units / basis points", () => {
    const r = campaignFormSchema.safeParse(validCampaign);
    expect(r.success).toBe(true);
    if (!r.success) return;
    const data = toCampaignData(r.data);
    expect(data.customerRewardValue).toBe(5_000);
    expect(data.creatorCommissionValue).toBe(1_000);
    expect(data.minimumPurchaseAmount).toBe(50_000);
    expect(data.maxRewardPerCustomer).toBeNull();
    expect(data.budget).toBe(1_000_000);
    expect(data.startDate).toBeInstanceOf(Date);
    expect(data.endDate).toBeInstanceOf(Date);
  });

  it("rejects invalid reward values", () => {
    expect(campaignFormSchema.safeParse({ ...validCampaign, customerRewardValue: "0" }).success).toBe(false);
    expect(campaignFormSchema.safeParse({ ...validCampaign, campaignType: "CREATOR_AFFILIATE", customerRewardValue: "0" }).success).toBe(true);
    expect(campaignFormSchema.safeParse({ ...validCampaign, productId: "" }).success).toBe(false);
    expect(campaignFormSchema.safeParse({ ...validCampaign, customerRewardValue: "-5" }).success).toBe(false);
    expect(campaignFormSchema.safeParse({ ...validCampaign, rewardType: "PERCENTAGE", customerRewardValue: "150" }).success).toBe(false);
    expect(campaignFormSchema.safeParse({ ...validCampaign, creatorCommissionType: "PERCENTAGE", creatorCommissionValue: "60" }).success).toBe(false);
    expect(campaignFormSchema.safeParse({ ...validCampaign, customerRewardValue: "abc" }).success).toBe(false);
  });

  it("rejects bad dates and eligibility", () => {
    expect(campaignFormSchema.safeParse({ ...validCampaign, endDate: "2026-01-01" }).success).toBe(false);
    expect(campaignFormSchema.safeParse({ ...validCampaign, startDate: "" }).success).toBe(false);
    expect(campaignFormSchema.safeParse({ ...validCampaign, attributionWindowDays: "0" }).success).toBe(false);
    expect(campaignFormSchema.safeParse({ ...validCampaign, attributionWindowDays: "120" }).success).toBe(false);
    expect(campaignFormSchema.safeParse({ ...validCampaign, budget: "0" }).success).toBe(false);
    expect(campaignFormSchema.safeParse({ ...validCampaign, name: "ab" }).success).toBe(false);
  });
});

describe("codes, slugs, roles", () => {
  it("referral codes are human readable and unique", () => {
    const codes = new Set<string>();
    for (let i = 0; i < 500; i++) codes.add(generateReferralCode("Arjun Verma", "Soundwave Audio"));
    expect(codes.size).toBe(500);
    const code = generateReferralCode("arjun.tech", "boAt");
    expect(code.startsWith("ARJUNTECH-BOAT-")).toBe(true);
    expect(isReferralCodeFormat(code)).toBe(true);
    expect(isReferralCodeFormat("bad code")).toBe(false);
    expect(normalizeReferralCode(" arjun-boat-4k7q ")).toBe("ARJUN-BOAT-4K7Q");
    expect(generateReferralCode("", "").startsWith("USER-USER-")).toBe(true);
  });

  it("slugify", () => {
    expect(slugify("The Burger House!")).toBe("the-burger-house");
    expect(slugify("  Coffee & Friends ")).toBe("coffee-friends");
    expect(slugify("")).toBe("item");
  });

  it("role routing", () => {
    expect(roleHome("ADMIN")).toBe("/dashboard/admin");
    expect(roleForDashboardPath("/dashboard/brand/campaigns/new")).toBe("BRAND_OWNER");
    expect(roleForDashboardPath("/dashboard/restaurant")).toBeNull();
    expect(roleForDashboardPath("/dashboard/unknown")).toBeNull();
    expect(roleForDashboardPath("/pricing")).toBeNull();
  });
});
