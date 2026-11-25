/**
 * Shown instead of the application when the production start-up validation
 * fails. Public page: generic wording only — the failing variable NAMES are
 * available to operators in the server logs and on /api/health (with HEALTH_TOKEN).
 */
export function MisconfiguredPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="max-w-md space-y-3 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Refnivo AI is being configured</h1>
        <p className="text-sm text-muted-foreground">
          This deployment is not ready to serve requests yet. If you are the operator, check the server logs, or call{" "}
          <code className="font-mono">/api/health</code> with the <code className="font-mono">x-health-token</code> header set to{" "}
          <code className="font-mono">HEALTH_TOKEN</code> — it lists the configuration rules that are failing, by variable name.
        </p>
      </div>
    </main>
  );
}
