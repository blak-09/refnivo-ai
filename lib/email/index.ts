import { securityEvent } from "@/lib/utils/security-log";

/**
 * Outbound e-mail abstraction.
 *
 *   EMAIL_PROVIDER=console (default) — logs the subject + recipient (never the
 *                                       body) and sends nothing. Safe everywhere.
 *   EMAIL_PROVIDER=resend             — Resend HTTP API via fetch (no SDK).
 *                                       Requires RESEND_API_KEY and EMAIL_FROM.
 *
 * Sending is always best-effort: callers must never block a user flow on it.
 * `isEmailConfigured()` lets UI tell the truth about whether an e-mail will go out.
 */
export type EmailMessage = { to: string; subject: string; text: string; html?: string };

export type EmailResult = { ok: true; provider: string; id?: string } | { ok: false; provider: string; reason: string };

export interface EmailDriver {
  readonly name: string;
  send(message: EmailMessage): Promise<EmailResult>;
}

export class ConsoleEmailDriver implements EmailDriver {
  readonly name = "console";
  async send(message: EmailMessage): Promise<EmailResult> {
    const masked = message.to.replace(/^(.).*(@.*)$/, "$1***$2");
    console.info(`[email:console] would send "${message.subject}" to ${masked} (no provider configured)`);
    return { ok: true, provider: this.name };
  }
}

export type FetchLike = (input: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export class ResendEmailDriver implements EmailDriver {
  readonly name = "resend";
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
    private readonly fetchImpl: FetchLike = fetch as unknown as FetchLike,
  ) {}

  async send(message: EmailMessage): Promise<EmailResult> {
    const res = await this.fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: this.from, to: [message.to], subject: message.subject, text: message.text, html: message.html }),
    });
    if (!res.ok) return { ok: false, provider: this.name, reason: `HTTP ${res.status}` };
    const data = (await res.json()) as { id?: string };
    return { ok: true, provider: this.name, id: data?.id };
  }
}

export function emailProviderName(env: NodeJS.ProcessEnv = process.env): "console" | "resend" {
  return (env.EMAIL_PROVIDER ?? "console").trim().toLowerCase() === "resend" ? "resend" : "console";
}

/** True only when a real provider is fully configured — used by UI copy (e.g. password reset). */
export function isEmailConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return emailProviderName(env) === "resend" && !!env.RESEND_API_KEY?.trim() && !!env.EMAIL_FROM?.trim();
}

let cached: EmailDriver | null = null;

export function getEmailDriver(env: NodeJS.ProcessEnv = process.env): EmailDriver {
  if (cached) return cached;
  if (isEmailConfigured(env)) {
    cached = new ResendEmailDriver(env.RESEND_API_KEY as string, env.EMAIL_FROM as string);
  } else {
    if (emailProviderName(env) === "resend") {
      securityEvent("ENV_VALIDATION_WARNING", { message: "EMAIL_PROVIDER=resend but RESEND_API_KEY / EMAIL_FROM missing — falling back to console" });
    }
    cached = new ConsoleEmailDriver();
  }
  return cached;
}

/** Best-effort send. Never throws; failures are logged without the message body. */
export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  const driver = getEmailDriver();
  try {
    const result = await driver.send(message);
    if (!result.ok) console.error(`[email:${driver.name}] send failed: ${result.reason}`);
    return result;
  } catch (err) {
    const reason = err instanceof Error ? err.message : "unknown error";
    console.error(`[email:${driver.name}] send failed: ${reason}`);
    return { ok: false, provider: driver.name, reason };
  }
}
