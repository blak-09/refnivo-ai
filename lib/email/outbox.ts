import type { Prisma, PrismaClient } from "@prisma/client";
import { after } from "next/server";
import { prisma } from "@/lib/db/client";
import { getEmailDriver, type EmailDriver } from "@/lib/email";

/**
 * Transactional e-mail outbox.
 *
 *  enqueueEmail(tx, …)      — called INSIDE the business transaction. Writes an
 *                             `email_outbox` row; if the transaction rolls back
 *                             the row disappears with it, so nothing is sent for
 *                             work that never committed. `idempotencyKey` is
 *                             unique: the same event can never queue twice.
 *  dispatchPendingEmails()  — called AFTER commit (see `lib/db/prisma.ts`
 *                             `transaction()`), by the `email:outbox` script, or
 *                             by a scheduler. Claims each row atomically
 *                             (PENDING → SENDING) so two dispatchers never send
 *                             the same e-mail, then sends through the configured
 *                             driver. Failures are recorded and retried with
 *                             backoff up to `maxAttempts`; they never affect the
 *                             business transaction that queued them.
 *
 * No provider configured → the console driver "sends" (logs a masked line) and
 * the row is marked SENT, keeping the honest fallback behaviour.
 */
type Db = PrismaClient | Prisma.TransactionClient;

export type EnqueueEmailInput = {
  idempotencyKey: string;
  to: string;
  subject: string;
  text: string;
  html?: string | null;
  userId?: string | null;
  /** Earliest delivery time; defaults to now (application clock, see note in enqueueEmail). */
  nextAttemptAt?: Date;
};

export type EnqueueResult = { queued: true; id: string } | { queued: false; reason: "DUPLICATE" };

/** Idempotent insert: an existing key is a no-op, not an error. */
export async function enqueueEmail(db: Db, input: EnqueueEmailInput): Promise<EnqueueResult> {
  const existing = await db.emailOutbox.findUnique({ where: { idempotencyKey: input.idempotencyKey }, select: { id: true } });
  if (existing) return { queued: false, reason: "DUPLICATE" };
  try {
    // `nextAttemptAt` is set from the application clock (not the database default) so the
    // after-commit dispatcher — which compares against the same clock — sees the row immediately.
    const row = await db.emailOutbox.create({
      data: {
        idempotencyKey: input.idempotencyKey,
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html ?? null,
        userId: input.userId ?? null,
        nextAttemptAt: input.nextAttemptAt ?? new Date(),
      },
      select: { id: true },
    });
    return { queued: true, id: row.id };
  } catch (err) {
    // Lost a race on the unique key inside a concurrent transaction — still a duplicate.
    if (err && typeof err === "object" && "code" in err && (err as { code?: string }).code === "P2002") return { queued: false, reason: "DUPLICATE" };
    throw err;
  }
}

/** Exponential backoff: 1 min, 5 min, 25 min, … capped at 6 h. */
export function nextAttemptDelayMs(attempts: number): number {
  return Math.min(60_000 * 5 ** Math.max(0, attempts - 1), 6 * 60 * 60 * 1000);
}

export type DispatchSummary = { claimed: number; sent: number; failed: number; exhausted: number };

/** A SENDING claim older than this is treated as abandoned (process died mid-send) and becomes retryable. */
export const STALE_CLAIM_MS = 10 * 60 * 1000;

export async function dispatchPendingEmails(
  opts: { limit?: number; driver?: EmailDriver; now?: Date; db?: PrismaClient } = {},
): Promise<DispatchSummary> {
  const db = opts.db ?? prisma;
  const driver = opts.driver ?? getEmailDriver();
  const now = opts.now ?? new Date();
  const summary: DispatchSummary = { claimed: 0, sent: 0, failed: 0, exhausted: 0 };
  const staleBefore = new Date(now.getTime() - STALE_CLAIM_MS);
  // Retryable = waiting (PENDING/FAILED, due) or an abandoned SENDING claim. Exhausted rows are excluded in SQL.
  const claimable: Prisma.EmailOutboxWhereInput = {
    OR: [
      { status: { in: ["PENDING", "FAILED"] }, nextAttemptAt: { lte: now } },
      { status: "SENDING", updatedAt: { lt: staleBefore } },
    ],
  };

  const candidates = await db.emailOutbox.findMany({
    where: { AND: [claimable, { attempts: { lt: db.emailOutbox.fields.maxAttempts } }] },
    orderBy: { createdAt: "asc" },
    take: opts.limit ?? 50,
    select: { id: true },
  });

  for (const c of candidates) {
    // Atomic claim: only one dispatcher wins the → SENDING transition (row-level update under the same predicate).
    const claim = await db.emailOutbox.updateMany({
      where: { AND: [{ id: c.id }, claimable] },
      data: { status: "SENDING", attempts: { increment: 1 } },
    });
    if (claim.count !== 1) continue;
    summary.claimed += 1;

    const row = await db.emailOutbox.findUniqueOrThrow({ where: { id: c.id } });
    let outcome: { ok: true; providerId?: string } | { ok: false; reason: string };
    try {
      const r = await driver.send({ to: row.to, subject: row.subject, text: row.text, html: row.html ?? undefined });
      outcome = r.ok ? { ok: true, providerId: r.id } : { ok: false, reason: r.reason };
    } catch (err) {
      outcome = { ok: false, reason: err instanceof Error ? err.message : "unknown error" };
    }

    if (outcome.ok) {
      await db.emailOutbox.update({ where: { id: row.id }, data: { status: "SENT", sentAt: now, providerId: outcome.providerId ?? null, lastError: null } });
      summary.sent += 1;
    } else {
      const exhausted = row.attempts >= row.maxAttempts;
      await db.emailOutbox.update({
        where: { id: row.id },
        data: { status: "FAILED", lastError: outcome.reason.slice(0, 500), nextAttemptAt: new Date(now.getTime() + nextAttemptDelayMs(row.attempts)) },
      });
      summary.failed += 1;
      if (exhausted) summary.exhausted += 1;
      console.error(`[email:outbox] delivery failed (${row.attempts}/${row.maxAttempts}) via ${driver.name}: ${outcome.reason}`);
    }
  }
  return summary;
}

// ---------------------------------------------------------------------------
// After-commit trigger. Fire-and-forget and coalesced: many commits in a burst
// run one dispatcher. Never throws into the caller.
// ---------------------------------------------------------------------------
let dispatchInFlight: Promise<void> | null = null;
let dispatchAgain = false;

/**
 * Serverless hosts (Vercel) freeze the function as soon as the response is
 * sent, so a plain fire-and-forget promise never finishes and rows stay in
 * SENDING until the cron recovers them. Inside a request we therefore hand the
 * work to Next's `after()`, which keeps the function alive until it completes.
 * Outside a request scope (scripts, tests) `after` throws and we fall back to
 * the in-process promise.
 */
export function scheduleEmailDispatch(): void {
  try {
    after(() => runDispatch());
    return;
  } catch {
    /* not inside a request — run inline */
  }
  runDispatch();
}

function runDispatch(): Promise<void> {
  if (dispatchInFlight) {
    dispatchAgain = true;
    return dispatchInFlight;
  }
  dispatchInFlight = (async () => {
    try {
      do {
        dispatchAgain = false;
        await dispatchPendingEmails();
      } while (dispatchAgain);
    } catch (err) {
      console.error("[email:outbox] dispatch failed", err instanceof Error ? err.message : err);
    } finally {
      dispatchInFlight = null;
    }
  })();
  return dispatchInFlight;
}

/** Test/ops helper: wait for an in-flight dispatch to finish. */
export async function awaitEmailDispatch(): Promise<void> {
  while (dispatchInFlight) await dispatchInFlight;
}

export async function outboxCounts(db: PrismaClient = prisma) {
  const rows = await db.emailOutbox.groupBy({ by: ["status"], _count: { _all: true } });
  const out = { PENDING: 0, SENDING: 0, SENT: 0, FAILED: 0 };
  for (const r of rows) out[r.status] = r._count._all;
  return out;
}
