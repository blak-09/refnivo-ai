import type { NotificationType, Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { enqueueEmail } from "@/lib/email/outbox";

type Db = PrismaClient | Prisma.TransactionClient;

export type NotifyInput = {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  /** Relative dashboard path the notification links to. */
  href?: string | null;
  /**
   * Also e-mail the user. The e-mail is NOT sent here: an outbox row is written
   * in the same transaction (only when the user has e-mail notifications on)
   * and delivered after commit by the outbox dispatcher.
   */
  email?: boolean;
  /**
   * Stable key for the business event (e.g. `payout:<id>:MARK_PAID`). The same
   * key never queues a second e-mail, even if the event is notified twice.
   * Defaults to the notification id (one e-mail per notification row).
   */
  idempotencyKey?: string;
};

/**
 * Creates a database-backed notification (and, optionally, an e-mail outbox
 * row) atomically with the caller's transaction. Nothing leaves the process
 * inside the transaction, so a rollback leaves no trace and sends nothing.
 */
export async function notify(input: NotifyInput, db: Db = prisma): Promise<{ notificationId: string; emailQueued: boolean }> {
  const notification = await db.notification.create({
    data: { userId: input.userId, type: input.type, title: input.title, body: input.body ?? null, href: input.href ?? null },
    select: { id: true },
  });
  if (!input.email) return { notificationId: notification.id, emailQueued: false };

  const user = await db.user.findUnique({ where: { id: input.userId }, select: { email: true, name: true, emailNotifications: true } });
  if (!user || !user.emailNotifications) return { notificationId: notification.id, emailQueued: false };

  const link = input.href ? `${(process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "")}${input.href}` : null;
  const text = [`Hi ${user.name},`, "", input.body ?? input.title, link ? `\nOpen: ${link}` : "", "", "— Refnivo AI"].join("\n");
  const result = await enqueueEmail(db, {
    idempotencyKey: input.idempotencyKey ?? `notification:${notification.id}`,
    to: user.email,
    subject: input.title,
    text,
    userId: input.userId,
  });
  return { notificationId: notification.id, emailQueued: result.queued };
}

/** Notify several users with the same payload (e.g. all admins). */
export async function notifyMany(userIds: string[], input: Omit<NotifyInput, "userId">, db: Db = prisma): Promise<void> {
  for (const userId of new Set(userIds)) {
    await notify({ ...input, userId, idempotencyKey: input.idempotencyKey ? `${input.idempotencyKey}:${userId}` : undefined }, db);
  }
}

export async function listNotifications(userId: string, take = 50) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, type: true, title: true, body: true, href: true, readAt: true, createdAt: true },
  });
}

export async function countUnread(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

/** Marks one notification read. Scoped to the owner — another user's id is a no-op. */
export async function markNotificationRead(userId: string, id: string, now = new Date()) {
  const r = await prisma.notification.updateMany({ where: { id, userId, readAt: null }, data: { readAt: now } });
  return r.count;
}

export async function markAllNotificationsRead(userId: string, now = new Date()) {
  const r = await prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: now } });
  return r.count;
}

/** Ids of approved admins — recipients of platform-level events. */
export async function adminUserIds(db: Db = prisma): Promise<string[]> {
  const rows = await db.user.findMany({ where: { role: "ADMIN", status: "APPROVED" }, select: { id: true } });
  return rows.map((r) => r.id);
}
