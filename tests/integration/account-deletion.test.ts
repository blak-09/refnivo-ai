import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { AccountDeletionError, deleteOwnAccount, previewAccountDeletion } from "@/lib/services/account-deletion";
import { createCampaign, transitionCampaign } from "@/lib/services/campaigns";
import { recordOrder, verifyConversion } from "@/lib/services/conversions";
import { resolveGoogleSignIn } from "@/lib/services/oauth";
import { joinCampaign } from "@/lib/services/partners";
import { requestPayout } from "@/lib/services/payouts";
import { resolveReferralCode } from "@/lib/services/tracking";
import { createUser } from "@/lib/services/users";
import { classifySession } from "@/lib/auth/session-state";
import { campaignValues, makeCreator, makeCustomer, makeOwnerWithBrand, uniq } from "../helpers";

afterAll(() => prisma.$disconnect());

async function liveCampaign() {
  const owner = await makeOwnerWithBrand(`Del ${uniq("b")}`);
  const campaign = await createCampaign(
    owner.brand.id,
    owner.brand.name,
    owner.user.id,
    campaignValues(owner.product.id, { name: `Del ${uniq("c")}`, requiresApproval: false, creatorCommissionType: "FIXED_AMOUNT", creatorCommissionValue: 600 }),
  );
  await transitionCampaign(owner.brand.id, owner.user.id, campaign.id, "PUBLISH", { confirmed: true });
  return { owner, campaign };
}

describe("self-service account deletion", () => {
  it("requires the typed phrase and the current password, and never touches another account", async () => {
    const customer = await makeCustomer();
    await expect(deleteOwnAccount(customer.id, { confirmation: "delete", currentPassword: "Password1" })).rejects.toBeInstanceOf(AccountDeletionError);
    await expect(deleteOwnAccount(customer.id, { confirmation: "DELETE", currentPassword: "wrong" })).rejects.toThrow(/password/i);
    await expect(deleteOwnAccount(customer.id, { confirmation: "DELETE" })).rejects.toThrow(/password/i);
    const untouched = await prisma.user.findUniqueOrThrow({ where: { id: customer.id } });
    expect(untouched.deletedAt).toBeNull();
    expect(untouched.email).toBe(customer.email);
  });

  it("customer: personal data anonymised, e-mail freed, sessions invalidated, rewards kept", async () => {
    const { owner, campaign } = await liveCampaign();
    const customer = await makeCustomer();
    const { code } = await joinCampaign({ id: customer.id, name: customer.name, role: "CUSTOMER" }, campaign.id);
    const order = await recordOrder(owner.brand.id, owner.user.id, { code: code!, orderReference: uniq("ORD"), amountMinor: 100_000 });
    await verifyConversion(owner.brand.id, owner.user.id, order.referral.id);

    const preview = await previewAccountDeletion(customer.id);
    expect(preview.hasPassword).toBe(true);
    expect(preview.forfeitedBalance).toBeGreaterThan(0);
    expect(preview.openPayoutRequest).toBe(false);

    const before = await prisma.user.findUniqueOrThrow({ where: { id: customer.id }, select: { sessionVersion: true } });
    await deleteOwnAccount(customer.id, { confirmation: "DELETE", currentPassword: "Password1" });

    const row = await prisma.user.findUniqueOrThrow({ where: { id: customer.id }, include: { rewards: true, referralLinks: true, notifications: true } });
    expect(row.deletedAt).not.toBeNull();
    expect(row.status).toBe("SUSPENDED");
    expect(row.name).toBe("Deleted user");
    expect(row.email).toBe(`deleted+${customer.id}@deleted.invalid`);
    expect(row.passwordHash).toBeNull();
    expect(row.phone).toBeNull();
    expect(row.sessionVersion).toBe(before.sessionVersion + 1);
    expect(row.rewards).toHaveLength(1); // ledger row kept
    expect(row.referralLinks.every((l) => l.status === "DISABLED")).toBe(true);
    expect(row.notifications).toHaveLength(0);
    // The original e-mail can be used again.
    const again = await createUser({ name: "Back", email: customer.email, password: "Password1", role: "CUSTOMER" });
    expect(again.id).not.toBe(customer.id);
    // A live cookie for the deleted account is classified as gone → /auth/signed-out.
    expect(classifySession({ id: customer.id, sessionVersion: row.sessionVersion }, row)).toBe("not-found");
    // Audit trail survives and records the deletion.
    expect(await prisma.auditLog.count({ where: { action: "ACCOUNT_DELETED", entityId: customer.id } })).toBe(1);
    // A second attempt is refused.
    await expect(deleteOwnAccount(customer.id, { confirmation: "DELETE" })).rejects.toThrow(/not found/i);
  });

  it("creator: profile removed, pending applications withdrawn, Google link removed (no password needed)", async () => {
    const { campaign } = await liveCampaign();
    process.env.SIGNUP_APPROVAL = "auto"; // the suite pins "manual"; this case needs a usable Google account
    const res = await resolveGoogleSignIn({ providerAccountId: uniq("sub"), email: `${uniq("g")}@gmail.test`, emailVerified: true, name: "G", picture: null }, "CREATOR");
    process.env.SIGNUP_APPROVAL = "manual";
    if (res.kind !== "ok") throw new Error("expected ok");
    await prisma.creatorProfile.create({ data: { userId: res.user.id, displayName: "G", username: uniq("g").replace(/-/g, "_") } });
    await prisma.campaign.update({ where: { id: campaign.id }, data: { requiresApproval: true } });
    const joined = await joinCampaign({ id: res.user.id, name: "G", role: "CREATOR" }, campaign.id);
    expect(joined.status).toBe("PENDING");

    expect((await previewAccountDeletion(res.user.id)).hasPassword).toBe(false);
    await deleteOwnAccount(res.user.id, { confirmation: "DELETE" });

    expect(await prisma.creatorProfile.findUnique({ where: { userId: res.user.id } })).toBeNull();
    expect(await prisma.oAuthAccount.count({ where: { userId: res.user.id } })).toBe(0);
    expect((await prisma.partnerApplication.findFirstOrThrow({ where: { userId: res.user.id } })).status).toBe("WITHDRAWN");
  });

  it("brand owner: brand suspended, campaigns ended, partner links disabled, partners notified, ledger kept", async () => {
    const { owner, campaign } = await liveCampaign();
    const creator = await makeCreator();
    const { code } = await joinCampaign({ id: creator.id, name: creator.name, role: "CREATOR" }, campaign.id);
    const order = await recordOrder(owner.brand.id, owner.user.id, { code: code!, orderReference: uniq("ORD"), amountMinor: 100_000 });
    await verifyConversion(owner.brand.id, owner.user.id, order.referral.id);

    const preview = await previewAccountDeletion(owner.user.id);
    expect(preview.brand).toMatchObject({ activeCampaigns: 1, partners: 1 });

    await deleteOwnAccount(owner.user.id, { confirmation: "DELETE", currentPassword: "Password1" });

    expect((await prisma.brand.findUniqueOrThrow({ where: { id: owner.brand.id } })).status).toBe("SUSPENDED");
    expect((await prisma.campaign.findUniqueOrThrow({ where: { id: campaign.id } })).status).toBe("ENDED");
    expect((await resolveReferralCode(code!)).ok).toBe(false);
    // The creator keeps their approved commission and learns why the link stopped.
    expect((await prisma.commission.findFirstOrThrow({ where: { creatorId: creator.id } })).status).toBe("APPROVED");
    expect(await prisma.notification.count({ where: { userId: creator.id, title: { contains: "has left Refnivo" } } })).toBe(1);
    // Conversions/products/campaign rows still exist (nothing cascaded).
    expect(await prisma.conversion.count({ where: { brandId: owner.brand.id } })).toBe(1);
    expect(await prisma.product.count({ where: { brandId: owner.brand.id } })).toBe(1);
  });

  it("blocks deletion while a payout request is open, and never deletes admins", async () => {
    const { owner, campaign } = await liveCampaign();
    const creator = await makeCreator();
    const { code } = await joinCampaign({ id: creator.id, name: creator.name, role: "CREATOR" }, campaign.id);
    const order = await recordOrder(owner.brand.id, owner.user.id, { code: code!, orderReference: uniq("ORD"), amountMinor: 100_000 });
    await verifyConversion(owner.brand.id, owner.user.id, order.referral.id);
    await requestPayout(creator.id, "COMMISSION", "UPI");
    expect((await previewAccountDeletion(creator.id)).openPayoutRequest).toBe(true);
    await expect(deleteOwnAccount(creator.id, { confirmation: "DELETE", currentPassword: "Password1" })).rejects.toThrow(/payout request in progress/i);

    const admin = await createUser({ name: "Admin", email: `${uniq("admin")}@test.local`, password: "Password1", role: "ADMIN" });
    await expect(deleteOwnAccount(admin.id, { confirmation: "DELETE", currentPassword: "Password1" })).rejects.toThrow(/Admin accounts/);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: admin.id } })).deletedAt).toBeNull();
  });
});
