import { redact, type Loggable } from "./security-log";

/**
 * Safe server-side error logging for actions and routes.
 *
 * Emits one JSON line with the error's class, a stable code (Prisma `P…`
 * codes, Node `ECONNREFUSED`, …), the affected table/column when Prisma
 * reports one, and the message with any URL credentials stripped. It never
 * includes request bodies, passwords, tokens or personal data — callers pass
 * only ids/booleans in `fields`, and everything goes through `redact()`.
 */
export type ErrorSummary = { name: string; code: string | null; message: string; target: string | null };

export function describeError(err: unknown): ErrorSummary {
  if (!(err && typeof err === "object")) return { name: "UnknownError", code: null, message: String(err), target: null };
  const e = err as { name?: string; code?: unknown; message?: unknown; meta?: { table?: unknown; column?: unknown; target?: unknown; modelName?: unknown } };
  const meta = e.meta ?? {};
  const target = [meta.modelName, meta.table, meta.column, Array.isArray(meta.target) ? meta.target.join(",") : meta.target].filter(Boolean).map(String).join(" ") || null;
  const message = typeof e.message === "string" ? e.message.replace(/\s+/g, " ").trim().slice(0, 300) : "";
  return { name: e.name ?? "Error", code: typeof e.code === "string" || typeof e.code === "number" ? String(e.code) : null, message, target };
}

/** Human hint for the most common infrastructure failures, so logs are actionable without a stack trace. */
export function errorHint(summary: ErrorSummary): string | null {
  switch (summary.code) {
    case "P1000":
      return "database authentication failed — check DATABASE_URL credentials";
    case "P1001":
    case "P1002":
    case "P1017":
    case "ECONNREFUSED":
    case "ETIMEDOUT":
      return "database unreachable — check DATABASE_URL host/port and network access";
    case "P2021":
      return "table does not exist — run `npm run db:deploy` (pending migrations)";
    case "P2022":
      return "column does not exist — run `npm run db:deploy` (pending migrations)";
    case "42P05":
      return "prepared statement conflict — add `?pgbouncer=true` to a transaction-pooler DATABASE_URL";
    default:
      return summary.message.includes("prepared statement") ? "prepared statement conflict — add `?pgbouncer=true` to a transaction-pooler DATABASE_URL" : null;
  }
}

export function logServerError(scope: string, err: unknown, fields: { [key: string]: Loggable } = {}): ErrorSummary {
  const summary = describeError(err);
  try {
    const line = redact({ scope, ...summary, hint: errorHint(summary), ...fields }) as Loggable;
    console.error(`[${scope}] ${JSON.stringify(line)}`);
  } catch {
    console.error(`[${scope}] ${summary.name}${summary.code ? ` ${summary.code}` : ""}`);
  }
  return summary;
}
