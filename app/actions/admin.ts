"use server";

import { revalidatePath } from "next/cache";
import { assertRole } from "@/lib/auth/guards";
import { approveUser, rejectUser } from "@/lib/services/users";
import { notifyRegistration } from "@/lib/services/notifications";
import { exportStatusUpdate } from "@/lib/registrations/sheet";
import { fail, ok, safeErrorMessage, type ActionResult } from "@/lib/utils/action-result";

function revalidateAdmin() {
  revalidatePath("/dashboard/admin");
  revalidatePath("/dashboard/admin/registrations");
}

export async function approveUserAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  let admin;
  try {
    admin = await assertRole("ADMIN");
  } catch (err) {
    return fail(safeErrorMessage(err));
  }

  const userId = formData.get("userId");
  if (typeof userId !== "string" || !userId) return fail("Invalid request.");
  if (userId === admin.id) return fail("You cannot change your own verification status.");

  let user;
  try {
    user = await approveUser(userId, admin.id);
  } catch (err) {
    console.error("[approveUser] failed", err instanceof Error ? err.message : err);
    return fail("Could not approve this account.");
  }

  if (user.registrationId) {
    await exportStatusUpdate(user.registrationId, {
      verificationStatus: "APPROVED",
      verifiedBy: admin.email,
      verificationDate: new Date().toISOString(),
    });
  }
  await notifyRegistration("approved", {
    name: user.name,
    email: user.email,
    role: user.role,
    registrationId: user.registrationId,
  });

  revalidateAdmin();
  return ok(undefined);
}

export async function rejectUserAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  let admin;
  try {
    admin = await assertRole("ADMIN");
  } catch (err) {
    return fail(safeErrorMessage(err));
  }

  const userId = formData.get("userId");
  const reasonRaw = formData.get("reason");
  if (typeof userId !== "string" || !userId) return fail("Invalid request.");
  if (userId === admin.id) return fail("You cannot change your own verification status.");
  const reason = typeof reasonRaw === "string" ? reasonRaw.trim() : "";
  if (reason.length < 3) return fail("Please provide a reason for rejection.", { reason: "A reason is required." });
  if (reason.length > 500) return fail("Reason is too long (max 500 characters).", { reason: "Too long." });

  let user;
  try {
    user = await rejectUser(userId, admin.id, reason);
  } catch (err) {
    console.error("[rejectUser] failed", err instanceof Error ? err.message : err);
    return fail("Could not reject this account.");
  }

  if (user.registrationId) {
    await exportStatusUpdate(user.registrationId, {
      verificationStatus: "REJECTED",
      verifiedBy: admin.email,
      verificationDate: new Date().toISOString(),
      rejectionReason: reason,
    });
  }
  await notifyRegistration("rejected", {
    name: user.name,
    email: user.email,
    role: user.role,
    registrationId: user.registrationId,
    rejectionReason: reason,
  });

  revalidateAdmin();
  return ok(undefined);
}
