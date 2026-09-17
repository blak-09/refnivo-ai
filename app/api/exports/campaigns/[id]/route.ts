import { NextResponse } from "next/server";
import { assertBrandOwner } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { recordAudit } from "@/lib/services/audit";
import { toCsv } from "@/lib/utils/csv";
import { rateLimit } from "@/lib/utils/rate-limit";

export const runtime = "nodejs";

/**
 * CSV export of one campaign's partners, clicks and orders — brand-owner only,
 * scoped to the owner's brand (a foreign campaign id is a 404, never a leak).
 * Partner contact details are not included; customers are identified only by
 * the referral code and order reference the brand already holds.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  let owner;
  try {
    owner = await assertBrandOwner();
  } catch {
    return NextResponse.json({ ok: false, error: "You must be signed in as a brand owner." }, { status: 401 });
  }
  const limit = await rateLimit(`export:${owner.user.id}`, 20, 10 * 60 * 1000);
  if (!limit.ok) return NextResponse.json({ ok: false, error: "Too many exports. Try again later." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });

  const { id } = await ctx.params;
  const campaign = await prisma.campaign.findFirst({
    where: { id, brandId: owner.brand.id },
    select: {
      id: true,
      name: true,
      slug: true,
      referralLinks: {
        select: {
          code: true,
          partnerType: true,
          status: true,
          createdAt: true,
          owner: { select: { name: true, creatorProfile: { select: { username: true } } } },
          _count: { select: { clicks: true } },
        },
      },
      referrals: {
        where: { conversion: { isNot: null } },
        orderBy: { createdAt: "desc" },
        select: {
          status: true,
          createdAt: true,
          verifiedAt: true,
          referralLink: { select: { code: true } },
          conversion: { select: { orderReference: true, amount: true, currency: true, quantity: true, source: true, reversedAt: true } },
          commissions: { select: { amount: true, status: true } },
          rewards: { select: { amount: true, status: true } },
        },
      },
    },
  });
  if (!campaign) return NextResponse.json({ ok: false, error: "Campaign not found." }, { status: 404 });

  const partners = campaign.referralLinks.map((l) => ({
    section: "partner",
    code: l.code,
    partner: l.owner.creatorProfile?.username ? `@${l.owner.creatorProfile.username}` : l.owner.name,
    partner_type: l.partnerType,
    link_status: l.status,
    clicks: l._count.clicks,
    joined_at: l.createdAt.toISOString(),
  }));
  const orders = campaign.referrals.map((r) => ({
    section: "order",
    code: r.referralLink.code,
    order_reference: r.conversion?.orderReference ?? "",
    order_amount_minor: r.conversion?.amount ?? 0,
    currency: r.conversion?.currency ?? "",
    quantity: r.conversion?.quantity ?? 0,
    source: r.conversion?.source ?? "",
    status: r.status,
    recorded_at: r.createdAt.toISOString(),
    verified_at: r.verifiedAt?.toISOString() ?? "",
    reversed_at: r.conversion?.reversedAt?.toISOString() ?? "",
    owed_minor: [...r.commissions, ...r.rewards].filter((x) => x.status !== "REJECTED" && x.status !== "REVERSED").reduce((s, x) => s + x.amount, 0),
  }));

  const body = `${toCsv(partners)}\n\n${toCsv(orders)}`;
  await recordAudit({
    userId: owner.user.id,
    actorRole: owner.user.role,
    action: "CAMPAIGN_EXPORTED",
    entityType: "Campaign",
    entityId: campaign.id,
    metadata: { partners: partners.length, orders: orders.length },
  });

  const filename = `refnivo-${campaign.slug}-${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
