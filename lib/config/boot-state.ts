import { isBuildPhase, validateProductionEnv, type EnvReport } from "./env";

/**
 * Result of the production start-up validation, computed once per server
 * process and cached on globalThis (Next may load this module more than once).
 *
 * Design: a misconfigured deployment must never serve the application, but it
 * must also never be a blank 500 — operators need to see WHICH variable is
 * wrong without log access. Only variable names and rule text are ever
 * exposed; values never are.
 */
export type BootState = { ok: boolean; errors: string[]; warnings: string[]; checkedAt: string };

const g = globalThis as unknown as { __refnivoBootState?: BootState };

export function getBootState(env: NodeJS.ProcessEnv = process.env): BootState {
  // `next build` has no runtime secrets and must not bake a maintenance page into prerendered HTML.
  if (isBuildPhase(env)) return { ok: true, errors: [], warnings: [], checkedAt: new Date().toISOString() };
  if (g.__refnivoBootState) return g.__refnivoBootState;
  const report: EnvReport = validateProductionEnv(env);
  g.__refnivoBootState = { ok: report.errors.length === 0, errors: report.errors, warnings: report.warnings, checkedAt: new Date().toISOString() };
  return g.__refnivoBootState;
}

/** Test helper — forces re-validation on the next call. */
export function resetBootState(): void {
  delete g.__refnivoBootState;
}

/** True when the deployment must refuse to serve application routes. */
export function isMisconfigured(): boolean {
  return !getBootState().ok;
}
