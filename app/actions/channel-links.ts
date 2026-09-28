"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertPartner } from "@/lib/auth/guards";
import { ChannelLinkError, createChannelLink, LINK_SOURCES } from "@/lib/services/channel-links";
import { fail, ok, safeErrorMessage, type ActionResult } from "@/lib/utils/action-result";
import { rateLimit } from "@/lib/utils/rate-limit";

const schema = z.object({
  campaignId: z.string().min(1).max(40),
  source: z.enum(LINK_SOURCES as [string, ...string[]]),
});

/**
 * Issues the caller's own channel link. The owner is taken from the session, so
 * a request can never mint a link for another partner.
 */
export async function createChannelLinkAction(input: unknown): Promise<ActionResult<{ code: string }>> {
  let user;
  try {
    user = await assertPartner();
  } catch (err) {
    return fail(safeErrorMessage(err));
  }
  const parsed = schema.safeParse(input);
  if (!parsed.success) return fail("Choose a campaign and a channel.");

  const limit = await rateLimit(`channel-link:${user.id}`, 60, 60 * 60 * 1000);
  if (!limit.ok) return fail("That is a lot of links at once. Please try again shortly.");

  try {
    const link = await createChannelLink({ ownerId: user.id, campaignId: parsed.data.campaignId, source: parsed.data.source as never });
    revalidatePath("/dashboard/creator/links");
    revalidatePath("/dashboard/customer");
    return ok({ code: link.code });
  } catch (err) {
    if (err instanceof ChannelLinkError) return fail(err.message);
    console.error("[channel-links] create failed", err instanceof Error ? err.message : err);
    return fail("Could not create the link. Please try again.");
  }
}
