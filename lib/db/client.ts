import { PrismaClient } from "@prisma/client";

/**
 * Raw Prisma client singleton. Import `prisma` from `@/lib/db/prisma` in
 * application code; this module exists so infrastructure that `prisma.ts`
 * itself depends on (the e-mail outbox) can use the client without a circular
 * import.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
