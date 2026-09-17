/**
 * Decision logic for `npm run admin:create` (pure, unit-tested without a DB).
 *
 * Rules (all refusals name a reason code; none echo a secret):
 *  1. DATABASE_URL must be set and parseable; LOCAL hosts need ADMIN_ALLOW_LOCAL=1.
 *  2. ADMIN_BOOTSTRAP_CONFIRM must equal the target hostname exactly.
 *  3. Email must be valid and not on the demo domain.
 *  4. Password: ≥ 12 chars, letter + digit, and not on the exposed-password
 *     deny-list (stored as SHA-256 hashes — no plaintext lives in the repo).
 *  5. The email must NOT already exist — this script never overwrites or
 *     promotes an account. The only exception is rotating the password of an
 *     account that is ALREADY an admin, with ADMIN_ROTATE_EXISTING=1.
 *  6. A second admin is refused unless ADMIN_ALLOW_ADDITIONAL=1.
 */
import { createHash } from "node:crypto";
import { describeDatabaseUrl, type DatabaseTarget } from "./db-url";

export const DEMO_EMAIL_DOMAIN = "localgrowth.demo";

/** SHA-256 of passwords known to be public (seed demo password, values pasted in chat/tickets, common defaults). */
export const DENIED_PASSWORD_HASHES = new Set([
  "2ac4757802ddfa9540f285b04d7ba282b55f206b9a4700c11010ebc410cdb4ab",
  "a04bd253000703608bbd735dd339739684ae43440c0426c93dcfb11bde2cef33",
  "19513fdc9da4fb72a4a05eb66917548d3c90ff94d5419e1f2363eea89dfee1dd",
  "ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f",
  "a0f3285b07c26c0dcd2191447f391170d06035e8d57e31a048ba87074f3a9a15",
  "ad89b64d66caa8e30e5d5ce4a9763f4ecc205814c412175f3e2c50027471426d",
  "2e4f0a5b329103f621d87fef3542883f9b21fc33e3a2ac0dbcfce72507037525",
  "ac1a61a96d2859510591a9600be1dd7ae1b30f1e6bce7b273fab9dd34ffe03c9",
]);

export function isDeniedPassword(password: string): boolean {
  return DENIED_PASSWORD_HASHES.has(createHash("sha256").update(password).digest("hex"));
}

export type BootstrapEnv = {
  DATABASE_URL?: string;
  ADMIN_ALLOW_LOCAL?: string;
  ADMIN_BOOTSTRAP_CONFIRM?: string;
  ADMIN_EMAIL?: string;
  ADMIN_NAME?: string;
  ADMIN_PASSWORD?: string;
  ADMIN_ROTATE_EXISTING?: string;
  ADMIN_ALLOW_ADDITIONAL?: string;
  [key: string]: string | undefined;
};

export type PreflightResult =
  | { ok: true; target: DatabaseTarget; email: string; name: string; password: string }
  | { ok: false; code: PreflightRefusal; message: string; target: DatabaseTarget | null };

export type PreflightRefusal =
  | "NO_DATABASE_URL"
  | "BAD_DATABASE_URL"
  | "LOCAL_TARGET"
  | "CONFIRM_MISSING"
  | "CONFIRM_MISMATCH"
  | "BAD_EMAIL"
  | "DEMO_EMAIL"
  | "WEAK_PASSWORD"
  | "DENIED_PASSWORD";

/** Checks that need no database connection. */
export function preflight(env: BootstrapEnv): PreflightResult {
  const target = describeDatabaseUrl(env.DATABASE_URL);
  if (!target) return { ok: false, code: "NO_DATABASE_URL", message: "DATABASE_URL is not set.", target: null };
  if (!target.ok) return { ok: false, code: "BAD_DATABASE_URL", message: "DATABASE_URL could not be parsed.", target };
  if (target.local && env.ADMIN_ALLOW_LOCAL !== "1") {
    return {
      ok: false,
      code: "LOCAL_TARGET",
      message: "Refusing to create an admin on a LOCAL database. Set $env:DATABASE_URL to the production URL in this shell, or set ADMIN_ALLOW_LOCAL=1 for local development.",
      target,
    };
  }

  const confirm = (env.ADMIN_BOOTSTRAP_CONFIRM ?? "").trim();
  if (!confirm) {
    return { ok: false, code: "CONFIRM_MISSING", message: `ADMIN_BOOTSTRAP_CONFIRM is required. Set it to the target hostname "${target.host}" to confirm.`, target };
  }
  if (confirm !== target.host) {
    return { ok: false, code: "CONFIRM_MISMATCH", message: `ADMIN_BOOTSTRAP_CONFIRM does not match the target hostname "${target.host}".`, target };
  }

  const email = (env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, code: "BAD_EMAIL", message: "ADMIN_EMAIL is missing or invalid.", target };
  if (email.endsWith(`@${DEMO_EMAIL_DOMAIN}`)) return { ok: false, code: "DEMO_EMAIL", message: "Refusing to create an admin on the demo email domain.", target };

  const password = env.ADMIN_PASSWORD ?? "";
  if (password.length < 12 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return { ok: false, code: "WEAK_PASSWORD", message: "ADMIN_PASSWORD must be at least 12 characters and include a letter and a number.", target };
  }
  if (isDeniedPassword(password)) {
    return { ok: false, code: "DENIED_PASSWORD", message: "ADMIN_PASSWORD is a known exposed/demo password. Choose a new one.", target };
  }

  const name = (env.ADMIN_NAME ?? "Platform Admin").trim() || "Platform Admin";
  return { ok: true, target, email, name, password };
}

export type ExistingUser = { id: string; role: string; status: string } | null;

export type BootstrapDecision =
  | { action: "create" }
  | { action: "rotate"; userId: string }
  | { action: "refuse"; code: "EMAIL_EXISTS" | "EMAIL_EXISTS_NOT_ADMIN" | "ADMIN_EXISTS"; message: string };

/**
 * Decides what to do once the database has been consulted.
 * @param existing      the user row for the requested email, if any
 * @param otherAdmins   number of APPROVED admins (excluding demo accounts and the requested email)
 */
export function decideBootstrap(input: { existing: ExistingUser; otherAdmins: number; env: BootstrapEnv }): BootstrapDecision {
  const { existing, otherAdmins, env } = input;

  if (existing) {
    if (existing.role !== "ADMIN") {
      return {
        action: "refuse",
        code: "EMAIL_EXISTS_NOT_ADMIN",
        message: `An account with this email already exists with role ${existing.role}. This script never promotes existing accounts.`,
      };
    }
    if (env.ADMIN_ROTATE_EXISTING === "1") return { action: "rotate", userId: existing.id };
    return {
      action: "refuse",
      code: "EMAIL_EXISTS",
      message: "An admin with this email already exists. To rotate its password set ADMIN_ROTATE_EXISTING=1 (sessions will be revoked).",
    };
  }

  if (otherAdmins > 0 && env.ADMIN_ALLOW_ADDITIONAL !== "1") {
    return {
      action: "refuse",
      code: "ADMIN_EXISTS",
      message: `${otherAdmins} approved admin account(s) already exist. Refusing to create another without ADMIN_ALLOW_ADDITIONAL=1.`,
    };
  }
  return { action: "create" };
}
