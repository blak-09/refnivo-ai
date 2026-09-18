import bcrypt from "bcryptjs";
import { Prisma, type UserRole } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { isAutoApproved } from "@/lib/config/signup-policy";
import { generateRegistrationId } from "@/lib/utils/registration-id";
import { recordAudit } from "./audit";

export class EmailTakenError extends Error {
  constructor() {
    super("An account with this email already exists.");
    this.name = "EmailTakenError";
  }
}

function isUniqueViolationOn(err: unknown, field: string): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2002") return false;
  const target = err.meta?.target;
  if (Array.isArray(target)) return target.includes(field);
  if (typeof target === "string") return target.includes(field);
  return false;
}

export type CreateUserInput = {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  phone?: string | null;
  /** Non-sensitive role-specific fields captured at signup. Never the password. */
  registrationDetails?: Record<string, string | number>;
};

export async function createUser(input: CreateUserInput, now = new Date()) {
  const passwordHash = await bcrypt.hash(input.password, 12);
  const details = input.registrationDetails ?? {};
  // ADMIN can never be created here (see REGISTRABLE_ROLES); other roles follow SIGNUP_APPROVAL.
  const autoApproved = input.role !== "ADMIN" && isAutoApproved(input.role);

  // Retry only on a registrationId collision; surface email conflicts immediately.
  for (let attempt = 0; attempt < 5; attempt++) {
    const registrationId = generateRegistrationId();
    try {
      return await prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            name: input.name,
            email: input.email.toLowerCase(),
            passwordHash,
            role: input.role,
            phone: input.phone || null,
            status: autoApproved ? "APPROVED" : "PENDING",
            approvedAt: autoApproved ? now : null,
            registrationId,
            registrationDetails: details as Prisma.InputJsonValue,
          },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            status: true,
            phone: true,
            registrationId: true,
            createdAt: true,
          },
        });
        await recordAudit(
          {
            userId: created.id,
            action: "USER_REGISTERED",
            entityType: "User",
            entityId: created.id,
            metadata: { role: created.role, registrationId, autoApproved },
          },
          tx,
        );
        return created;
      });
    } catch (err) {
      if (isUniqueViolationOn(err, "email")) throw new EmailTakenError();
      if (isUniqueViolationOn(err, "registrationId")) continue; // regenerate and retry
      throw err;
    }
  }
  throw new Error("Could not allocate a registration id. Please try again.");
}

/** Approve a pending/rejected account so the user can sign in. */
export async function approveUser(userId: string, adminId: string) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: userId },
      data: {
        status: "APPROVED",
        approvedAt: new Date(),
        approvedById: adminId,
        rejectedAt: null,
        rejectionReason: null,
      },
      select: { id: true, name: true, email: true, role: true, status: true, registrationId: true },
    });
    await recordAudit(
      { userId: adminId, action: "USER_APPROVED", entityType: "User", entityId: userId, metadata: { status: "APPROVED" } },
      tx,
    );
    return user;
  });
}

/** Reject an account with a reason (shown to the user on the status page). */
export async function rejectUser(userId: string, adminId: string, reason: string) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: userId },
      data: {
        status: "REJECTED",
        rejectedAt: new Date(),
        rejectionReason: reason,
        approvedAt: null,
        approvedById: null,
      },
      select: { id: true, name: true, email: true, role: true, status: true, registrationId: true },
    });
    await recordAudit(
      { userId: adminId, action: "USER_REJECTED", entityType: "User", entityId: userId, metadata: { status: "REJECTED", reason } },
      tx,
    );
    return user;
  });
}

export async function updateAccount(userId: string, input: { name: string; phone?: string | null }) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: userId },
      data: { name: input.name, phone: input.phone || null },
      select: { id: true, name: true, phone: true },
    });
    await recordAudit({ userId, action: "ACCOUNT_UPDATED", entityType: "User", entityId: userId }, tx);
    return user;
  });
}

export class WrongPasswordError extends Error {
  constructor() {
    super("Current password is incorrect.");
    this.name = "WrongPasswordError";
  }
}

/**
 * Changes the password and bumps `sessionVersion`, which invalidates every
 * existing session (including the current one — the caller signs the user out
 * and asks them to log in again). Clears `mustChangePassword`.
 */
export async function changePassword(userId: string, currentPassword: string, newPassword: string, now = new Date()) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
  if (!user) throw new WrongPasswordError();
  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) throw new WrongPasswordError();
  const passwordHash = await bcrypt.hash(newPassword, 12);
  return prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: userId },
      data: { passwordHash, passwordChangedAt: now, mustChangePassword: false, sessionVersion: { increment: 1 } },
      select: { id: true, role: true, sessionVersion: true },
    });
    await recordAudit(
      { userId, actorRole: updated.role, action: "PASSWORD_CHANGED", entityType: "User", entityId: userId, metadata: { sessionsRevoked: true } },
      tx,
    );
    return updated;
  });
}

/** Invalidates every session of a user (e.g. on suspension or admin request) without touching the password. */
export async function revokeSessions(userId: string, actorId: string | null, reason: string) {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({ where: { id: userId }, data: { sessionVersion: { increment: 1 } }, select: { id: true, sessionVersion: true } });
    await recordAudit({ userId: actorId, action: "SESSIONS_REVOKED", entityType: "User", entityId: userId, metadata: { reason } }, tx);
    return updated;
  });
}
