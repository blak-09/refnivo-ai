import { afterAll, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { prisma, transaction } from "@/lib/db/prisma";
import { enqueueEmail } from "@/lib/email/outbox";
import { contactInbox } from "@/lib/config/contact";
import { uniq } from "../helpers";

/**
 * The contact form queues into the real transactional outbox. The server action
 * itself needs a request context (headers/cookies), so this test exercises the
 * same enqueue path and idempotency key it uses, against the test database.
 */
const key = (email: string, subject: string, message: string, hour: number) =>
  `contact:${createHash("sha256").update(`${hour}:${email.toLowerCase()}:${subject}:${message}`).digest("hex").slice(0, 40)}`;

afterAll(() => prisma.$disconnect());

describe("contact form → e-mail outbox", () => {
  it("queues one row addressed to the contact inbox and never duplicates an identical message", async () => {
    const email = `${uniq("sender")}@example.com`;
    const subject = "Partnership";
    const message = "We sell headphones and want to run a creator campaign.";
    const hour = Math.floor(Date.now() / 3_600_000);
    const idempotencyKey = key(email, subject, message, hour);

    const first = await transaction((tx) =>
      enqueueEmail(tx, { idempotencyKey, to: contactInbox(), subject: `[Contact · Brand] ${subject}`, text: `Email: ${email}\n\n${message}` }),
    );
    expect(first.queued).toBe(true);

    const row = await prisma.emailOutbox.findUniqueOrThrow({ where: { idempotencyKey } });
    expect(row.to).toBe(contactInbox());
    expect(row.subject).toContain(subject);
    expect(row.text).toContain(email); // the sender's address travels in the body, so the team can reply

    // A second identical submission (double click, retry) is a no-op.
    const second = await transaction((tx) =>
      enqueueEmail(tx, { idempotencyKey, to: contactInbox(), subject: `[Contact · Brand] ${subject}`, text: `Email: ${email}\n\n${message}` }),
    );
    expect(second).toEqual({ queued: false, reason: "DUPLICATE" });
    expect(await prisma.emailOutbox.count({ where: { idempotencyKey } })).toBe(1);
  });
});
