/**
 * Delivers pending / retryable e-mails from the outbox: `npm run email:outbox`
 *
 * The app already dispatches after every committed transaction; run this from
 * a scheduler (cron, GitHub Actions schedule, Vercel cron) as the safety net
 * that retries failures with backoff. Uses the same driver configuration as
 * the app (EMAIL_PROVIDER); prints counts only — never addresses or bodies.
 */
async function main() {
  await import("dotenv/config");
  const [{ dispatchPendingEmails, outboxCounts }, { PrismaClient }] = await Promise.all([import("../lib/email/outbox"), import("@prisma/client")]);
  const prisma = new PrismaClient();
  try {
    const before = await outboxCounts(prisma);
    const summary = await dispatchPendingEmails({ db: prisma, limit: Number(process.env.EMAIL_OUTBOX_BATCH ?? 200) });
    const after = await outboxCounts(prisma);
    console.log(`[email:outbox] before ${JSON.stringify(before)} → dispatched ${JSON.stringify(summary)} → after ${JSON.stringify(after)}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(`[email:outbox] ${err instanceof Error ? err.message : "failed"}`);
  process.exit(1);
});
