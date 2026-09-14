import { prisma } from "@/lib/db/prisma";
import { createUser } from "@/lib/services/users";
import { createBrand } from "@/lib/services/brands";
import { createProduct } from "@/lib/services/products";
import { campaignFormSchema, type CampaignFormValues } from "@/lib/validation/campaign";
import { brandSchema } from "@/lib/validation/brand";
import { productSchema } from "@/lib/validation/product";

let counter = 0;
export const uniq = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${++counter}`;

export async function makeOwnerWithBrand(name = "Test Brand") {
  const user = await createUser({ name: "Owner", email: `${uniq("owner")}@test.local`, password: "Password1", role: "BRAND_OWNER" });
  const brand = await createBrand(user.id, brandSchema.parse({ name, industry: "Consumer electronics", website: "https://example.com" }));
  const product = await createProduct(
    brand.id,
    brand.name,
    user.id,
    productSchema.parse({ name: "Test Headphones", price: 1499, purchaseUrl: "https://example.com/p/test", category: "Headphones & audio" }),
  );
  return { user, brand, product };
}

export async function makeCreator(overrides: Partial<{ username: string }> = {}) {
  const user = await createUser({ name: "Creator", email: `${uniq("creator")}@test.local`, password: "Password1", role: "CREATOR" });
  await prisma.creatorProfile.create({
    data: { userId: user.id, displayName: "Creator", username: overrides.username ?? uniq("creator").replace(/-/g, "_"), instagramFollowers: 1000 },
  });
  return user;
}

export async function makeCustomer() {
  return createUser({ name: "Customer", email: `${uniq("customer")}@test.local`, password: "Password1", role: "CUSTOMER" });
}

export function campaignValues(productId: string, overrides: Partial<Record<string, unknown>> = {}): CampaignFormValues {
  return campaignFormSchema.parse({
    productId,
    name: "Launch Campaign",
    description: "",
    offerTitle: "",
    offerDescription: "",
    campaignType: "HYBRID",
    rewardType: "FIXED_AMOUNT",
    customerRewardValue: 50,
    creatorCommissionType: "PERCENTAGE",
    creatorCommissionValue: 10,
    currency: "INR",
    requiresApproval: true,
    newCustomerOnly: false,
    minimumPurchaseAmount: "",
    attributionWindowDays: 30,
    maxRewardPerCustomer: "",
    budget: "",
    terms: "",
    startDate: "2026-01-01",
    endDate: "",
    ...overrides,
  });
}
