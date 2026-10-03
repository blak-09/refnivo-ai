import type { PayoutAccount } from "@prisma/client";
import { prisma, transaction } from "@/lib/db/prisma";
import { decryptSecret, deriveKey, encryptSecret } from "@/lib/security/secret-box";
import { maskBank, maskVpa, payoutAccountSchema, type PayoutAccountDetails } from "@/lib/validation/payout-account";
import { recordAudit } from "./audit";

/**
 * Where creators and customers are paid.
 *
 * UPI IDs and bank details are encrypted with PAYOUT_ACCOUNT_ENCRYPTION_KEY
 * (AES-256-GCM) before they touch the database. Pages only ever receive the
 * masked label; the full details are decrypted for exactly two purposes — an
 * admin revealing them to pay by hand (audited), and creating the RazorpayX
 * fund account for an automatic payout. Accounts are soft-deleted so past
 * payouts keep pointing at the account they were paid into.
 */
export class PayoutAccountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PayoutAccountError";
  }
}

export const MAX_PAYOUT_ACCOUNTS = 5;
const KEY_LABEL = "PAYOUT_ACCOUNT_ENCRYPTION_KEY";

export function payoutAccountsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  try {
    deriveKey(env.PAYOUT_ACCOUNT_ENCRYPTION_KEY, KEY_LABEL);
    return true;
  } catch {
    return false;
  }
}

function key() {
  return deriveKey(process.env.PAYOUT_ACCOUNT_ENCRYPTION_KEY, KEY_LABEL);
}

/** Safe shape for pages: never the encrypted blob, never provider ids. */
export type PublicPayoutAccount = Pick<PayoutAccount, "id" | "type" | "holderName" | "maskedLabel" | "isDefault" | "createdAt">;
const publicSelect = { id: true, type: true, holderName: true, maskedLabel: true, isDefault: true, createdAt: true } as const;

export async function listPayoutAccounts(userId: string): Promise<PublicPayoutAccount[]> {
  return prisma.payoutAccount.findMany({ where: { userId, deletedAt: null }, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }], select: publicSelect });
}

export function decryptPayoutDetails(account: Pick<PayoutAccount, "encryptedDetails">): PayoutAccountDetails {
  return JSON.parse(decryptSecret(account.encryptedDetails, key())) as PayoutAccountDetails;
}

export async function addPayoutAccount(userId: string, raw: unknown): Promise<PublicPayoutAccount> {
  if (!payoutAccountsEnabled()) throw new PayoutAccountError("Saving payout accounts is not switched on yet.");
  const parsed = payoutAccountSchema.safeParse(raw);
  if (!parsed.success) throw new PayoutAccountError(parsed.error.issues[0]?.message ?? "Check the account details.");
  const input = parsed.data;
  const details: PayoutAccountDetails = input.type === "UPI" ? { vpa: input.vpa } : { accountNumber: input.accountNumber, ifsc: input.ifsc };
  const maskedLabel = input.type === "UPI" ? maskVpa(input.vpa) : maskBank(input.accountNumber, input.ifsc);

  return transaction(async (tx) => {
    // Serialise per user so the limit and the default flag stay consistent.
    await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${userId} FOR UPDATE`;
    const existing = await tx.payoutAccount.findMany({ where: { userId, deletedAt: null } });
    if (existing.length >= MAX_PAYOUT_ACCOUNTS) throw new PayoutAccountError(`You can save up to ${MAX_PAYOUT_ACCOUNTS} payout accounts. Remove one first.`);
    // Duplicate check by decrypting the user's own (few) accounts — details are never stored in a searchable form.
    const same = existing.some((a) => {
      if (a.type !== input.type) return false;
      const d = decryptPayoutDetails(a);
      return "vpa" in d && "vpa" in details ? d.vpa === details.vpa : "accountNumber" in d && "accountNumber" in details && d.accountNumber === details.accountNumber && d.ifsc === details.ifsc;
    });
    if (same) throw new PayoutAccountError("This account is already saved.");

    const created = await tx.payoutAccount.create({
      data: {
        userId,
        type: input.type,
        holderName: input.holderName,
        encryptedDetails: encryptSecret(JSON.stringify(details), key()),
        maskedLabel,
        isDefault: existing.length === 0,
      },
      select: publicSelect,
    });
    await recordAudit({ userId, action: "PAYOUT_ACCOUNT_ADDED", entityType: "PayoutAccount", entityId: created.id, metadata: { type: input.type, label: maskedLabel } }, tx);
    return created;
  });
}

export async function setDefaultPayoutAccount(userId: string, accountId: string) {
  return transaction(async (tx) => {
    const account = await tx.payoutAccount.findFirst({ where: { id: accountId, userId, deletedAt: null }, select: { id: true } });
    if (!account) throw new PayoutAccountError("Payout account not found.");
    await tx.payoutAccount.updateMany({ where: { userId, deletedAt: null }, data: { isDefault: false } });
    await tx.payoutAccount.update({ where: { id: accountId }, data: { isDefault: true } });
  });
}

export async function removePayoutAccount(userId: string, accountId: string) {
  return transaction(async (tx) => {
    const account = await tx.payoutAccount.findFirst({ where: { id: accountId, userId, deletedAt: null } });
    if (!account) throw new PayoutAccountError("Payout account not found.");
    const inUse = await tx.payoutRequest.findFirst({ where: { payoutAccountId: accountId, status: { in: ["REQUESTED", "UNDER_REVIEW", "APPROVED", "PROCESSING"] } }, select: { id: true } });
    if (inUse) throw new PayoutAccountError("This account is used by a payout in progress. You can remove it once that payout is finished.");
    await tx.payoutAccount.update({ where: { id: accountId }, data: { deletedAt: new Date(), isDefault: false } });
    if (account.isDefault) {
      const next = await tx.payoutAccount.findFirst({ where: { userId, deletedAt: null }, orderBy: { createdAt: "asc" }, select: { id: true } });
      if (next) await tx.payoutAccount.update({ where: { id: next.id }, data: { isDefault: true } });
    }
    await recordAudit({ userId, action: "PAYOUT_ACCOUNT_REMOVED", entityType: "PayoutAccount", entityId: accountId, metadata: { type: account.type, label: account.maskedLabel } }, tx);
  });
}

/** Admin: full details to pay by hand. Audited every time. */
export async function revealPayoutAccount(adminId: string, accountId: string) {
  const account = await prisma.payoutAccount.findUnique({ where: { id: accountId } });
  if (!account) throw new PayoutAccountError("Payout account not found.");
  const details = decryptPayoutDetails(account);
  await recordAudit({ userId: adminId, actorRole: "ADMIN", action: "PAYOUT_ACCOUNT_REVEALED", entityType: "PayoutAccount", entityId: accountId, metadata: { type: account.type, ownerId: account.userId } });
  return { type: account.type, holderName: account.holderName, ...details };
}
