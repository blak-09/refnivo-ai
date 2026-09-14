import bcrypt from "bcryptjs";
import { Prisma, type UserRole } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { recordAudit } from "./audit";

export class EmailTakenError extends Error {
  constructor() {
    super("An account with this email already exists.");
    this.name = "EmailTakenError";
  }
}

export async function createUser(input: {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  phone?: string | null;
}) {
  const passwordHash = await bcrypt.hash(input.password, 12);
  try {
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name: input.name,
          email: input.email.toLowerCase(),
          passwordHash,
          role: input.role,
          phone: input.phone || null,
          status: "PENDING",
        },
        select: { id: true, name: true, email: true, role: true, status: true },
      });
      await recordAudit(
        { userId: created.id, action: "USER_REGISTERED", entityType: "User", entityId: created.id, metadata: { role: created.role } },
        tx,
      );
      return created;
    });
    return user;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new EmailTakenError();
    }
    throw err;
  }
}

export async function setUserStatus(userId: string, actorId: string, status: "APPROVED" | "SUSPENDED") {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: userId },
      data: { status },
      select: { id: true, name: true, email: true, role: true, status: true },
    });
    await recordAudit(
      { userId: actorId, action: status === "APPROVED" ? "USER_APPROVED" : "USER_SUSPENDED", entityType: "User", entityId: userId, metadata: { status } },
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

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
  if (!user) throw new WrongPasswordError();
  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) throw new WrongPasswordError();
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { passwordHash } });
    await recordAudit({ userId, action: "PASSWORD_CHANGED", entityType: "User", entityId: userId }, tx);
  });
}
