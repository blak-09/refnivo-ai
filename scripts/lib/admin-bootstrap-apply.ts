/**
 * Database side of the admin bootstrap. Separated from the CLI so the
 * integration tests can exercise it against the local test database.
 * Never logs; returns a summary without the password or hash.
 */
import type { PrismaClient } from "@prisma/client";
import { decideBootstrap, DEMO_EMAIL_DOMAIN, type BootstrapDecision, type BootstrapEnv } from "./admin-bootstrap";

export type ApplyResult =
  | { ok: true; action: "create" | "rotate"; userId: string; email: string }
  | { ok: false; decision: Extract<BootstrapDecision, { action: "refuse" }> };

export async function applyBootstrap(
  prisma: PrismaClient,
  input: { email: string; name: string; passwordHash: string; env: BootstrapEnv; via?: string },
  now = new Date(),
): Promise<ApplyResult> {
  const via = input.via ?? "scripts/create-admin.ts";
  return prisma.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({ where: { email: input.email }, select: { id: true, role: true, status: true } });
    const otherAdmins = await tx.user.count({
      where: { role: "ADMIN", status: "APPROVED", email: { not: input.email }, NOT: { email: { endsWith: `@${DEMO_EMAIL_DOMAIN}` } } },
    });
    const decision = decideBootstrap({ existing, otherAdmins, env: input.env });

    if (decision.action === "refuse") {
      await tx.auditLog.create({
        data: { userId: null, action: "ADMIN_BOOTSTRAP_REFUSED", entityType: "User", entityId: existing?.id ?? null, metadata: { via, code: decision.code } },
      });
      return { ok: false, decision };
    }

    if (decision.action === "rotate") {
      const user = await tx.user.update({
        where: { id: decision.userId },
        data: {
          name: input.name,
          passwordHash: input.passwordHash,
          status: "APPROVED",
          approvedAt: now,
          rejectedAt: null,
          rejectionReason: null,
          mustChangePassword: true,
          passwordChangedAt: now,
          sessionVersion: { increment: 1 },
        },
        select: { id: true, email: true },
      });
      await tx.auditLog.create({
        data: { userId: user.id, action: "ADMIN_BOOTSTRAPPED", entityType: "User", entityId: user.id, metadata: { via, rotated: true, sessionsRevoked: true } },
      });
      return { ok: true, action: "rotate", userId: user.id, email: user.email };
    }

    const user = await tx.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash: input.passwordHash,
        role: "ADMIN",
        status: "APPROVED",
        approvedAt: now,
        mustChangePassword: true,
        sessionVersion: 1,
      },
      select: { id: true, email: true },
    });
    await tx.auditLog.create({
      data: { userId: user.id, action: "ADMIN_BOOTSTRAPPED", entityType: "User", entityId: user.id, metadata: { via, rotated: false, mustChangePassword: true } },
    });
    return { ok: true, action: "create", userId: user.id, email: user.email };
  });
}
