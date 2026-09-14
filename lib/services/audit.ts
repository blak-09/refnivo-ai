import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

type Db = PrismaClient | Prisma.TransactionClient;

export type AuditEntry = {
  userId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  /** Keep this free of secrets and unnecessary personal data. */
  metadata?: Prisma.InputJsonValue;
};

/**
 * Writes an audit log row. Pass a transaction client to make the log atomic
 * with the change it records.
 */
export async function recordAudit(entry: AuditEntry, db: Db = prisma) {
  await db.auditLog.create({
    data: {
      userId: entry.userId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      metadata: entry.metadata,
    },
  });
}
