import "server-only";
import type { Prisma, UserRole, UserStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

/** Narrow the stored JSON `registrationDetails` to a plain key/value record (or null). */
export function asRegistrationDetails(value: Prisma.JsonValue | null): Record<string, string | number> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, string | number>;
  }
  return null;
}

export type RegistrationInfo = {
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  registrationId: string | null;
  createdAt: Date;
  rejectionReason: string | null;
};

const SELECT = {
  name: true,
  email: true,
  role: true,
  status: true,
  registrationId: true,
  createdAt: true,
  rejectionReason: true,
} as const;

/** Look up a registration by its opaque Registration ID. */
export async function findRegistrationById(registrationId: string): Promise<RegistrationInfo | null> {
  const id = registrationId.trim();
  if (!id) return null;
  return prisma.user.findUnique({ where: { registrationId: id }, select: SELECT });
}

/** Look up a registration by email (used on the public status check). */
export async function findRegistrationByEmail(email: string): Promise<RegistrationInfo | null> {
  const e = email.trim().toLowerCase();
  if (!e) return null;
  return prisma.user.findUnique({ where: { email: e }, select: SELECT });
}
