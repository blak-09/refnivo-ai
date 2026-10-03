import { Prisma, type WalletEntryType } from "@prisma/client";
import { prisma, transaction } from "@/lib/db/prisma";
import { formatMoney } from "@/lib/money";
import { paymentsEnabled } from "@/lib/payments";
import { recordAudit } from "./audit";

/**
 * Brand wallet: a prepaid balance that funds the commissions and rewards a brand
 * owes. Money comes in through a Razorpay top-up (lib/services/payments.ts) and
 * goes out when the brand verifies an order (lib/services/conversions.ts); a
 * refunded order gives its amount back.
 *
 * Integrity rules:
 *  - `brand_wallets.balance` only changes in the same transaction as a
 *    `wallet_entries` row, under `SELECT … FOR UPDATE` on the wallet;
 *  - every entry carries a unique idempotency key, so a replayed webhook or a
 *    retried request can never credit or debit twice;
 *  - amounts are integer minor units; debits are stored negative.
 *
 * The wallet is opt-in (BRAND_WALLET_ENABLED=true, and it needs payments on for
 * top-ups). While it is off nothing here is called from the order flow, so
 * existing brands are unaffected.
 */
export class WalletError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WalletError";
  }
}

export const WALLET_TOPUP_MIN = 50_000; // ₹500
export const WALLET_TOPUP_MAX = 50_000_000; // ₹5,00,000
/** Suggested top-up amounts shown as quick picks (minor units). */
export const WALLET_TOPUP_PRESETS = [100_000, 500_000, 1_000_000, 2_500_000];

type Tx = Prisma.TransactionClient;

/** Wallet enforcement is on: verifying an order needs (and debits) wallet balance. */
export function walletEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return (env.BRAND_WALLET_ENABLED ?? "").trim().toLowerCase() === "true";
}

/** Brands can add money right now (wallet on AND checkout configured). */
export function walletTopupAvailable(env: NodeJS.ProcessEnv = process.env): boolean {
  return walletEnabled(env) && paymentsEnabled(env);
}

/** Creates the wallet if needed and locks it for the rest of the transaction. */
async function lockWallet(tx: Tx, brandId: string) {
  await tx.$executeRaw`INSERT INTO "brand_wallets" ("brandId", "balance", "currency", "createdAt", "updatedAt") VALUES (${brandId}, 0, 'INR', now(), now()) ON CONFLICT ("brandId") DO NOTHING`;
  const rows = await tx.$queryRaw<{ balance: number }[]>`SELECT "balance" FROM "brand_wallets" WHERE "brandId" = ${brandId} FOR UPDATE`;
  return rows[0].balance;
}

type EntryInput = {
  brandId: string;
  /** Positive minor units; the sign comes from credit vs debit. */
  amount: number;
  type: WalletEntryType;
  idempotencyKey: string;
  referralId?: string | null;
  paymentTransactionId?: string | null;
  note?: string | null;
  actorId?: string | null;
};

async function applyEntry(tx: Tx, input: EntryInput, signed: number, opts: { allowNegative?: boolean; insufficientMessage?: (balance: number) => string } = {}) {
  if (!Number.isInteger(input.amount) || input.amount <= 0) throw new WalletError("Wallet amounts must be positive whole minor units.");
  const balance = await lockWallet(tx, input.brandId);
  // Idempotency: the same key never applies twice (checked under the lock).
  const existing = await tx.walletEntry.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (existing) return { entry: existing, balance, applied: false };
  const next = balance + signed;
  if (next < 0 && !opts.allowNegative) {
    throw new WalletError(opts.insufficientMessage?.(balance) ?? `Insufficient wallet balance (${formatMoney(balance)}).`);
  }
  const entry = await tx.walletEntry.create({
    data: {
      brandId: input.brandId,
      type: input.type,
      amount: signed,
      balanceAfter: next,
      idempotencyKey: input.idempotencyKey,
      referralId: input.referralId ?? null,
      paymentTransactionId: input.paymentTransactionId ?? null,
      note: input.note ?? null,
      actorId: input.actorId ?? null,
    },
  });
  await tx.brandWallet.update({ where: { brandId: input.brandId }, data: { balance: next } });
  return { entry, balance: next, applied: true };
}

export async function creditWallet(tx: Tx, input: EntryInput) {
  return applyEntry(tx, input, input.amount);
}

export async function debitWallet(tx: Tx, input: EntryInput & { allowNegative?: boolean; insufficientMessage?: (balance: number) => string }) {
  return applyEntry(tx, input, -input.amount, { allowNegative: input.allowNegative, insufficientMessage: input.insufficientMessage });
}

/** Called inside order verification (same transaction): pays what the order owes out of the wallet. */
export async function debitForVerifiedOrder(tx: Tx, input: { brandId: string; referralId: string; owed: number; orderReference: string; actorId: string }) {
  if (input.owed <= 0) return null;
  const { entry } = await debitWallet(tx, {
    brandId: input.brandId,
    amount: input.owed,
    type: "ORDER_DEBIT",
    idempotencyKey: `order:${input.referralId}`,
    referralId: input.referralId,
    note: `Order ${input.orderReference}`,
    actorId: input.actorId,
    insufficientMessage: (balance) =>
      `Your wallet balance (${formatMoney(balance)}) does not cover what this order owes (${formatMoney(input.owed)}). Top up your wallet, then verify it.`,
  });
  return entry;
}

/** Called inside an order refund (same transaction): returns what the order had taken from the wallet. */
export async function creditForReversedOrder(tx: Tx, input: { brandId: string; referralId: string; orderReference: string; actorId: string }) {
  // Only give back what was actually taken: an order verified before the wallet existed took nothing.
  const debit = await tx.walletEntry.findUnique({ where: { idempotencyKey: `order:${input.referralId}` } });
  if (!debit) return null;
  const { entry } = await creditWallet(tx, {
    brandId: input.brandId,
    amount: -debit.amount,
    type: "REVERSAL_CREDIT",
    idempotencyKey: `reversal:${input.referralId}`,
    referralId: input.referralId,
    note: `Refunded order ${input.orderReference}`,
    actorId: input.actorId,
  });
  return entry;
}

/** Admin correction (either sign), always with a reason, audited. */
/** `requestKey` comes from the admin form (one per form view), so a double submit applies once. */
export async function adminAdjustWallet(adminId: string, brandId: string, amountSigned: number, note: string, requestKey: string = crypto.randomUUID()) {
  const reason = note.trim();
  if (!reason) throw new WalletError("Give a reason for the adjustment.");
  if (!Number.isInteger(amountSigned) || amountSigned === 0) throw new WalletError("Enter a non-zero amount.");
  return transaction(async (tx) => {
    const brand = await tx.brand.findUnique({ where: { id: brandId }, select: { id: true } });
    if (!brand) throw new WalletError("Brand not found.");
    const input = { brandId, amount: Math.abs(amountSigned), type: "ADJUSTMENT" as const, idempotencyKey: `adjust:${brandId}:${requestKey}`, note: reason, actorId: adminId };
    const result = amountSigned > 0 ? await creditWallet(tx, input) : await debitWallet(tx, { ...input, allowNegative: true });
    if (result.applied) await recordAudit(
      { userId: adminId, actorRole: "ADMIN", action: "WALLET_ADJUSTED", entityType: "BrandWallet", entityId: brandId, metadata: { amount: amountSigned, note: reason, balanceAfter: result.balance } },
      tx,
    );
    return result;
  });
}

export async function getWalletSummary(brandId: string, take = 50) {
  const [wallet, entries] = await Promise.all([
    prisma.brandWallet.findUnique({ where: { brandId } }),
    prisma.walletEntry.findMany({ where: { brandId }, orderBy: { createdAt: "desc" }, take }),
  ]);
  return { balance: wallet?.balance ?? 0, currency: wallet?.currency ?? "INR", entries };
}

/** Admin: every brand with its wallet (brands without one show a zero balance). */
export async function listWallets(take = 500) {
  const brands = await prisma.brand.findMany({
    orderBy: { name: "asc" },
    take,
    select: { id: true, name: true, slug: true, wallet: { select: { balance: true, currency: true, updatedAt: true } } },
  });
  return brands
    .map((b) => ({ brandId: b.id, name: b.name, slug: b.slug, balance: b.wallet?.balance ?? 0, currency: b.wallet?.currency ?? "INR", updatedAt: b.wallet?.updatedAt ?? null }))
    .sort((a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0));
}

/** Commission + rewards on recorded-but-unverified orders: what verifying them all would debit. */
export async function pendingWalletExposure(brandId: string): Promise<{ amount: number; orders: number }> {
  const where = { referral: { campaign: { brandId } }, status: "PENDING" as const };
  const [c, r, orders] = await Promise.all([
    prisma.commission.aggregate({ where, _sum: { amount: true } }),
    prisma.reward.aggregate({ where, _sum: { amount: true } }),
    prisma.referral.count({ where: { campaign: { brandId }, OR: [{ commissions: { some: { status: "PENDING" } } }, { rewards: { some: { status: "PENDING" } } }] } }),
  ]);
  return { amount: (c._sum.amount ?? 0) + (r._sum.amount ?? 0), orders };
}
