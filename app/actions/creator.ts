"use server";

import { revalidatePath } from "next/cache";
import { assertPartner } from "@/lib/auth/guards";
import { getCreatorProfile } from "@/lib/services/creators";
import { joinCampaign, PartnerError, withdrawApplication, type JoinResult } from "@/lib/services/partners";
import { applyToCampaignSchema } from "@/lib/validation/creator";
import { withdrawApplicationSchema } from "@/lib/validation/partner";
import { fail, ok, safeErrorMessage, type ActionResult } from "@/lib/utils/action-result";

/** Creator applies / customer joins. Returns the referral code when approved instantly. */
export async function joinCampaignAction(input: unknown): Promise<ActionResult<JoinResult>> {
  let user;
  try {
    user = await assertPartner();
  } catch (err) {
    return fail(safeErrorMessage(err));
  }
  const parsed = applyToCampaignSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid request.");

  if (user.role === "CREATOR" && !(await getCreatorProfile(user.id))) {
    return fail("Complete your creator profile before applying to campaigns.");
  }

  try {
    const result = await joinCampaign(
      { id: user.id, name: user.name, role: user.role as "CREATOR" | "CUSTOMER" },
      parsed.data.campaignId,
      parsed.data.message || null,
    );
    revalidatePath("/dashboard/creator", "layout");
    revalidatePath("/dashboard/customer", "layout");
    revalidatePath("/campaigns");
    return ok(result);
  } catch (err) {
    if (err instanceof PartnerError) return fail(err.message);
    console.error("[joinCampaign] failed", err instanceof Error ? err.message : err);
    return fail("Could not join the campaign. Please try again.");
  }
}

/** A creator or customer withdraws their own pending application. */
export async function withdrawApplicationAction(input: unknown): Promise<ActionResult> {
  let user;
  try {
    user = await assertPartner();
  } catch (err) {
    return fail(safeErrorMessage(err));
  }
  const parsed = withdrawApplicationSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid request.");
  try {
    await withdrawApplication(user.id, parsed.data.applicationId);
    revalidatePath("/dashboard/creator", "layout");
    revalidatePath("/dashboard/customer", "layout");
    return ok(undefined);
  } catch (err) {
    if (err instanceof PartnerError) return fail(err.message);
    console.error("[withdrawApplication] failed", err instanceof Error ? err.message : err);
    return fail("Could not withdraw the application.");
  }
}
