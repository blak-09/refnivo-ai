import type { Prisma, PrismaClient, UserRole } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getRequestContext, type RequestContext } from "@/lib/utils/request-context";

type Db = PrismaClient | Prisma.TransactionClient;

export type AuditEntry = {
  userId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  /** Keep this free of secrets and unnecessary personal data. */
  metadata?: Prisma.InputJsonValue;
  /** Role of the actor at the time of the action (optional). */
  actorRole?: UserRole | null;
  /**
   * Request context (hashed IP, truncated user agent, request id). Resolved from
   * the current request when omitted; pass `null` to skip explicitly.
   */
  context?: RequestContext | null;
};

/**
 * Writes an audit log row. Pass a transaction client to make the log atomic
 * with the change it records.
 */
export async function recordAudit(entry: AuditEntry, db: Db = prisma) {
  const context = entry.context === undefined ? await getRequestContext() : entry.context;
  await db.auditLog.create({
    data: {
      userId: entry.userId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      metadata: entry.metadata,
      actorRole: entry.actorRole ?? null,
      ipHash: context?.ipHash ?? null,
      userAgent: context?.userAgent ?? null,
      requestId: context?.requestId ?? null,
    },
  });
}
