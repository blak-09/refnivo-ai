import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma, transaction } from "@/lib/db/prisma";
import { enqueueEmail } from "@/lib/email/outbox";
import { recordAudit } from "./audit";

/**
 * Password reset by e-mail.
 *
 *  - The raw token (32 random bytes, base64url) is only ever in the e-mail link;
 *    the database stores its SHA-256, so a leaked table cannot reset passwords.
 *  - Tokens expire after RESET_TOKEN_TTL_MS and are single-use.
 *  - Requesting a reset always returns the same result whether or not the
 *    e-mail exists (no account enumeration). Callers rate-limit by IP.
 *  - A successful reset bumps `sessionVersion`, signing out every session.
 */
export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newResetToken(): string {
  return randomBytes(32).toString("base64url");
}

function appUrl(path: string): string {
  return `${(process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "")}${path}`;
}

/**
 * Creates a token for the account (if it exists and may sign in) and e-mails
 * the link. Returns nothing that reveals whether the account exists.
 */
export async function requestPasswordReset(email: string, now = new Date()): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { id: true, name: true, email: true, status: true },
  });
  // Pending/rejected accounts cannot sign in anyway; suspended accounts must contact support.
  if (!user || user.status !== "APPROVED") return;

  const token = newResetToken();
  const link = appUrl(`/auth/reset-password?token=${encodeURIComponent(token)}`);
  // Token row and its e-mail are written atomically; the e-mail leaves only after commit.
  // A security e-mail: it deliberately ignores the notification opt-out.
  await transaction(async (tx) => {
    // One live token per user: invalidate earlier unused ones.
    await tx.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: now } });
    const row = await tx.passwordResetToken.create({
      data: { userId: user.id, tokenHash: hashResetToken(token), expiresAt: new Date(now.getTime() + RESET_TOKEN_TTL_MS) },
      select: { id: true },
    });
    await enqueueEmail(tx, {
      idempotencyKey: `password-reset:${row.id}`,
      userId: user.id,
      to: user.email,
      subject: "Reset your Refnivo AI password",
      text: [
        `Hi ${user.name},`,
        "",
        "We received a request to reset your password. Open the link below within one hour to choose a new one:",
        link,
        "",
        "If you did not request this, you can ignore this e-mail — your password will not change.",
        "",
        "— Refnivo AI",
      ].join("\n"),
    });
    await recordAudit({ userId: user.id, action: "PASSWORD_RESET_REQUESTED", entityType: "User", entityId: user.id }, tx);
  });
}

export class ResetTokenError extends Error {
  constructor(message = "This reset link is invalid or has expired. Request a new one.") {
    super(message);
    this.name = "ResetTokenError";
  }
}

/** Validates a raw token without consuming it (used to render the form). */
export async function peekResetToken(token: string, now = new Date()): Promise<boolean> {
  if (!token) return false;
  const row = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashResetToken(token) }, select: { usedAt: true, expiresAt: true } });
  return !!row && !row.usedAt && row.expiresAt > now;
}

/** Consumes the token, sets the new password and revokes every session. */
export async function resetPasswordWithToken(token: string, newPassword: string, now = new Date()): Promise<{ userId: string }> {
  const passwordHash = await bcrypt.hash(newPassword, 12);
  return transaction(async (tx) => {
    const row = await tx.passwordResetToken.findUnique({
      where: { tokenHash: hashResetToken(token) },
      select: { id: true, userId: true, usedAt: true, expiresAt: true, user: { select: { status: true, role: true } } },
    });
    if (!row || row.usedAt || row.expiresAt <= now) throw new ResetTokenError();
    if (row.user.status !== "APPROVED") throw new ResetTokenError("This account cannot sign in. Please contact support.");

    // Single-use: claim the token atomically (a concurrent request loses).
    const claimed = await tx.passwordResetToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: now } });
    if (claimed.count !== 1) throw new ResetTokenError();

    await tx.user.update({
      where: { id: row.userId },
      data: { passwordHash, passwordChangedAt: now, mustChangePassword: false, sessionVersion: { increment: 1 } },
    });
    await recordAudit(
      { userId: row.userId, actorRole: row.user.role, action: "PASSWORD_RESET_COMPLETED", entityType: "User", entityId: row.userId, metadata: { sessionsRevoked: true } },
      tx,
    );
    return { userId: row.userId };
  });
}
