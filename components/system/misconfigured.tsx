/**
 * Shown instead of the application when the production start-up validation
 * fails. Public page: generic wording only — the failing variable NAMES are
 * available to operators on /api/health and in the server logs.
 */
export function MisconfiguredPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="max-w-md space-y-3 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Refnivo AI is being configured</h1>
        <p className="text-sm text-muted-foreground">
          This deployment is not ready to serve requests yet. If you are the operator, open <code className="font-mono">/api/health</code> — it lists the
          configuration rules that are failing, by variable name.
        </p>
      </div>
    </main>
  );
}
