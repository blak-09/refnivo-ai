/**
 * Decision logic for `npm run db:deploy` (pure, unit-tested).
 *
 * - Local targets run without confirmation.
 * - Remote targets require DB_DEPLOY_CONFIRM_HOST to equal the parsed hostname,
 *   so a stale shell variable can never migrate the wrong database.
 * - A database whose migration history table is missing (Prisma P3005) must be
 *   baselined first — see docs/PRODUCTION.md §3.
 */
import { describeDatabaseUrl, type DatabaseTarget } from "./db-url";

export type DeployVerdict = { ok: true; target: DatabaseTarget } | { ok: false; reason: string; target: DatabaseTarget | null };

export function decideDeploy(input: { url: string | undefined; confirmHost: string | undefined }): DeployVerdict {
  const target = describeDatabaseUrl(input.url);
  if (!target) return { ok: false, reason: "DATABASE_URL is not set. Refusing to run.", target: null };
  if (!target.ok) return { ok: false, reason: "DATABASE_URL could not be parsed. Refusing to run.", target };
  if (target.local) return { ok: true, target };
  const confirm = (input.confirmHost ?? "").trim();
  if (!confirm) {
    return { ok: false, reason: `remote target ${target.host}:${target.port} — set DB_DEPLOY_CONFIRM_HOST="${target.host}" in this shell to confirm.`, target };
  }
  if (confirm !== target.host) {
    return { ok: false, reason: `DB_DEPLOY_CONFIRM_HOST does not match the target host ${target.host}. Refusing to run.`, target };
  }
  return { ok: true, target };
}

/**
 * True when `prisma migrate status` output indicates the database has a schema
 * but no `_prisma_migrations` history (P3005). Deploying in that state fails, so
 * the operator must baseline first.
 */
export function needsBaseline(statusOutput: string): boolean {
  return /P3005|database schema is not empty|_prisma_migrations[^\n]*(does not exist|not found)/i.test(statusOutput);
}
