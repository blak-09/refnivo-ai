import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * /api/health reports "schema: current" only when REQUIRED_MIGRATION (lib/db/health.ts)
 * is recorded in _prisma_migrations. Production migrations are applied by the operator
 * before promoting (docs/PRODUCTION.md §4), so the constant must always name the newest
 * migration — otherwise a deploy whose migration was forgotten still looks healthy while
 * its pages fail. (The module is `server-only`, hence reading the source.)
 */
export function requiredMigrationFromSource(): string {
  const src = readFileSync("lib/db/health.ts", "utf8");
  const m = src.match(/export const REQUIRED_MIGRATION = "([^"]+)"/);
  if (!m) throw new Error("REQUIRED_MIGRATION not found in lib/db/health.ts");
  return m[1];
}

describe("REQUIRED_MIGRATION", () => {
  it("names the newest migration in prisma/migrations", () => {
    const newest = readdirSync("prisma/migrations")
      .filter((d) => /^\d{14}_/.test(d))
      .sort()
      .at(-1);
    expect(requiredMigrationFromSource()).toBe(newest);
  });
});
