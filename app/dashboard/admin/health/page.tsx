import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard, PageHeader, StatusBadge } from "@/components/dashboard/primitives";
import { requireRole } from "@/lib/auth/guards";
import { validateProductionEnv } from "@/lib/config/env";
import { checkDatabase } from "@/lib/db/health";
import { emailProviderName, isEmailConfigured } from "@/lib/email";
import { outboxCounts } from "@/lib/email/outbox";
import { prisma } from "@/lib/db/prisma";

export const metadata: Metadata = { title: "System health" };

export const dynamic = "force-dynamic";

/**
 * Operator view: liveness, configuration posture and migration state.
 * Shows provider NAMES and booleans only — never values or connection strings.
 */
export default async function AdminHealthPage() {
  await requireRole("ADMIN");
  const [db, report, outbox, migrations] = await Promise.all([
    checkDatabase(),
    Promise.resolve(validateProductionEnv()),
    outboxCounts().catch(() => null),
    prisma.$queryRaw<{ migration_name: string; finished_at: Date | null }[]>`SELECT "migration_name", "finished_at" FROM "_prisma_migrations" ORDER BY "started_at" DESC LIMIT 5`.catch(() => null),
  ]);

  const rateLimit = (process.env.RATE_LIMIT_PROVIDER ?? "memory").toLowerCase();
  const storage = (process.env.STORAGE_PROVIDER ?? "local").toLowerCase();
  const payments = (process.env.PAYMENT_PROVIDER ?? "NONE").toUpperCase();

  return (
    <div className="space-y-6">
      <PageHeader title="System health" description="Live checks for this deployment. Configuration values are never displayed — only which provider is active." />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Database" value={db.ok ? "Reachable" : "Unreachable"} hint={`${db.latencyMs} ms`} />
        <KpiCard label="Environment" value={process.env.NODE_ENV ?? "development"} hint={report.errors.length ? `${report.errors.length} error(s)` : "No blocking issues"} />
        <KpiCard label="E-mail provider" value={emailProviderName()} hint={isEmailConfigured() ? "Configured" : "Not configured — in-app only"} />
        <KpiCard
          label="E-mail outbox"
          value={outbox ? `${outbox.PENDING + outbox.FAILED} waiting` : "—"}
          hint={outbox ? `${outbox.SENT} sent · ${outbox.FAILED} failed (retried by npm run email:outbox)` : "unavailable"}
        />
        <KpiCard label="Rate limiting" value={rateLimit} hint={rateLimit === "memory" ? "Per instance" : "Shared store"} />
        <KpiCard label="Storage" value={storage} hint={storage === "local" ? "Local disk (dev)" : "Object storage"} />
        <KpiCard label="Payments" value={payments} hint="Disabled in this release" />
        <KpiCard label="Public health endpoint" value="/api/health" hint="200 when the database answers" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configuration checks</CardTitle>
          <CardDescription>Produced by the same validator that runs at production start-up.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {!report.errors.length && !report.warnings.length ? (
            <p className="text-muted-foreground">{process.env.NODE_ENV === "production" ? "All production checks pass." : "Checks only apply to production builds."}</p>
          ) : null}
          {report.errors.map((e) => (
            <p key={e} className="flex items-start gap-2">
              <StatusBadge status="REJECTED" label="error" /> <span>{e}</span>
            </p>
          ))}
          {report.warnings.map((w) => (
            <p key={w} className="flex items-start gap-2">
              <StatusBadge status="PENDING" label="warning" /> <span>{w}</span>
            </p>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Migrations</CardTitle>
          <CardDescription>Latest entries in the migration history table.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
          {migrations === null ? (
            <p className="text-destructive">Migration history table not found — this database has not been baselined (see docs/PRODUCTION.md §3).</p>
          ) : !migrations.length ? (
            <p className="text-muted-foreground">No migrations recorded.</p>
          ) : (
            <ul className="space-y-1 font-mono text-xs">
              {migrations.map((m) => (
                <li key={m.migration_name} className="flex justify-between gap-4">
                  <span>{m.migration_name}</span>
                  <span className="text-muted-foreground">{m.finished_at ? "applied" : "pending"}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
