import { afterAll, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import { changePassword, createUser, EmailTakenError, WrongPasswordError } from "@/lib/services/users";
import { updateBrand } from "@/lib/services/brands";
import { archiveProduct, createProduct, ProductError, updateProduct } from "@/lib/services/products";
import { createCampaign, transitionCampaign } from "@/lib/services/campaigns";
import { brandSchema } from "@/lib/validation/brand";
import { productSchema } from "@/lib/validation/product";
import { campaignValues, makeOwnerWithBrand, uniq } from "../helpers";

afterAll(() => prisma.$disconnect());

describe("users service", () => {
  it("registers a user with a hashed password and an audit log", async () => {
    const email = `${uniq("u")}@test.local`;
    const user = await createUser({ name: "Asha", email: email.toUpperCase(), password: "Password1", role: "CUSTOMER" });
    expect(user.email).toBe(email);
    const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(await bcrypt.compare("Password1", row.passwordHash)).toBe(true);
    expect(await prisma.auditLog.findFirst({ where: { userId: user.id, action: "USER_REGISTERED" } })).not.toBeNull();
  });

  it("rejects duplicate emails", async () => {
    const email = `${uniq("dup")}@test.local`;
    await createUser({ name: "A", email, password: "Password1", role: "CUSTOMER" });
    await expect(createUser({ name: "B", email, password: "Password1", role: "CREATOR" })).rejects.toBeInstanceOf(EmailTakenError);
  });

  it("changes password only with the correct current password", async () => {
    const user = await createUser({ name: "P", email: `${uniq("pw")}@test.local`, password: "Password1", role: "CUSTOMER" });
    await expect(changePassword(user.id, "wrong", "NewPassword2")).rejects.toBeInstanceOf(WrongPasswordError);
    await changePassword(user.id, "Password1", "NewPassword2");
    const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(await bcrypt.compare("NewPassword2", row.passwordHash)).toBe(true);
  });
});

describe("brands", () => {
  it("creates brands with unique slugs and social links", async () => {
    const a = await makeOwnerWithBrand("Slug Audio");
    const b = await makeOwnerWithBrand("Slug Audio");
    expect(a.brand.slug).toBe("slug-audio");
    expect(b.brand.slug).toBe("slug-audio-2");
    const updated = await updateBrand(a.brand.id, a.user.id, brandSchema.parse({ name: "Slug Audio", instagramUrl: "https://instagram.com/slug", youtubeUrl: "" }));
    expect(updated?.socialLinks).toEqual({ instagram: "https://instagram.com/slug" });
  });

  it("a non-owner cannot update another brand", async () => {
    const a = await makeOwnerWithBrand("Owner A Brand");
    const b = await makeOwnerWithBrand("Owner B Brand");
    const result = await updateBrand(a.brand.id, b.user.id, brandSchema.parse({ name: "Hijacked" }));
    expect(result).toBeNull();
    expect((await prisma.brand.findUniqueOrThrow({ where: { id: a.brand.id } })).name).toBe("Owner A Brand");
  });
});

describe("products", () => {
  it("stores price in paise, unique slug and SKU per brand", async () => {
    const { user, brand, product } = await makeOwnerWithBrand("Sku Brand");
    expect(product.price).toBe(149_900);
    expect(product.slug).toBe("sku-brand-test-headphones");
    const second = await createProduct(brand.id, brand.name, user.id, productSchema.parse({ name: "Test Headphones", price: 999, purchaseUrl: "https://example.com/p/2", sku: "X-1" }));
    expect(second.slug).toBe("sku-brand-test-headphones-2");
    await expect(
      createProduct(brand.id, brand.name, user.id, productSchema.parse({ name: "Other", price: 999, purchaseUrl: "https://example.com/p/3", sku: "X-1" })),
    ).rejects.toBeInstanceOf(ProductError);
  });

  it("another brand cannot edit the product; archiving is blocked while campaigns are live", async () => {
    const a = await makeOwnerWithBrand("Prod A");
    const b = await makeOwnerWithBrand("Prod B");
    await expect(updateProduct(b.brand.id, b.brand.name, b.user.id, a.product.id, productSchema.parse({ name: "Stolen", price: 1, purchaseUrl: "https://example.com" }))).rejects.toBeInstanceOf(ProductError);

    const c = await createCampaign(a.brand.id, a.brand.name, a.user.id, campaignValues(a.product.id));
    await transitionCampaign(a.brand.id, a.user.id, c.id, "PUBLISH", { confirmed: true });
    await expect(archiveProduct(a.brand.id, a.user.id, a.product.id)).rejects.toThrow(/live campaigns/i);
    await transitionCampaign(a.brand.id, a.user.id, c.id, "END");
    expect((await archiveProduct(a.brand.id, a.user.id, a.product.id)).status).toBe("ARCHIVED");
  });
});
