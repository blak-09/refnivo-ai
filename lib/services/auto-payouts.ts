import { prisma, transaction } from "@/lib/db/prisma";
import { formatMoney } from "@/lib/money";
import { FINAL_FAILED, getPayoutProvider, PayoutProviderRejected, PayoutProviderUnavailable, type ProviderPayout, type RazorpayXProvider } from "@/lib/payouts";
import { recordAudit } from "./audit";
import { adminUserIds, notifyMany } from "./notify";
import { decryptPayoutDetails, payoutAccountsEnabled } from "./payout-accounts";
import { PayoutError, reviewPayout, splitSettleable } from "./payouts";

/**
 * Automatic payouts through RazorpayX.
 *
 *   APPROVED ──admin "Pay via RazorpayX"──▶ PROCESSING ──provider──▶ PAID / FAILED
 *
 * - Only an admin starts a payout, and only for an APPROVED request that has a
 *   saved payout account. The request is reconciled with the ledger first, so a
 *   refund that landed after approval is never paid out.
 * - Every attempt has its own idempotency key (`payout-<id>-<attempt>`). If the
 *   provider call times out we do not know whether money moved, so the request
 *   stays PROCESSING and "Retry" resends the SAME key — RazorpayX returns the
 *   original payout instead of paying twice.
 * - The outcome comes from the webhook (or "Refresh status"), and is applied
 *   through reviewPayout — MARK_PAID with the bank/UPI reference (UTR), or FAIL
 *   with the provider's reason — so the ledger rules stay in one place.
 */
export function autoPayoutsEnabled(): boolean {
  return !!getPayoutProvider() && payoutAccountsEnabled();
}

function requireProvider(): RazorpayXProvider {
  const provider = getPayoutProvider();
  if (!provider || !payoutAccountsEnabled()) throw new PayoutError("Automatic payouts are not switched on. Pay by hand and record the reference.");
  return provider;
}

/** Contact + fund account are created once per saved account and reused. */
async function ensureFundAccount(provider: RazorpayXProvider, accountId: string): Promise<string> {
  const account = await prisma.payoutAccount.findUnique({ where: { id: accountId }, include: { user: { select: { id: true, email: true } } } });
  if (!account || account.deletedAt) throw new PayoutError("The payout account on this request was removed. Ask the requester to choose another.");
  if (account.providerFundAccountId) return account.providerFundAccountId;

  const details = decryptPayoutDetails(account);
  const contactId = account.providerContactId ?? (await provider.createContact({ name: account.holderName, email: account.user.email, referenceId: account.user.id }));
  if (!account.providerContactId) await prisma.payoutAccount.update({ where: { id: account.id }, data: { providerContactId: contactId } });
  const fundAccountId = await provider.createFundAccount(contactId, "vpa" in details ? { vpa: details.vpa } : { name: account.holderName, accountNumber: details.accountNumber, ifsc: details.ifsc });
  await prisma.payoutAccount.update({ where: { id: account.id }, data: { providerFundAccountId: fundAccountId } });
  return fundAccountId;
}

/**
 * Starts (or safely retries) the RazorpayX payout for a request.
 * - APPROVED → a new attempt.
 * - PROCESSING with no provider payout id → the last call's outcome is unknown; resend the same attempt.
 */
export async function startAutoPayout(adminId: string, payoutId: string) {
  const provider = requireProvider();
  const before = await prisma.payoutRequest.findUnique({ where: { id: payoutId }, select: { status: true, payoutAccountId: true, providerPayoutId: true, providerStatus: true } });
  if (!before) throw new PayoutError("Payout request not found.");
  if (!before.payoutAccountId) throw new PayoutError("This request has no saved payout account, so it can only be paid by hand.");
  if (before.status === "PROCESSING" && before.providerPayoutId) throw new PayoutError("RazorpayX already has this payout. Use Refresh status.");
  if (before.status === "APPROVED" && before.providerPayoutId && !FINAL_FAILED.includes(before.providerStatus as never)) {
    throw new PayoutError("An earlier RazorpayX attempt has not finished. Refresh its status before paying again.");
  }

  const fundAccountId = await ensureFundAccount(provider, before.payoutAccountId);

  // Claim the request: reconcile, move to PROCESSING, fix the attempt number — all under a row lock.
  const claimed = await transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "payout_requests" WHERE "id" = ${payoutId} FOR UPDATE`;
    const request = await tx.payoutRequest.findUniqueOrThrow({
      where: { id: payoutId },
      include: { items: { select: { id: true, amount: true, commissionId: true, rewardId: true, commission: { select: { status: true } }, reward: { select: { status: true } } } }, payoutAccount: { select: { type: true } } },
    });
    if (request.status === "PROCESSING" && !request.providerPayoutId && request.providerAttempt > 0) {
      return { id: request.id, amount: request.amount, attempt: request.providerAttempt, type: request.payoutAccount?.type ?? "BANK", retry: true };
    }
    if (request.status !== "APPROVED") throw new PayoutError(`Only approved requests can be paid (this one is ${request.status}).`);

    const { settleable, dropped } = splitSettleable(request.items);
    const amount = settleable.reduce((s, i) => s + i.amount, 0);
    if (amount <= 0) throw new PayoutError("Every entry in this request was reversed; nothing is owed. Reject it so the requester sees why.");
    if (dropped.length) await tx.payoutItem.deleteMany({ where: { id: { in: dropped.map((i) => i.id) } } });

    const attempt = request.providerAttempt + 1;
    await tx.payoutRequest.update({
      where: { id: payoutId },
      data: { status: "PROCESSING", amount, provider: provider.key, providerAttempt: attempt, providerStatus: "initiating", providerPayoutId: null, initiatedById: adminId },
    });
    await recordAudit(
      {
        userId: adminId,
        actorRole: "ADMIN",
        action: "PAYOUT_AUTO_STARTED",
        entityType: "PayoutRequest",
        entityId: payoutId,
        metadata: { provider: provider.key, attempt, amount, ...(dropped.length ? { droppedItems: dropped.length, previousAmount: request.amount } : {}) },
      },
      tx,
    );
    return { id: request.id, amount, attempt, type: request.payoutAccount?.type ?? "BANK", retry: false };
  });

  let payout: ProviderPayout;
  try {
    payout = await provider.createPayout({
      fundAccountId,
      amount: claimed.amount,
      mode: claimed.type === "UPI" ? "UPI" : "IMPS",
      referenceId: payoutId,
      idempotencyKey: `payout-${payoutId}-${claimed.attempt}`,
    });
  } catch (err) {
    if (err instanceof PayoutProviderRejected) {
      // Nothing was created: fail the request with RazorpayX's reason. The admin can fix and re-approve.
      await reviewPayout(adminId, payoutId, "FAIL", { note: `RazorpayX refused the payout: ${err.publicMessage}` });
      await prisma.payoutRequest.update({ where: { id: payoutId }, data: { providerStatus: "rejected" } });
      throw new PayoutError(`RazorpayX refused the payout: ${err.publicMessage}`);
    }
    if (err instanceof PayoutProviderUnavailable) {
      await prisma.payoutRequest.update({ where: { id: payoutId }, data: { providerStatus: "unknown" } });
      throw new PayoutError("RazorpayX did not answer, so we cannot tell yet whether the payout was created. Use Retry — it is safe and will not pay twice.");
    }
    throw err;
  }

  await prisma.payoutRequest.update({ where: { id: payoutId }, data: { providerPayoutId: payout.id, providerStatus: payout.status } });
  return applyProviderPayout(payoutId, payout);
}

/** Admin "Refresh status": ask RazorpayX, or resend the unknown attempt. */
export async function refreshAutoPayout(adminId: string, payoutId: string) {
  const provider = requireProvider();
  const request = await prisma.payoutRequest.findUnique({ where: { id: payoutId }, select: { status: true, providerPayoutId: true } });
  if (!request) throw new PayoutError("Payout request not found.");
  if (!request.providerPayoutId) {
    if (request.status === "PROCESSING") return startAutoPayout(adminId, payoutId);
    throw new PayoutError("This request was not sent to RazorpayX.");
  }
  let payout: ProviderPayout;
  try {
    payout = await provider.getPayout(request.providerPayoutId);
  } catch (err) {
    if (err instanceof PayoutProviderUnavailable || err instanceof PayoutProviderRejected) throw new PayoutError("Could not reach RazorpayX. Try again in a minute.");
    throw err;
  }
  return applyProviderPayout(payoutId, payout);
}

/**
 * Applies a provider payout snapshot (from a webhook, a refresh or the create
 * call). Safe to call repeatedly: transitions only happen from PROCESSING.
 */
export async function applyProviderPayout(payoutId: string, payout: ProviderPayout) {
  const request = await prisma.payoutRequest.findUnique({
    where: { id: payoutId },
    select: { id: true, status: true, amount: true, currency: true, initiatedById: true, providerPayoutId: true },
  });
  if (!request) return { applied: false as const, status: null };
  if (request.providerPayoutId && request.providerPayoutId !== payout.id) return { applied: false as const, status: request.status }; // an older attempt
  await prisma.payoutRequest.update({ where: { id: payoutId }, data: { providerPayoutId: payout.id, providerStatus: payout.status } });

  const actor = request.initiatedById;
  if (!actor) return { applied: false as const, status: request.status };

  if (payout.status === "processed" && request.status === "PROCESSING") {
    if (payout.amount !== request.amount) {
      await alertAdmins(payoutId, `RazorpayX paid ${formatMoney(payout.amount, request.currency)} but the request is for ${formatMoney(request.amount, request.currency)}. Check it before marking it paid.`);
      return { applied: false as const, status: request.status };
    }
    const updated = await settle(() => reviewPayout(actor, payoutId, "MARK_PAID", { reference: payout.utr ?? payout.id, note: "Paid automatically via RazorpayX." }));
    return { applied: !!updated, status: updated?.status ?? request.status };
  }
  if (FINAL_FAILED.includes(payout.status)) {
    if (request.status === "PROCESSING") {
      const reason = payout.failureReason ? `: ${payout.failureReason}` : "";
      const updated = await settle(() => reviewPayout(actor, payoutId, "FAIL", { note: `RazorpayX payout ${payout.status}${reason}` }));
      return { applied: !!updated, status: updated?.status ?? request.status };
    }
    if (request.status === "PAID" && payout.status === "reversed") {
      // The bank sent the money back after it was marked paid. Nothing is changed automatically.
      await alertAdmins(payoutId, `RazorpayX reports this paid payout was reversed by the bank${payout.failureReason ? ` (${payout.failureReason})` : ""}. The money is back in RazorpayX — contact the requester.`);
    }
  }
  return { applied: false as const, status: request.status };
}

/** A concurrent webhook/refresh may have applied the same outcome first — that is fine. */
async function settle<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof PayoutError) return null;
    throw err;
  }
}

async function alertAdmins(payoutId: string, body: string) {
  const admins = await adminUserIds();
  await notifyMany(admins, { type: "SYSTEM", title: "RazorpayX payout needs attention", body, href: "/dashboard/admin/payouts", idempotencyKey: `payout-alert:${payoutId}:${body.length}` });
}

/** Webhook entry point (signature already verified by the route). */
export async function handlePayoutWebhook(event: string, payout: ProviderPayout | null) {
  if (!payout || !event.startsWith("payout.")) return { applied: false };
  // reference_id is our request id, so a webhook that beats the create response still finds its request.
  const request =
    (await prisma.payoutRequest.findUnique({ where: { providerPayoutId: payout.id }, select: { id: true } })) ??
    (payout.referenceId ? await prisma.payoutRequest.findFirst({ where: { id: payout.referenceId, provider: "RAZORPAYX" }, select: { id: true } }) : null);
  if (!request) return { applied: false };
  const result = await applyProviderPayout(request.id, payout);
  return { applied: result.applied };
}
