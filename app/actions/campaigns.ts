"use server";

import { revalidatePath } from "next/cache";
import { assertBrandOwner } from "@/lib/auth/guards";
import {
  CampaignError,
  createCampaign,
  deleteDraftCampaign,
  transitionCampaign,
  updateCampaign,
} from "@/lib/services/campaigns";
import { campaignFormSchema, campaignStatusActionSchema } from "@/lib/validation/campaign";
import { fail, firstError, ok, safeErrorMessage, zodFieldErrors, type ActionResult } from "@/lib/utils/action-result";

function revalidateCampaigns(campaignId?: string) {
  revalidatePath("/dashboard/brand");
  revalidatePath("/campaigns");
  revalidatePath("/dashboard/brand/campaigns");
  if (campaignId) revalidatePath(`/dashboard/brand/campaigns/${campaignId}`);
}

/**
 * Creates or updates a campaign from the wizard. `input` is untrusted JSON
 * from the client and is fully re-validated here.
 */
export async function saveCampaignAction(
  input: unknown,
  campaignId?: string,
): Promise<ActionResult<{ id: string; status: string }>> {
  let ctx;
  try {
    ctx = await assertBrandOwner();
  } catch (err) {
    return fail(safeErrorMessage(err));
  }

  const parsed = campaignFormSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors = zodFieldErrors(parsed.error);
    return fail(firstError(fieldErrors), fieldErrors);
  }

  try {
    const campaign = campaignId
      ? await updateCampaign(ctx.brand.id, ctx.brand.name, ctx.user.id, campaignId, parsed.data)
      : await createCampaign(ctx.brand.id, ctx.brand.name, ctx.user.id, parsed.data);
    revalidateCampaigns(campaign.id);
    return ok({ id: campaign.id, status: campaign.status });
  } catch (err) {
    if (err instanceof CampaignError) return fail(err.message);
    console.error("[saveCampaign] failed", err instanceof Error ? err.message : err);
    return fail("Could not save the campaign. Please try again.");
  }
}

export async function campaignStatusAction(input: unknown): Promise<ActionResult<{ status: string }>> {
  let ctx;
  try {
    ctx = await assertBrandOwner();
  } catch (err) {
    return fail(safeErrorMessage(err));
  }

  const parsed = campaignStatusActionSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid request.");

  try {
    const campaign = await transitionCampaign(
      ctx.brand.id,
      ctx.user.id,
      parsed.data.campaignId,
      parsed.data.action,
      { confirmed: parsed.data.confirmed },
    );
    revalidateCampaigns(campaign.id);
    return ok({ status: campaign.status });
  } catch (err) {
    if (err instanceof CampaignError) return fail(err.message);
    console.error("[campaignStatus] failed", err instanceof Error ? err.message : err);
    return fail("Could not update the campaign. Please try again.");
  }
}

export async function deleteDraftCampaignAction(campaignId: string): Promise<ActionResult> {
  let ctx;
  try {
    ctx = await assertBrandOwner();
  } catch (err) {
    return fail(safeErrorMessage(err));
  }
  if (typeof campaignId !== "string" || !campaignId) return fail("Invalid request.");

  try {
    await deleteDraftCampaign(ctx.brand.id, ctx.user.id, campaignId);
    revalidateCampaigns();
    return ok(undefined);
  } catch (err) {
    if (err instanceof CampaignError) return fail(err.message);
    console.error("[deleteDraftCampaign] failed", err instanceof Error ? err.message : err);
    return fail("Could not delete the campaign.");
  }
}
