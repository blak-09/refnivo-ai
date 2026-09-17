/**
 * Next.js instrumentation hook — runs once per server start.
 *
 * In production it validates the environment before any request is served and
 * logs the outcome (variable names only, never values). It does NOT throw: a
 * thrown error here becomes a blank 500 on every route, which hides the cause.
 * Instead the result is cached (lib/config/boot-state.ts) and:
 *   - the root layout renders a maintenance page instead of the app,
 *   - /api/health answers 503 with the failing rule names,
 *   - the proxy refuses protected routes,
 * until the configuration is fixed and the deployment restarted.
 * Development and test are never blocked.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NODE_ENV !== "production") return;

  const [{ getBootState }, { securityEvent }] = await Promise.all([import("@/lib/config/boot-state"), import("@/lib/utils/security-log")]);
  const state = getBootState();
  for (const warning of state.warnings) securityEvent("ENV_VALIDATION_WARNING", { message: warning });
  if (!state.ok) {
    securityEvent("ENV_VALIDATION_FAILED", { count: state.errors.length, errors: state.errors });
    console.error(`[boot] production environment is not configured — refusing to serve the app until fixed:\n - ${state.errors.join("\n - ")}`);
  }
}
