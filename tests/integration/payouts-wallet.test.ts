import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/prisma";
import type { CreateOrderInput, CreatedOrder, PaymentProvider, ProviderPayment, RefundResult } from "@/lib/payments";
import { createCampaign, transitionCampaign } from "@/lib/services/campaigns";
import { recordOrder, reverseConversion, verifyConversion } from "@/lib/services/conversions";
import { joinCampaign } from "@/lib/services/partners";
import { addPayoutAccount, decryptPayoutDetails, listPayoutAccounts, MAX_PAYOUT_ACCOUNTS, removePayoutAccount, revealPayoutAccount } from "@/lib/services/payout-accounts";
import { requestPayout, reviewPayout } from "@/lib/services/payouts";
import { applyProviderPayment, refundPayment, startWalletTopup } from "@/lib/services/payments";
import { adminAdjustWallet, getWalletSummary } from "@/lib/services/wallet";
import { handlePayoutWebhook, refreshAutoPayout, startAutoPayout } from "@/lib/services/auto-payouts";
import { createUser } from "@/lib/services/users";
import { campaignValues, makeCreator, makeOwnerWithBrand, uniq } from "../helpers";

/**
 * Payout accounts (encrypted), the brand wallet ledger and RazorpayX payouts,
 * against the real test database. RazorpayX itself is replaced by a fake
 * `fetch`, so what is proven is our side: what we send, and what we do with
 * each answer.
 */
const ENV_KEYS = ["PAYOUT_ACCOUNT_ENCRYPTION_KEY", "BRAND_WALLET_ENABLED", "PAYOUT_PROVIDER", "RAZORPAYX_KEY_ID", "RAZORPAYX_KEY_SECRET", "RAZORPAYX_ACCOUNT_NUMBER", "RAZORPAYX_WEBHOOK_SECRET"] as const;
const saved: Record<string, string | undefined> = {};

beforeAll(() => {
  for (const k of ENV_KEYS) saved[k] = process.env[k];
  process.env.PAYOUT_ACCOUNT_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
});
afterEach(() => {
  process.env.BRAND_WALLET_ENABLED = "";
  process.env.PAYOUT_PROVIDER = "";
  vi.unstubAllGlobals();
});
afterAll(async () => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  await prisma.$disconnect();
});

async function liveCampaign() {
  const owner = await makeOwnerWithBrand(`Wallet ${uniq("b")}`);
  const campaign = await createCampaign(
    owner.brand.id,
    owner.brand.name,
    owner.user.id,
    campaignValues(owner.product.id, { name: `Wallet ${uniq("c")}`, requiresApproval: false, creatorCommissionType: "FIXED_AMOUNT", creatorCommissionValue: 600 }),
  );
  await transitionCampaign(owner.brand.id, owner.user.id, campaign.id, "PUBLISH", { confirmed: true });
  return { owner, campaign };
}

async function makeAdmin() {
  const admin = await createUser({ name: "Admin", email: `${uniq("admin")}@test.local`, password: "Password1", role: "ADMIN" });
  await prisma.user.update({ where: { id: admin.id }, data: { status: "APPROVED" } });
  return admin;
}

/** Creator with one verified ₹600 commission and an approved payout request into a saved UPI account. */
async function approvedPayout() {
  const { owner, campaign } = await liveCampaign();
  const creator = await makeCreator();
  const { code } = await joinCampaign({ id: creator.id, name: creator.name, role: "CREATOR" }, campaign.id);
  const order = await recordOrder(owner.brand.id, owner.user.id, { code: code!, orderReference: uniq("ORD"), amountMinor: 250_000 });
  await verifyConversion(owner.brand.id, owner.user.id, order.referral.id);
  const account = await addPayoutAccount(creator.id, { type: "UPI", holderName: "Test Creator", vpa: "creator@okicici" });
  const admin = await makeAdmin();
  const request = await requestPayout(creator.id, "COMMISSION", "UPI", new Date(), { payoutAccountId: account.id });
  await reviewPayout(admin.id, request.id, "APPROVE");
  return { owner, creator, admin, request, account, order };
}

describe("saved payout accounts", () => {
  it("stores details encrypted, returns only masked labels, and makes the first one default", async () => {
    const creator = await makeCreator();
    const upi = await addPayoutAccount(creator.id, { type: "UPI", holderName: "Arjun K", vpa: "arjun.k@okicici" });
    expect(upi).toMatchObject({ type: "UPI", maskedLabel: "ar•••@okicici", isDefault: true });
    expect(upi).not.toHaveProperty("encryptedDetails");

    const row = await prisma.payoutAccount.findUniqueOrThrow({ where: { id: upi.id } });
    expect(row.encryptedDetails).not.toContain("arjun");
    expect(decryptPayoutDetails(row)).toEqual({ vpa: "arjun.k@okicici" });

    const bank = await addPayoutAccount(creator.id, { type: "BANK", holderName: "Arjun K", accountNumber: "123456789012", confirmAccountNumber: "123456789012", ifsc: "hdfc0001234" });
    expect(bank).toMatchObject({ maskedLabel: "HDFC0001234 · ••••9012", isDefault: false });
    await expect(addPayoutAccount(creator.id, { type: "UPI", holderName: "Arjun K", vpa: "ARJUN.K@okicici" })).rejects.toThrow(/already saved/);

    // The audit log never carries the details.
    const audits = await prisma.auditLog.findMany({ where: { entityType: "PayoutAccount", userId: creator.id } });
    expect(audits).toHaveLength(2);
    expect(JSON.stringify(audits.map((a) => a.metadata))).not.toMatch(/arjun\.k|123456789012/);
  });

  it("enforces the limit, blocks removing an account an open payout uses, and reassigns the default", async () => {
    const creator = await makeCreator();
    for (let i = 0; i < MAX_PAYOUT_ACCOUNTS; i++) await addPayoutAccount(creator.id, { type: "UPI", holderName: "Limit Test", vpa: `limit${i}@okaxis` });
    await expect(addPayoutAccount(creator.id, { type: "UPI", holderName: "Limit Test", vpa: "one.more@okaxis" })).rejects.toThrow(/up to/);

    const { creator: payee, account } = await approvedPayout();
    await expect(removePayoutAccount(payee.id, account.id)).rejects.toThrow(/payout in progress/);

    const accounts = await listPayoutAccounts(creator.id);
    await removePayoutAccount(creator.id, accounts[0].id);
    const after = await listPayoutAccounts(creator.id);
    expect(after).toHaveLength(MAX_PAYOUT_ACCOUNTS - 1);
    expect(after.filter((a) => a.isDefault)).toHaveLength(1);
    // Soft delete: the row stays for history.
    expect((await prisma.payoutAccount.findUniqueOrThrow({ where: { id: accounts[0].id } })).deletedAt).not.toBeNull();
  });

  it("links the account to the payout request, and the admin reveal is audited", async () => {
    const { request, account, admin } = await approvedPayout();
    const row = await prisma.payoutRequest.findUniqueOrThrow({ where: { id: request.id } });
    expect(row.payoutAccountId).toBe(account.id);
    expect(row.payoutMethod).toBe("UPI · cr•••@okicici");

    const other = await makeCreator();
    await expect(requestPayout(other.id, "COMMISSION", "UPI", new Date(), { payoutAccountId: account.id })).rejects.toThrow(/saved payout accounts|Nothing is eligible/);

    expect(await revealPayoutAccount(admin.id, account.id)).toMatchObject({ type: "UPI", vpa: "creator@okicici" });
    expect(await prisma.auditLog.count({ where: { action: "PAYOUT_ACCOUNT_REVEALED", entityId: account.id, userId: admin.id } })).toBe(1);
  });
});

describe("brand wallet", () => {
  it("verifying an order debits the wallet; without enough balance nothing is verified; a refund credits it back once", async () => {
    process.env.BRAND_WALLET_ENABLED = "true";
    const { owner, campaign } = await liveCampaign();
    const creator = await makeCreator();
    const { code } = await joinCampaign({ id: creator.id, name: creator.name, role: "CREATOR" }, campaign.id);
    const order = await recordOrder(owner.brand.id, owner.user.id, { code: code!, orderReference: uniq("ORD"), amountMinor: 250_000 });

    await expect(verifyConversion(owner.brand.id, owner.user.id, order.referral.id)).rejects.toThrow(/wallet balance/);
    expect((await prisma.referral.findUniqueOrThrow({ where: { id: order.referral.id } })).status).toBe("PURCHASED");
    expect((await prisma.commission.findFirstOrThrow({ where: { referralId: order.referral.id } })).status).toBe("PENDING");

    const admin = await makeAdmin();
    const key = uniq("adj");
    await adminAdjustWallet(admin.id, owner.brand.id, 100_000, "NEFT received", key);
    await adminAdjustWallet(admin.id, owner.brand.id, 100_000, "NEFT received", key); // double submit applies once
    expect((await getWalletSummary(owner.brand.id)).balance).toBe(100_000);

    await verifyConversion(owner.brand.id, owner.user.id, order.referral.id);
    let wallet = await getWalletSummary(owner.brand.id);
    expect(wallet.balance).toBe(40_000);
    expect(wallet.entries[0]).toMatchObject({ type: "ORDER_DEBIT", amount: -60_000, balanceAfter: 40_000 });

    await reverseConversion(owner.brand.id, owner.user.id, order.referral.id, "returned");
    wallet = await getWalletSummary(owner.brand.id);
    expect(wallet.balance).toBe(100_000);
    expect(wallet.entries[0]).toMatchObject({ type: "REVERSAL_CREDIT", amount: 60_000 });
    expect(await prisma.auditLog.count({ where: { action: "WALLET_ADJUSTED", entityId: owner.brand.id } })).toBe(1);
  });

  it("an order verified before the wallet was on gets nothing back on refund", async () => {
    const { owner, campaign } = await liveCampaign();
    const creator = await makeCreator();
    const { code } = await joinCampaign({ id: creator.id, name: creator.name, role: "CREATOR" }, campaign.id);
    const order = await recordOrder(owner.brand.id, owner.user.id, { code: code!, orderReference: uniq("ORD"), amountMinor: 250_000 });
    await verifyConversion(owner.brand.id, owner.user.id, order.referral.id);
    process.env.BRAND_WALLET_ENABLED = "true";
    await reverseConversion(owner.brand.id, owner.user.id, order.referral.id, "returned");
    expect((await getWalletSummary(owner.brand.id)).balance).toBe(0);
  });

  it("a confirmed top-up credits the wallet exactly once; a refund of it debits", async () => {
    let seq = 0;
    const provider: PaymentProvider = {
      key: "STUB",
      publicKey: () => "pk",
      createOrder: async (input: CreateOrderInput): Promise<CreatedOrder> => ({ providerOrderId: `wt_order_${uniq("o")}_${++seq}`, publicKey: "pk", amount: input.amount, currency: input.currency }),
      verifyCheckoutSignature: () => true,
      getPayment: async () => {
        throw new Error("unused");
      },
      parseWebhook: () => null,
      refund: async (input: { providerPaymentId: string; amount: number }): Promise<RefundResult> => ({ providerRefundId: `rf_${input.providerPaymentId}`, amount: input.amount, state: "done" }),
    };
    const owner = await makeOwnerWithBrand(`Topup ${uniq("b")}`);
    await expect(startWalletTopup(provider, { userId: owner.user.id, brandId: owner.brand.id, brandName: owner.brand.name, amountMinor: 1_000 })).rejects.toThrow(/between/);
    await expect(startWalletTopup(provider, { userId: owner.user.id, brandId: owner.brand.id, brandName: owner.brand.name, amountMinor: 100_050 })).rejects.toThrow(/whole rupee/);

    const { transaction } = await startWalletTopup(provider, { userId: owner.user.id, brandId: owner.brand.id, brandName: owner.brand.name, amountMinor: 500_000 });
    expect(transaction).toMatchObject({ purpose: "WALLET_TOPUP", amount: 500_000, status: "PENDING" });
    const payment: ProviderPayment = {
      providerPaymentId: `pay_${uniq("p")}`,
      providerOrderId: transaction.providerOrderId!,
      status: "PAID",
      amount: 500_000,
      currency: "INR",
      method: "upi",
      failureCode: null,
      failureReason: null,
      refundedAmount: 0,
    };
    await applyProviderPayment(payment, { source: "webhook" });
    await applyProviderPayment(payment, { source: "verify", expectTransactionId: transaction.id }); // replay
    let wallet = await getWalletSummary(owner.brand.id);
    expect(wallet.balance).toBe(500_000);
    expect(wallet.entries.filter((e) => e.type === "TOPUP")).toHaveLength(1);
    // No plan is granted by a top-up.
    expect(await prisma.brandSubscription.findUnique({ where: { brandId: owner.brand.id } })).toBeNull();

    const admin = await makeAdmin();
    await refundPayment(provider, { transactionId: transaction.id, adminId: admin.id, amount: 200_000 });
    wallet = await getWalletSummary(owner.brand.id);
    expect(wallet.balance).toBe(300_000);
    expect(wallet.entries[0]).toMatchObject({ type: "TOPUP_REFUND", amount: -200_000 });
  });
});

describe("automatic payouts via RazorpayX", () => {
  function useRazorpayX(handler: (url: string, body: Record<string, unknown> | null, headers: Record<string, string>) => { status: number; body: unknown }) {
    Object.assign(process.env, { PAYOUT_PROVIDER: "RAZORPAYX", RAZORPAYX_KEY_ID: "rzp_test_x", RAZORPAYX_KEY_SECRET: "s", RAZORPAYX_ACCOUNT_NUMBER: "2323230000000000", RAZORPAYX_WEBHOOK_SECRET: "w" });
    const calls: { url: string; body: Record<string, unknown> | null; headers: Record<string, string> }[] = [];
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null;
      const headers = (init?.headers ?? {}) as Record<string, string>;
      calls.push({ url, body, headers });
      const res = handler(url, body, headers);
      return new Response(JSON.stringify(res.body), { status: res.status });
    });
    return calls;
  }

  it("creates the contact + fund account once, sends the payout, and the processed webhook marks it PAID with the UTR", async () => {
    const { request, admin, creator, account } = await approvedPayout();
    const calls = useRazorpayX((url, body) => {
      if (url.endsWith("/contacts")) return { status: 200, body: { id: "cont_1" } };
      if (url.endsWith("/fund_accounts")) return { status: 200, body: { id: "fa_1" } };
      if (url.endsWith("/payouts")) return { status: 200, body: { id: `pout_${request.id}`, status: "processing", amount: body?.amount, reference_id: body?.reference_id } };
      return { status: 404, body: {} };
    });

    const started = await startAutoPayout(admin.id, request.id);
    expect(started.status).toBe("PROCESSING");
    const payoutCall = calls.find((c) => c.url.endsWith("/payouts"))!;
    expect(payoutCall.body).toMatchObject({ amount: 60_000, mode: "UPI", fund_account_id: "fa_1", reference_id: request.id });
    expect(payoutCall.headers["X-Payout-Idempotency"]).toBe(`payout-${request.id}-1`);
    expect(calls.find((c) => c.url.endsWith("/fund_accounts"))!.body).toMatchObject({ account_type: "vpa", vpa: { address: "creator@okicici" } });
    expect((await prisma.payoutAccount.findUniqueOrThrow({ where: { id: account.id } })).providerFundAccountId).toBe("fa_1");

    // The commission is not paid until RazorpayX says so.
    expect((await prisma.commission.findFirstOrThrow({ where: { creatorId: creator.id } })).status).toBe("APPROVED");
    await expect(startAutoPayout(admin.id, request.id)).rejects.toThrow(/already has this payout/);

    const event = { id: `pout_${request.id}`, status: "processed" as const, amount: 60_000, utr: "UTR998877", referenceId: request.id, failureReason: null };
    await handlePayoutWebhook("payout.processed", event);
    await handlePayoutWebhook("payout.processed", event); // replay changes nothing
    const paid = await prisma.payoutRequest.findUniqueOrThrow({ where: { id: request.id } });
    expect(paid).toMatchObject({ status: "PAID", payoutReference: "UTR998877", providerStatus: "processed", processedById: admin.id });
    expect((await prisma.commission.findFirstOrThrow({ where: { creatorId: creator.id } })).status).toBe("PAID");
    expect(await prisma.auditLog.count({ where: { action: "PAYOUT_MARK_PAID", entityId: request.id } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { action: "PAYOUT_AUTO_STARTED", entityId: request.id } })).toBe(1);
  });

  it("a timeout leaves it PROCESSING; retry resends the SAME idempotency key; a failure webhook marks it FAILED", async () => {
    const { request, admin } = await approvedPayout();
    let payoutCalls = 0;
    const calls = useRazorpayX((url, body) => {
      if (url.endsWith("/contacts")) return { status: 200, body: { id: "cont_2" } };
      if (url.endsWith("/fund_accounts")) return { status: 200, body: { id: "fa_2" } };
      if (url.endsWith("/payouts")) {
        payoutCalls++;
        return payoutCalls === 1 ? { status: 503, body: {} } : { status: 200, body: { id: `pout_r_${request.id}`, status: "queued", amount: body?.amount, reference_id: request.id } };
      }
      return { status: 404, body: {} };
    });

    await expect(startAutoPayout(admin.id, request.id)).rejects.toThrow(/Retry/);
    let row = await prisma.payoutRequest.findUniqueOrThrow({ where: { id: request.id } });
    expect(row).toMatchObject({ status: "PROCESSING", providerStatus: "unknown", providerPayoutId: null, providerAttempt: 1 });

    await refreshAutoPayout(admin.id, request.id);
    const keys = calls.filter((c) => c.url.endsWith("/payouts")).map((c) => c.headers["X-Payout-Idempotency"]);
    expect(keys).toEqual([`payout-${request.id}-1`, `payout-${request.id}-1`]);
    row = await prisma.payoutRequest.findUniqueOrThrow({ where: { id: request.id } });
    expect(row).toMatchObject({ status: "PROCESSING", providerStatus: "queued", providerPayoutId: `pout_r_${request.id}` });

    await handlePayoutWebhook("payout.reversed", { id: `pout_r_${request.id}`, status: "reversed", amount: 60_000, utr: null, referenceId: request.id, failureReason: "Beneficiary bank offline" });
    row = await prisma.payoutRequest.findUniqueOrThrow({ where: { id: request.id } });
    expect(row.status).toBe("FAILED");
    expect(row.adminNote).toMatch(/Beneficiary bank offline/);

    // Re-approve and pay again: a NEW attempt key.
    await reviewPayout(admin.id, request.id, "APPROVE");
    await startAutoPayout(admin.id, request.id);
    expect(calls.filter((c) => c.url.endsWith("/payouts")).at(-1)!.headers["X-Payout-Idempotency"]).toBe(`payout-${request.id}-2`);
    // The fund account was reused, not created again.
    expect(calls.filter((c) => c.url.endsWith("/fund_accounts"))).toHaveLength(1);
  });

  it("a RazorpayX refusal fails the request with its reason; requests without a saved account cannot be auto-paid", async () => {
    const { request, admin } = await approvedPayout();
    useRazorpayX((url) => {
      if (url.endsWith("/contacts")) return { status: 200, body: { id: "cont_3" } };
      if (url.endsWith("/fund_accounts")) return { status: 200, body: { id: "fa_3" } };
      return { status: 400, body: { error: { code: "BAD_REQUEST_ERROR", description: "Your account does not have enough balance" } } };
    });
    await expect(startAutoPayout(admin.id, request.id)).rejects.toThrow(/enough balance/);
    expect((await prisma.payoutRequest.findUniqueOrThrow({ where: { id: request.id } })).status).toBe("FAILED");

    const { owner, campaign } = await liveCampaign();
    const creator = await makeCreator();
    const { code } = await joinCampaign({ id: creator.id, name: creator.name, role: "CREATOR" }, campaign.id);
    const order = await recordOrder(owner.brand.id, owner.user.id, { code: code!, orderReference: uniq("ORD"), amountMinor: 250_000 });
    await verifyConversion(owner.brand.id, owner.user.id, order.referral.id);
    const manual = await requestPayout(creator.id, "COMMISSION", "UPI");
    await reviewPayout(admin.id, manual.id, "APPROVE");
    await expect(startAutoPayout(admin.id, manual.id)).rejects.toThrow(/no saved payout account/);
  });

  it("is refused entirely when RazorpayX is not configured", async () => {
    const { request, admin } = await approvedPayout();
    await expect(startAutoPayout(admin.id, request.id)).rejects.toThrow(/not switched on/);
    expect((await prisma.payoutRequest.findUniqueOrThrow({ where: { id: request.id } })).status).toBe("APPROVED");
  });
});
