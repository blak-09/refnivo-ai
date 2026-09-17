/**
 * Next.js instrumentation hook — runs once per server start.
 * In production it validates the environment before any request is served:
 * misconfiguration fails the boot loudly (variable names only, never values).
 * Development and test are never blocked.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NODE_ENV !== "production") return;

  const [{ ConfigurationError, validateProductionEnv }, { securityEvent }] = await Promise.all([
    import("@/lib/config/env"),
    import("@/lib/utils/security-log"),
  ]);
  const report = validateProductionEnv();
  for (const warning of report.warnings) securityEvent("ENV_VALIDATION_WARNING", { message: warning });
  if (report.errors.length) {
    securityEvent("ENV_VALIDATION_FAILED", { count: report.errors.length, errors: report.errors });
    throw new ConfigurationError(`Production environment is not configured: ${report.errors.join(" ")}`);
  }
}
