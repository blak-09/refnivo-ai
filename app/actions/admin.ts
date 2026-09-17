"use server";

import { revalidatePath } from "next/cache";
import { assertRole } from "@/lib/auth/guards";
import { AdminError, moderateCampaign, reactivateUser, setVerification, suspendUser } from "@/lib/services/admin";
import { approveUser, rejectUser } from "@/lib/services/users";
import { notifyRegistration } from "@/lib/services/notifications";
import { PayoutError, reviewPayout } from "@/lib/services/payouts";
import { moderateCampaignSchema, payoutReviewSchema, reactivateUserSchema, suspendUserSchema, verificationSchema } from "@/lib/validation/admin";
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

  await notifyRegistration("approved", {
    id: user.id,
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

  await notifyRegistration("rejected", {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    registrationId: user.registrationId,
    rejectionReason: reason,
  });

  revalidateAdmin();
  return ok(undefined);
}

// ---------------------------------------------------------------------------
// Management (Phase: admin panel). Every action: admin guard → Zod → service
// (transactional + audited) → revalidate. Errors never leak internals.
// ---------------------------------------------------------------------------

async function admin() {
  return assertRole("ADMIN");
}

function revalidateAdminAll() {
  revalidatePath("/dashboard/admin", "layout");
}

export async function suspendUserAction(input: unknown): Promise<ActionResult> {
  let actor;
  try {
    actor = await admin();
  } catch (err) {
    return fail(safeErrorMessage(err));
  }
  const parsed = suspendUserSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid request.");
  try {
    await suspendUser(actor.id, parsed.data.userId, parsed.data.reason);
    revalidateAdminAll();
    return ok(undefined);
  } catch (err) {
    if (err instanceof AdminError) return fail(err.message);
    console.error("[suspendUser] failed", err instanceof Error ? err.message : err);
    return fail("Could not suspend this account.");
  }
}

export async function reactivateUserAction(input: unknown): Promise<ActionResult> {
  let actor;
  try {
    actor = await admin();
  } catch (err) {
    return fail(safeErrorMessage(err));
  }
  const parsed = reactivateUserSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid request.");
  try {
    await reactivateUser(actor.id, parsed.data.userId);
    revalidateAdminAll();
    return ok(undefined);
  } catch (err) {
    if (err instanceof AdminError) return fail(err.message);
    console.error("[reactivateUser] failed", err instanceof Error ? err.message : err);
    return fail("Could not reactivate this account.");
  }
}

export async function verificationAction(input: unknown): Promise<ActionResult> {
  let actor;
  try {
    actor = await admin();
  } catch (err) {
    return fail(safeErrorMessage(err));
  }
  const parsed = verificationSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid request.");
  try {
    await setVerification(actor.id, parsed.data.target, parsed.data.id, parsed.data.decision, parsed.data.note || null);
    revalidateAdminAll();
    revalidatePath("/brands");
    revalidatePath("/creators");
    return ok(undefined);
  } catch (err) {
    if (err instanceof AdminError) return fail(err.message);
    console.error("[verification] failed", err instanceof Error ? err.message : err);
    return fail("Could not update verification.");
  }
}

export async function moderateCampaignAction(input: unknown): Promise<ActionResult> {
  let actor;
  try {
    actor = await admin();
  } catch (err) {
    return fail(safeErrorMessage(err));
  }
  const parsed = moderateCampaignSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid request.");
  try {
    await moderateCampaign(actor.id, parsed.data.campaignId, parsed.data.action, parsed.data.reason);
    revalidateAdminAll();
    revalidatePath("/campaigns");
    return ok(undefined);
  } catch (err) {
    if (err instanceof AdminError) return fail(err.message);
    console.error("[moderateCampaign] failed", err instanceof Error ? err.message : err);
    return fail("Could not update this campaign.");
  }
}

export async function payoutReviewAction(input: unknown): Promise<ActionResult> {
  let actor;
  try {
    actor = await admin();
  } catch (err) {
    return fail(safeErrorMessage(err));
  }
  const parsed = payoutReviewSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid request.");
  try {
    await reviewPayout(actor.id, parsed.data.payoutId, parsed.data.action, { reference: parsed.data.reference || null, note: parsed.data.note || null });
    revalidateAdminAll();
    revalidatePath("/dashboard/creator", "layout");
    revalidatePath("/dashboard/customer", "layout");
    return ok(undefined);
  } catch (err) {
    if (err instanceof PayoutError) return fail(err.message);
    console.error("[payoutReview] failed", err instanceof Error ? err.message : err);
    return fail("Could not update this payout request.");
  }
}
