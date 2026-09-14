import type { ZodError } from "zod";

export type FieldErrors = Record<string, string>;

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: FieldErrors; values?: Record<string, string> };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(error: string, fieldErrors?: FieldErrors, values?: Record<string, string>): ActionResult<never> {
  return { ok: false, error, fieldErrors, values };
}

const SENSITIVE_FIELDS = new Set(["password", "currentPassword", "newPassword", "confirmPassword"]);

/** String values from a FormData, minus secrets — echoed back so a failed submit keeps what the user typed. */
export function formValues(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of formData.entries()) {
    if (typeof v === "string" && !SENSITIVE_FIELDS.has(k)) out[k] = v;
  }
  return out;
}

/** Flattens a Zod error into `{ field: "first message" }`. */
export function zodFieldErrors(error: ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.map(String).join(".") : "_form";
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

export function firstError(fieldErrors: FieldErrors): string {
  return Object.values(fieldErrors)[0] ?? "Please check the form for errors.";
}

/** Converts unknown thrown values into a safe user-facing message. */
export function safeErrorMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
  if (err && typeof err === "object" && "name" in err && (err as { name: string }).name === "AuthorizationError") {
    return (err as Error).message;
  }
  if (process.env.NODE_ENV !== "production" && err instanceof Error) {
    return err.message;
  }
  return fallback;
}
