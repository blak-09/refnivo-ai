import { PrismaClient } from "@prisma/client";
import { normalizeDatabaseUrl } from "@/lib/config/database-url";

/**
 * Raw Prisma client singleton. Import `prisma` from `@/lib/db/prisma` in
 * application code; this module exists so infrastructure that `prisma.ts`
 * itself depends on (the e-mail outbox) can use the client without a circular
 * import.
 *
 * The connection string is normalised first (see lib/config/database-url.ts):
 * a Supabase transaction-pooler URL pasted straight from the dashboard gets
 * the `pgbouncer=true` flag Prisma requires.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: normalizeDatabaseUrl(process.env.DATABASE_URL),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
