import "server-only";
import { prisma } from "./prisma";

export type DatabaseHealth = { ok: true; latencyMs: number } | { ok: false; latencyMs: number };

/**
 * Cheap liveness probe. Never throws and never returns connection details —
 * a failure is reported as `ok: false` only (the reason goes to the server log).
 */
export async function checkDatabase(timeoutMs = 3000): Promise<DatabaseHealth> {
  const started = Date.now();
  const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), timeoutMs).unref?.());
  try {
    await Promise.race([prisma.$queryRaw`SELECT 1`, timeout]);
    return { ok: true, latencyMs: Date.now() - started };
  } catch (err) {
    console.error("[health] database check failed", err instanceof Error ? err.message : "unknown error");
    return { ok: false, latencyMs: Date.now() - started };
  }
}
