"use server";

import { revalidatePath } from "next/cache";
import { assertRole } from "@/lib/auth/guards";
import { setUserStatus } from "@/lib/services/users";
import { fail, ok, safeErrorMessage, type ActionResult } from "@/lib/utils/action-result";

export async function setUserApprovalAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  let admin;
  try {
    admin = await assertRole("ADMIN");
  } catch (err) {
    return fail(safeErrorMessage(err));
  }

  const userId = formData.get("userId");
  const status = formData.get("status");
  if (typeof userId !== "string" || !userId || (status !== "APPROVED" && status !== "SUSPENDED")) {
    return fail("Invalid user approval request.");
  }

  try {
    await setUserStatus(userId, admin.id, status);
  } catch (err) {
    console.error("[setUserApproval] failed", err instanceof Error ? err.message : err);
    return fail("Could not update this account.");
  }
  revalidatePath("/dashboard/admin");
  return ok(undefined);
}
