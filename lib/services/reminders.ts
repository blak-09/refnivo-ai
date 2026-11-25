import { prisma } from "@/lib/db/prisma";
import { notify } from "./notify";

/**
 * Reminders for brands about orders and buyer claims they have not decided
 * (docs/AUDIT.md W5). Runs once a day from the cron route. An item triggers a
 * reminder on the day it turns 3 days old and on the day it turns 7 days old;
 * a brand gets at most one digest per UTC day (checked against the brand's
 * notifications, and the e-mail carries a per-day idempotency key), so
 * re-running the job never sends twice.
 */

const DAY = 24 * 60 * 60 * 1000;
export const REMINDER_THRESHOLDS_DAYS = [3, 7] as const;
export const REMINDER_TITLE = "Creators and customers are waiting on you";

/** Was `createdAt` crossing one of the thresholds during the 24 hours before `now`? */
function crossedToday(createdAt: Date, now: Date) {
  const age = now.getTime() - createdAt.getTime();
  return REMINDER_THRESHOLDS_DAYS.some((d) => age >= d * DAY && age < (d + 1) * DAY);
}

export async function sendPendingReminders(now = new Date()): Promise<{ brands: number }> {
  const oldest = new Date(now.getTime() - (Math.max(...REMINDER_THRESHOLDS_DAYS) + 1) * DAY);
  const newest = new Date(now.getTime() - Math.min(...REMINDER_THRESHOLDS_DAYS) * DAY);
  const [orders, claims] = await Promise.all([
    prisma.conversion.findMany({
      where: { createdAt: { gte: oldest, lte: newest }, referral: { status: "PURCHASED" } },
      select: { brandId: true, createdAt: true },
    }),
    prisma.orderClaim.findMany({
      where: { status: "PENDING", createdAt: { gte: oldest, lte: newest } },
      select: { brandId: true, createdAt: true },
    }),
  ]);

  const due = new Map<string, { orders: number; claims: number }>();
  for (const o of orders) if (crossedToday(o.createdAt, now)) due.set(o.brandId, { ...(due.get(o.brandId) ?? { orders: 0, claims: 0 }), orders: (due.get(o.brandId)?.orders ?? 0) + 1 });
  for (const c of claims) if (crossedToday(c.createdAt, now)) due.set(c.brandId, { ...(due.get(c.brandId) ?? { orders: 0, claims: 0 }), claims: (due.get(c.brandId)?.claims ?? 0) + 1 });
  if (!due.size) return { brands: 0 };

  const brands = await prisma.brand.findMany({ where: { id: { in: [...due.keys()] }, status: "ACTIVE" }, select: { id: true, ownerId: true } });
  const day = now.toISOString().slice(0, 10);
  const dayStart = new Date(`${day}T00:00:00Z`);
  let sent = 0;
  for (const b of brands) {
    const already = await prisma.notification.findFirst({ where: { userId: b.ownerId, title: REMINDER_TITLE, createdAt: { gte: dayStart } }, select: { id: true } });
    if (already) continue;
    // Totals waiting (not only the ones that crossed today), so the message matches the orders page.
    const [waitingOrders, waitingClaims] = await Promise.all([
      prisma.referral.count({ where: { status: "PURCHASED", campaign: { brandId: b.id }, conversion: { isNot: null } } }),
      prisma.orderClaim.count({ where: { brandId: b.id, status: "PENDING" } }),
    ]);
    const parts = [
      waitingOrders ? `${waitingOrders} recorded order${waitingOrders === 1 ? "" : "s"} to verify or reject` : null,
      waitingClaims ? `${waitingClaims} buyer claim${waitingClaims === 1 ? "" : "s"} to confirm or reject` : null,
    ].filter(Boolean);
    if (!parts.length) continue;
    await notify({
      userId: b.ownerId,
      type: "SYSTEM",
      idempotencyKey: `pending-reminder:${b.id}:${day}`,
      title: REMINDER_TITLE,
      body: `You have ${parts.join(" and ")}. Partners see how long each order has been waiting; deciding quickly keeps them promoting your products.`,
      href: "/dashboard/brand/orders",
      email: true,
    });
    sent++;
  }
  return { brands: sent };
}
