import { Prisma, type ClaimEvidence, type OrderClaimStatus } from "@prisma/client";
import { prisma, transaction } from "@/lib/db/prisma";
import { isCampaignLive } from "@/lib/domain/campaign-rules";
import { normalizeReferralCode } from "@/lib/utils/codes";
import { recordAudit } from "./audit";
import { ConversionError, recordOrderInTx, verifyConversionInTx } from "./conversions";
import { notify } from "./notify";
import { hashValue, type Attribution } from "./tracking";

/**
 * Order handshake — real click→order attribution without a store plugin.
 *
 *   1. A customer buys on the brand's own store (the referral link sends them
 *      there with ?ref=CODE) and comes back to the campaign page.
 *   2. They submit their order number + the email/phone used for the order
 *      (submitOrderClaim). The claim carries attribution evidence: the
 *      last-click cookie for that code, or "code typed manually".
 *   3. The brand matches the order number in its store and confirms the claim
 *      with the order value (confirmOrderClaim) — which records AND verifies
 *      the order in one transaction, releasing the partner's commission or
 *      reward — or rejects it with a reason.
 *
 * A claim is never money: nothing is owed until the brand confirms it.
 * Contacts are stored as a salted hash plus a masked display value only.
 */
export class OrderClaimError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderClaimError";
  }
}

/** Uniqueness key for an order number: case- and whitespace-insensitive. */
export function orderReferenceKey(reference: string): string {
  return reference.replace(/\s+/g, "").toUpperCase();
}

/** "arjun.k@gmail.com" → "ar•••@gmail.com", "+91 98765 43210" → "+91 ••••• 3210". */
export function maskContact(contact: string): string {
  const value = contact.trim();
  const at = value.indexOf("@");
  if (at > 0) {
    const local = value.slice(0, at);
    return `${local.slice(0, Math.min(2, local.length))}•••${value.slice(at)}`;
  }
  const digits = value.replace(/\D/g, "");
  const last4 = digits.slice(-4);
  const cc = value.startsWith("+") ? `${value.slice(0, value.length - digits.length + Math.max(0, digits.length - 10)).trim()} ` : "";
  return `${cc}••••• ${last4}`.trim();
}

export type SubmitOrderClaimInput = {
  campaignId: string;
  code: string;
  orderReference: string;
  contact: string;
  note?: string | null;
  /** Signed-in claimant, if any. */
  customerId?: string | null;
  /** Last-click attribution cookie from the claimant's browser, if present. */
  attribution?: Attribution | null;
  ip?: string | null;
};

export async function submitOrderClaim(input: SubmitOrderClaimInput, now = new Date()) {
  const code = normalizeReferralCode(input.code);
  const orderReference = input.orderReference.trim();
  const key = orderReferenceKey(orderReference);
  const contactHash = hashValue(input.contact.trim().toLowerCase());

  return transaction(async (tx) => {
    const link = await tx.referralLink.findUnique({
      where: { code },
      include: { campaign: { select: { id: true, brandId: true, name: true, slug: true, status: true, startDate: true, endDate: true, brand: { select: { ownerId: true, name: true } } } }, owner: { select: { email: true, phone: true } } },
    });
    if (!link || link.campaign.id !== input.campaignId) throw new OrderClaimError("That referral code does not belong to this campaign. Check the code and try again.");
    if (link.status !== "ACTIVE") throw new OrderClaimError("This referral link is no longer active.");
    if (!isCampaignLive(link.campaign, now)) throw new OrderClaimError("This campaign is not accepting orders right now.");

    const selfHashes = [link.owner.email, link.owner.phone].filter(Boolean).map((v) => hashValue((v as string).trim().toLowerCase()));
    if (selfHashes.includes(contactHash)) throw new OrderClaimError("You cannot claim an order through your own referral link.");

    const recorded = await tx.conversion.findUnique({ where: { brandId_orderReference: { brandId: link.campaign.brandId, orderReference } }, select: { id: true } });
    if (recorded) throw new OrderClaimError("This order has already been recorded by the brand — nothing more to do.");

    const existing = await tx.orderClaim.findUnique({ where: { brandId_orderReferenceKey: { brandId: link.campaign.brandId, orderReferenceKey: key } }, select: { id: true, status: true } });
    if (existing?.status === "REJECTED") {
      // A rejected claim (typo, wrong code) may be re-submitted; the old row keeps the audit trail under a suffixed key.
      await tx.orderClaim.update({ where: { id: existing.id }, data: { orderReferenceKey: `${key}~rejected~${existing.id.slice(-6)}` } });
    } else if (existing) {
      throw new OrderClaimError("This order number has already been submitted. The brand will confirm it soon.");
    }

    const attributed = input.attribution && normalizeReferralCode(input.attribution.code) === code && input.attribution.campaignId === link.campaign.id;
    const evidence: ClaimEvidence = attributed ? "LAST_CLICK" : "CODE_ENTERED";

    let claim;
    try {
      claim = await tx.orderClaim.create({
        data: {
          campaignId: link.campaign.id,
          brandId: link.campaign.brandId,
          referralLinkId: link.id,
          customerId: input.customerId ?? null,
          contactHash,
          contactMasked: maskContact(input.contact),
          orderReference,
          orderReferenceKey: key,
          note: input.note?.trim() || null,
          evidence,
          clickedAt: attributed && input.attribution ? new Date(input.attribution.at) : null,
          ipHash: input.ip ? hashValue(input.ip) : null,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new OrderClaimError("This order number has already been submitted. The brand will confirm it soon.");
      }
      throw err;
    }

    await notify(
      {
        userId: link.campaign.brand.ownerId,
        type: "ORDER_CLAIMED",
        idempotencyKey: `order-claim:${claim.id}`,
        title: `Order to confirm: ${orderReference}`,
        body: `A customer says order ${orderReference} on "${link.campaign.name}" came through referral code ${code}. Match it in your store and confirm or reject it.`,
        href: "/dashboard/brand/orders#claims",
        email: true,
      },
      tx,
    );
    await recordAudit(
      { userId: input.customerId ?? null, action: "ORDER_CLAIMED", entityType: "OrderClaim", entityId: claim.id, metadata: { campaignId: link.campaign.id, code, evidence } },
      tx,
    );
    return claim;
  });
}

/**
 * Brand confirms a claim: the order is recorded from the claim (same checks as
 * a manual record — live campaign, minimum order value, duplicates, self-
 * referral) and verified in the same transaction, so the partner's commission
 * or reward is released atomically with the claim's status change.
 */
export async function confirmOrderClaim(brandId: string, actorId: string, claimId: string, input: { amountMinor: number; quantity?: number }, now = new Date()) {
  return transaction(async (tx) => {
    const claim = await tx.orderClaim.findFirst({ where: { id: claimId, brandId }, include: { referralLink: { select: { code: true } }, campaign: { select: { name: true } } } });
    if (!claim) throw new OrderClaimError("Claim not found.");
    if (claim.status !== "PENDING") throw new OrderClaimError("This claim has already been decided.");

    const { referral } = await recordOrderInTx(
      tx,
      brandId,
      actorId,
      {
        code: claim.referralLink.code,
        orderReference: claim.orderReference,
        amountMinor: input.amountMinor,
        quantity: input.quantity,
        source: "CUSTOMER_CLAIM",
        customerContactHash: claim.contactHash,
        note: claim.evidence === "LAST_CLICK" ? "Customer order claim (clicked link)" : "Customer order claim (code entered)",
      },
      now,
    );
    await verifyConversionInTx(tx, brandId, actorId, referral.id, now);

    const updated = await tx.orderClaim.update({
      where: { id: claim.id },
      data: { status: "CONFIRMED", decidedById: actorId, decidedAt: now, referralId: referral.id },
    });
    if (claim.customerId) {
      await notify(
        {
          userId: claim.customerId,
          type: "SYSTEM",
          idempotencyKey: `order-claim:${claim.id}:CONFIRMED`,
          title: `Order ${claim.orderReference} confirmed`,
          body: `The brand confirmed your order on "${claim.campaign.name}". The person who referred you has been credited — thank you!`,
          href: "/dashboard/customer",
          email: true,
        },
        tx,
      );
    }
    await recordAudit({ userId: actorId, action: "ORDER_CLAIM_CONFIRMED", entityType: "OrderClaim", entityId: claim.id, metadata: { brandId, referralId: referral.id, amount: input.amountMinor } }, tx);
    return updated;
  });
}

export async function rejectOrderClaim(brandId: string, actorId: string, claimId: string, reason: string, now = new Date()) {
  return transaction(async (tx) => {
    const claim = await tx.orderClaim.findFirst({ where: { id: claimId, brandId }, include: { campaign: { select: { name: true } } } });
    if (!claim) throw new OrderClaimError("Claim not found.");
    if (claim.status !== "PENDING") throw new OrderClaimError("This claim has already been decided.");
    const updated = await tx.orderClaim.update({
      where: { id: claim.id },
      data: { status: "REJECTED", rejectionReason: reason.trim(), decidedById: actorId, decidedAt: now },
    });
    if (claim.customerId) {
      await notify(
        {
          userId: claim.customerId,
          type: "SYSTEM",
          idempotencyKey: `order-claim:${claim.id}:REJECTED`,
          title: `Order ${claim.orderReference} could not be confirmed`,
          body: `The brand could not match this order on "${claim.campaign.name}": ${reason.trim()}`,
          href: "/dashboard/customer",
          email: true,
        },
        tx,
      );
    }
    await recordAudit({ userId: actorId, action: "ORDER_CLAIM_REJECTED", entityType: "OrderClaim", entityId: claim.id, metadata: { brandId, reason: reason.trim() } }, tx);
    return updated;
  });
}

export const claimSelect = {
  id: true,
  orderReference: true,
  contactMasked: true,
  note: true,
  evidence: true,
  clickedAt: true,
  status: true,
  rejectionReason: true,
  createdAt: true,
  decidedAt: true,
  customer: { select: { name: true } },
  campaign: { select: { id: true, name: true, slug: true, minimumPurchaseAmount: true } },
  referralLink: { select: { code: true, partnerType: true, owner: { select: { name: true, creatorProfile: { select: { displayName: true } } } } } },
} satisfies Prisma.OrderClaimSelect;

export type BrandOrderClaim = Prisma.OrderClaimGetPayload<{ select: typeof claimSelect }>;

export async function listBrandClaims(brandId: string, status: OrderClaimStatus | "ALL" = "PENDING", take = 200): Promise<BrandOrderClaim[]> {
  return prisma.orderClaim.findMany({
    where: { brandId, ...(status === "ALL" ? {} : { status }) },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take,
    select: claimSelect,
  });
}

export async function countPendingClaims(brandId: string): Promise<number> {
  return prisma.orderClaim.count({ where: { brandId, status: "PENDING" } });
}

export async function listCustomerClaims(customerId: string, take = 50) {
  return prisma.orderClaim.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, orderReference: true, status: true, rejectionReason: true, createdAt: true, decidedAt: true, campaign: { select: { name: true, slug: true, brand: { select: { name: true } } } } },
  });
}

// Re-exported so callers can treat both error kinds alike.
export { ConversionError };
