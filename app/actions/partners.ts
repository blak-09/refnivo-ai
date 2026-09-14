"use server";

import { revalidatePath } from "next/cache";
import { assertBrandOwner } from "@/lib/auth/guards";
import { decideApplication, PartnerError } from "@/lib/services/partners";
import { applicationDecisionSchema } from "@/lib/validation/partner";
import { fail, ok, safeErrorMessage, type ActionResult } from "@/lib/utils/action-result";

export async function decideApplicationAction(input: unknown): Promise<ActionResult<{ status: string }>> {
  let ctx;
  try {
    ctx = await assertBrandOwner();
  } catch (err) {
    return fail(safeErrorMessage(err));
  }

  const parsed = applicationDecisionSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid request.");

  try {
    const app = await decideApplication(ctx.brand.id, ctx.user.id, parsed.data.applicationId, parsed.data.decision);
    revalidatePath("/dashboard/brand/creators");
    revalidatePath("/dashboard/brand");
    return ok({ status: app.status });
  } catch (err) {
    if (err instanceof PartnerError) return fail(err.message);
    console.error("[decideApplication] failed", err instanceof Error ? err.message : err);
    return fail("Could not update the application.");
  }
}
