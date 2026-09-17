import { afterAll, describe, expect, it, vi } from "vitest";
import { prisma, transaction } from "@/lib/db/prisma";
import type { EmailDriver, EmailMessage } from "@/lib/email";
import { awaitEmailDispatch, dispatchPendingEmails, enqueueEmail, nextAttemptDelayMs, STALE_CLAIM_MS } from "@/lib/email/outbox";
import { notify } from "@/lib/services/notify";
import { requestPasswordReset } from "@/lib/services/password-reset";
import { makeCustomer, uniq } from "../helpers";

/**
 * Transactional outbox guarantees:
 *  - e-mail rows are written inside the business transaction → a rollback sends nothing;
 *  - delivery happens after commit, through the configured driver, and is retryable;
 *  - the same event (idempotency key) never produces a second e-mail;
 *  - opt-out suppresses notification e-mails; delivery failures never touch the business rows.
 */

function recordingDriver(opts: { failFirst?: number } = {}): EmailDriver & { sent: EmailMessage[]; calls: number } {
  const driver = {
    name: "test",
    sent: [] as EmailMessage[],
    calls: 0,
    async send(message: EmailMessage) {
      driver.calls += 1;
      if (opts.failFirst && driver.calls <= opts.failFirst) return { ok: false as const, provider: "test", reason: "simulated outage" };
      driver.sent.push(message);
      return { ok: true as const, provider: "test", id: `t_${driver.calls}` };
    },
  };
  return driver;
}

async function approvedCustomer() {
  const u = await makeCustomer();
  await prisma.user.update({ where: { id: u.id }, data: { status: "APPROVED" } });
  return u;
}

afterAll(async () => {
  await awaitEmailDispatch();
  await prisma.$disconnect();
});

describe("transactional e-mail outbox", () => {
  it("a rolled-back transaction leaves no notification and no e-mail job", async () => {
    const user = await approvedCustomer();
    const key = `test:${uniq("rollback")}`;
    await expect(
      transaction(async (tx) => {
        await notify({ userId: user.id, type: "SYSTEM", title: "Should never arrive", email: true, idempotencyKey: key }, tx);
        throw new Error("business rule failed after notify()");
      }),
    ).rejects.toThrow(/business rule/);
    await awaitEmailDispatch();
    expect(await prisma.notification.count({ where: { userId: user.id } })).toBe(0);
    expect(await prisma.emailOutbox.count({ where: { idempotencyKey: key } })).toBe(0);
    const driver = recordingDriver();
    await dispatchPendingEmails({ driver });
    expect(driver.sent.map((m) => m.subject)).not.toContain("Should never arrive");
  });

  it("a committed transaction creates the job (PENDING) and delivery marks it SENT exactly once", async () => {
    const user = await approvedCustomer();
    const key = `test:${uniq("commit")}`;
    const result = await transaction((tx) => notify({ userId: user.id, type: "SYSTEM", title: "Committed hello", body: "body", href: "/dashboard", email: true, idempotencyKey: key }, tx));
    expect(result.emailQueued).toBe(true);
    await awaitEmailDispatch(); // the after-commit dispatcher (console driver in tests) may already have delivered it

    const row = await prisma.emailOutbox.findUniqueOrThrow({ where: { idempotencyKey: key } });
    expect(["PENDING", "SENT"]).toContain(row.status);
    expect(row.to).toBe(user.email);
    expect(row.subject).toBe("Committed hello");
    expect(row.text).toContain("body");
    expect(row.text).toContain("/dashboard");

    // Explicit dispatch with a recording driver: a SENT row is never re-sent; a PENDING one is sent once.
    const driver = recordingDriver();
    await dispatchPendingEmails({ driver });
    await dispatchPendingEmails({ driver });
    const after = await prisma.emailOutbox.findUniqueOrThrow({ where: { idempotencyKey: key } });
    expect(after.status).toBe("SENT");
    expect(after.sentAt).not.toBeNull();
    expect(after.attempts).toBe(1);
    expect(driver.sent.filter((m) => m.subject === "Committed hello").length).toBeLessThanOrEqual(1);
  });

  it("e-mail opt-out prevents the job but keeps the in-app notification", async () => {
    const user = await approvedCustomer();
    await prisma.user.update({ where: { id: user.id }, data: { emailNotifications: false } });
    const key = `test:${uniq("optout")}`;
    const result = await transaction((tx) => notify({ userId: user.id, type: "SYSTEM", title: "Opted out", email: true, idempotencyKey: key }, tx));
    expect(result.emailQueued).toBe(false);
    expect(await prisma.notification.count({ where: { userId: user.id, title: "Opted out" } })).toBe(1);
    expect(await prisma.emailOutbox.count({ where: { idempotencyKey: key } })).toBe(0);
    // Security e-mails (password reset) are not subject to the opt-out.
    await requestPasswordReset(user.email);
    await awaitEmailDispatch();
    expect(await prisma.emailOutbox.count({ where: { userId: user.id, subject: { contains: "Reset your" } } })).toBe(1);
  });

  it("duplicate notification events with the same idempotency key never queue a second e-mail", async () => {
    const user = await approvedCustomer();
    const key = `test:${uniq("dupe")}`;
    const first = await transaction((tx) => notify({ userId: user.id, type: "SYSTEM", title: "Once", email: true, idempotencyKey: key }, tx));
    const second = await transaction((tx) => notify({ userId: user.id, type: "SYSTEM", title: "Once", email: true, idempotencyKey: key }, tx));
    expect(first.emailQueued).toBe(true);
    expect(second.emailQueued).toBe(false);
    expect(await prisma.emailOutbox.count({ where: { idempotencyKey: key } })).toBe(1);
    // Direct enqueue with a duplicate key is a no-op too (and never throws).
    expect(await enqueueEmail(prisma, { idempotencyKey: key, to: user.email, subject: "Once", text: "x" })).toEqual({ queued: false, reason: "DUPLICATE" });
    await awaitEmailDispatch();
    const driver = recordingDriver();
    await dispatchPendingEmails({ driver });
    expect(driver.sent.filter((m) => m.subject === "Once").length).toBeLessThanOrEqual(1);
  });

  it("a delivery failure is recorded and retried with backoff; the business transaction is unaffected", async () => {
    const user = await approvedCustomer();
    const key = `test:${uniq("fail")}`;
    // Queue directly (no after-commit dispatch) so the failing driver is the first to try it.
    const job = await enqueueEmail(prisma, { idempotencyKey: key, to: user.email, subject: "Flaky", text: "x", userId: user.id });
    expect(job.queued).toBe(true);
    const notification = await prisma.notification.create({ data: { userId: user.id, type: "SYSTEM", title: "Business row" } });

    const flaky = recordingDriver({ failFirst: 1 });
    const now = new Date();
    const first = await dispatchPendingEmails({ driver: flaky, now });
    expect(first.failed).toBe(1);
    let row = await prisma.emailOutbox.findUniqueOrThrow({ where: { idempotencyKey: key } });
    expect(row.status).toBe("FAILED");
    expect(row.attempts).toBe(1);
    expect(row.lastError).toBe("simulated outage");
    expect(row.nextAttemptAt.getTime()).toBe(now.getTime() + nextAttemptDelayMs(1));
    // Business data intact.
    expect(await prisma.notification.findUnique({ where: { id: notification.id } })).not.toBeNull();

    // Not retried before its backoff window …
    expect((await dispatchPendingEmails({ driver: flaky, now })).claimed).toBe(0);
    // … retried after it, and then SENT.
    const later = new Date(now.getTime() + nextAttemptDelayMs(1) + 1);
    const second = await dispatchPendingEmails({ driver: flaky, now: later });
    expect(second.sent).toBe(1);
    row = await prisma.emailOutbox.findUniqueOrThrow({ where: { idempotencyKey: key } });
    expect(row.status).toBe("SENT");
    expect(row.attempts).toBe(2);
    expect(flaky.sent.map((m) => m.subject)).toEqual(["Flaky"]);
  });

  it("gives up after maxAttempts (row stays FAILED for review) and a throwing driver is handled like a failure", async () => {
    const user = await approvedCustomer();
    const key = `test:${uniq("exhaust")}`;
    await prisma.emailOutbox.create({ data: { idempotencyKey: key, to: user.email, subject: "Doomed", text: "x", maxAttempts: 2 } });
    const throwing: EmailDriver = { name: "throwing", send: vi.fn(async () => { throw new Error("boom"); }) };
    let t = new Date();
    for (let i = 0; i < 3; i++) {
      await dispatchPendingEmails({ driver: throwing, now: t });
      t = new Date(t.getTime() + 24 * 60 * 60 * 1000);
    }
    const row = await prisma.emailOutbox.findUniqueOrThrow({ where: { idempotencyKey: key } });
    expect(row.status).toBe("FAILED");
    expect(row.attempts).toBe(2); // third pass skipped it
    expect(row.lastError).toBe("boom");
  });

  it("recovers an abandoned SENDING claim after the stale window", async () => {
    const user = await approvedCustomer();
    const key = `test:${uniq("stale")}`;
    const created = await prisma.emailOutbox.create({ data: { idempotencyKey: key, to: user.email, subject: "Stuck", text: "x", status: "SENDING", attempts: 1 } });
    const driver = recordingDriver();
    // Fresh claim: left alone.
    await dispatchPendingEmails({ driver, now: new Date(created.updatedAt.getTime() + 1000), limit: 1000 });
    expect(driver.sent.map((m) => m.subject)).not.toContain("Stuck");
    // Abandoned claim: retried and sent.
    await dispatchPendingEmails({ driver, now: new Date(created.updatedAt.getTime() + STALE_CLAIM_MS + 1000), limit: 1000 });
    expect(driver.sent.map((m) => m.subject)).toContain("Stuck");
    expect((await prisma.emailOutbox.findUniqueOrThrow({ where: { idempotencyKey: key } })).status).toBe("SENT");
  });

  it("concurrent dispatchers cannot double-send (atomic claim)", async () => {
    const user = await approvedCustomer();
    const key = `test:${uniq("race")}`;
    // Let any after-commit dispatcher from earlier tests finish so only a/b compete for this row.
    await awaitEmailDispatch();
    await enqueueEmail(prisma, { idempotencyKey: key, to: user.email, subject: "Race", text: "x" });
    const a = recordingDriver();
    const b = recordingDriver();
    await Promise.all([dispatchPendingEmails({ driver: a, limit: 1000 }), dispatchPendingEmails({ driver: b, limit: 1000 })]);
    const sends = a.sent.filter((m) => m.subject === "Race").length + b.sent.filter((m) => m.subject === "Race").length;
    expect(sends).toBe(1);
    // Exactly one claim happened, whoever won.
    const row = await prisma.emailOutbox.findUniqueOrThrow({ where: { idempotencyKey: key } });
    expect(row.status).toBe("SENT");
    expect(row.attempts).toBe(1);
  });
});
