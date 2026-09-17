"use server";

import { revalidatePath } from "next/cache";
import { assertUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { recordAudit } from "@/lib/services/audit";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/services/notify";
import { notificationIdSchema } from "@/lib/validation/admin";
import { fail, ok, safeErrorMessage, type ActionResult } from "@/lib/utils/action-result";

/** Marks one of the caller's notifications read. Other users' ids are silently ignored (no IDOR). */
export async function markNotificationReadAction(input: unknown): Promise<ActionResult> {
  let user;
  try {
    user = await assertUser();
  } catch (err) {
    return fail(safeErrorMessage(err));
  }
  const parsed = notificationIdSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid request.");
  await markNotificationRead(user.id, parsed.data.id);
  revalidatePath("/dashboard", "layout");
  return ok(undefined);
}

export async function markAllNotificationsReadAction(): Promise<ActionResult> {
  let user;
  try {
    user = await assertUser();
  } catch (err) {
    return fail(safeErrorMessage(err));
  }
  await markAllNotificationsRead(user.id);
  revalidatePath("/dashboard", "layout");
  return ok(undefined);
}

/** Notification preference: whether important events are also e-mailed. */
export async function setEmailNotificationsAction(enabled: boolean): Promise<ActionResult> {
  let user;
  try {
    user = await assertUser();
  } catch (err) {
    return fail(safeErrorMessage(err));
  }
  if (typeof enabled !== "boolean") return fail("Invalid request.");
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { emailNotifications: enabled } });
    await recordAudit({ userId: user.id, actorRole: user.role, action: "NOTIFICATION_PREFERENCES_UPDATED", entityType: "User", entityId: user.id, metadata: { emailNotifications: enabled } }, tx);
  });
  revalidatePath("/dashboard", "layout");
  return ok(undefined);
}
