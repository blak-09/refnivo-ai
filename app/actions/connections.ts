"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ConnectionInitiator } from "@prisma/client";
import { assertBrandOwner, assertCreator } from "@/lib/auth/guards";
import { ConnectionError, respondToConnection, sendConnectionRequest } from "@/lib/services/connections";
import { prisma } from "@/lib/db/prisma";
import { fail, ok, safeErrorMessage, type ActionResult } from "@/lib/utils/action-result";
import { rateLimit } from "@/lib/utils/rate-limit";
import { securityEvent } from "@/lib/utils/security-log";

/**
 * Connection actions.
 *
 * Each one resolves the caller's own side from the session — a brand owner can
 * only ever act as their brand, a creator only as themselves — so the request
 * body can never be used to act on someone else's behalf.
 */
const sendSchema = z.object({
  /** Whichever side is being connected TO; the other side comes from the session. */
  brandId: z.string().min(1).max(40).optional(),
  creatorId: z.string().min(1).max(40).optional(),
  message: z.string().trim().max(600).optional().or(z.literal("")),
});

const respondSchema = z.object({
  connectionId: z.string().min(1).max(40),
  decision: z.enum(["ACCEPT", "DECLINE", "BLOCK"]),
  note: z.string().trim().max(300).optional().or(z.literal("")),
});

function revalidate() {
  revalidatePath("/dashboard/brand/connections");
  revalidatePath("/dashboard/creator/connections");
}

/** Brand → creator. */
export async function connectWithCreatorAction(input: unknown): Promise<ActionResult> {
  let ctx;
  try {
    ctx = await assertBrandOwner();
  } catch (err) {
    return fail(safeErrorMessage(err));
  }
  const parsed = sendSchema.safeParse(input);
  if (!parsed.success || !parsed.data.creatorId) return fail("Choose a creator to connect with.");

  const limit = await rateLimit(`connect:${ctx.user.id}`, 30, 24 * 60 * 60 * 1000);
  if (!limit.ok) {
    securityEvent("RATE_LIMITED", { scope: "connections" });
    return fail("You have sent a lot of requests today. Please try again tomorrow.");
  }

  try {
    await sendConnectionRequest({
      brandId: ctx.brand.id, // from the session, never the request
      creatorId: parsed.data.creatorId,
      initiator: "BRAND",
      actorId: ctx.user.id,
      message: parsed.data.message || null,
    });
    revalidate();
    return ok(undefined);
  } catch (err) {
    if (err instanceof ConnectionError) return fail(err.message);
    console.error("[connections] brand request failed", err instanceof Error ? err.message : err);
    return fail("Could not send the request. Please try again.");
  }
}

/** Creator → brand. */
export async function connectWithBrandAction(input: unknown): Promise<ActionResult> {
  let ctx;
  try {
    ctx = await assertCreator();
  } catch (err) {
    return fail(safeErrorMessage(err));
  }
  const parsed = sendSchema.safeParse(input);
  if (!parsed.success || !parsed.data.brandId) return fail("Choose a brand to connect with.");

  const limit = await rateLimit(`connect:${ctx.id}`, 30, 24 * 60 * 60 * 1000);
  if (!limit.ok) {
    securityEvent("RATE_LIMITED", { scope: "connections" });
    return fail("You have sent a lot of requests today. Please try again tomorrow.");
  }

  try {
    await sendConnectionRequest({
      brandId: parsed.data.brandId,
      creatorId: ctx.id, // from the session
      initiator: "CREATOR",
      actorId: ctx.id,
      message: parsed.data.message || null,
    });
    revalidate();
    return ok(undefined);
  } catch (err) {
    if (err instanceof ConnectionError) return fail(err.message);
    console.error("[connections] creator request failed", err instanceof Error ? err.message : err);
    return fail("Could not send the request. Please try again.");
  }
}

/**
 * Accept / decline / block. The connection must belong to the caller's own side,
 * checked against the session before anything is written.
 */
export async function respondToConnectionAction(input: unknown): Promise<ActionResult> {
  const parsed = respondSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid request.");

  let side: ConnectionInitiator;
  let actorId: string;
  let owns: boolean;
  try {
    const brandCtx = await assertBrandOwner().catch(() => null);
    if (brandCtx) {
      side = "BRAND";
      actorId = brandCtx.user.id;
      owns = !!(await prisma.connection.findFirst({ where: { id: parsed.data.connectionId, brandId: brandCtx.brand.id }, select: { id: true } }));
    } else {
      const creator = await assertCreator();
      side = "CREATOR";
      actorId = creator.id;
      owns = !!(await prisma.connection.findFirst({ where: { id: parsed.data.connectionId, creatorId: creator.id }, select: { id: true } }));
    }
  } catch (err) {
    return fail(safeErrorMessage(err));
  }
  if (!owns) {
    securityEvent("FORBIDDEN_ACCESS", { scope: "connection" });
    return fail("Connection not found.");
  }

  try {
    await respondToConnection({ connectionId: parsed.data.connectionId, actorId, side, decision: parsed.data.decision, note: parsed.data.note || null });
    revalidate();
    return ok(undefined);
  } catch (err) {
    if (err instanceof ConnectionError) return fail(err.message);
    console.error("[connections] respond failed", err instanceof Error ? err.message : err);
    return fail("Could not update the request. Please try again.");
  }
}
