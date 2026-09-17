import type { Prisma } from "@prisma/client";
import { prisma } from "./client";
import { scheduleEmailDispatch } from "@/lib/email/outbox";

export { prisma };

/**
 * Interactive transaction with after-commit side effects.
 *
 * Business code writes notifications and e-mail outbox rows INSIDE `fn`; only
 * once the transaction has committed do we trigger the outbox dispatcher (fire
 * and forget). If `fn` throws, nothing is dispatched — the rows never existed.
 * Use this instead of `prisma.$transaction` wherever `notify()` or
 * `enqueueEmail()` may be called.
 */
export async function transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>, options?: { maxWait?: number; timeout?: number }): Promise<T> {
  const result = await prisma.$transaction(fn, options);
  scheduleEmailDispatch();
  return result;
}
