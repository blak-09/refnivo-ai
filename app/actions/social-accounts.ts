"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertCreator } from "@/lib/auth/guards";
import { isSocialPlatform } from "@/lib/social";
import { disconnectSocialAccount, refreshSocialProfile, SocialAccountError } from "@/lib/services/social-accounts";
import { fail, ok, safeErrorMessage, type ActionResult } from "@/lib/utils/action-result";
import { rateLimit } from "@/lib/utils/rate-limit";

/**
 * Disconnect / refresh for the caller's OWN linked accounts. The user comes from
 * the session, so a request can never act on someone else's connection.
 */
const schema = z.object({ platform: z.string().min(1).max(20) });

async function creatorAnd(input: unknown) {
  const user = await assertCreator();
  const parsed = schema.safeParse(input);
  if (!parsed.success || !isSocialPlatform(parsed.data.platform.toUpperCase())) throw new SocialAccountError("Unknown platform.");
  return { user, platform: parsed.data.platform.toUpperCase() as never };
}

export async function disconnectSocialAccountAction(input: unknown): Promise<ActionResult> {
  try {
    const { user, platform } = await creatorAnd(input);
    await disconnectSocialAccount(user.id, platform);
    revalidatePath("/dashboard/creator/social");
    revalidatePath("/dashboard/creator/profile");
    return ok(undefined);
  } catch (err) {
    if (err instanceof SocialAccountError) return fail(err.message);
    return fail(safeErrorMessage(err));
  }
}

export async function refreshSocialAccountAction(input: unknown): Promise<ActionResult> {
  try {
    const { user, platform } = await creatorAnd(input);
    const limit = await rateLimit(`social-refresh:${user.id}`, 20, 60 * 60 * 1000);
    if (!limit.ok) return fail("Please wait a little before refreshing again.");
    await refreshSocialProfile(user.id, platform);
    revalidatePath("/dashboard/creator/social");
    return ok(undefined);
  } catch (err) {
    if (err instanceof SocialAccountError) return fail(err.message);
    return fail(safeErrorMessage(err));
  }
}
