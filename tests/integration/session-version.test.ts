import { describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import { isSessionCurrent } from "@/lib/auth/session-version";
import { recordAudit } from "@/lib/services/audit";
import { changePassword, revokeSessions, WrongPasswordError } from "@/lib/services/users";
import { makeCustomer } from "../helpers";

describe("session versioning (local test database)", () => {
  it("new users start at sessionVersion 1 with no forced rotation, so pre-versioning tokens stay valid", async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: (await makeCustomer()).id } });
    expect(user.sessionVersion).toBe(1);
    expect(user.mustChangePassword).toBe(false);
    expect(isSessionCurrent(undefined, user.sessionVersion)).toBe(true); // token issued before `sv` existed
    expect(isSessionCurrent(1, user.sessionVersion)).toBe(true);
  });

  it("changing the password bumps sessionVersion, invalidating every session, and clears mustChangePassword", async () => {
    const created = await makeCustomer();
    await prisma.user.update({ where: { id: created.id }, data: { mustChangePassword: true } });

    const updated = await changePassword(created.id, "Password1", "Brand-New-Pass-77");
    expect(updated.sessionVersion).toBe(2);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: created.id } });
    expect(user.mustChangePassword).toBe(false);
    expect(user.passwordChangedAt).not.toBeNull();
    expect(await bcrypt.compare("Brand-New-Pass-77", user.passwordHash ?? "")).toBe(true);
    expect(await bcrypt.compare("Password1", user.passwordHash ?? "")).toBe(false);

    // A token minted before the change (sv=1, or legacy without sv) is now stale; a fresh one (sv=2) is current.
    expect(isSessionCurrent(1, user.sessionVersion)).toBe(false);
    expect(isSessionCurrent(undefined, user.sessionVersion)).toBe(false);
    expect(isSessionCurrent(2, user.sessionVersion)).toBe(true);

    const audit = await prisma.auditLog.findFirst({ where: { action: "PASSWORD_CHANGED", entityId: created.id } });
    expect(audit?.actorRole).toBe("CUSTOMER");
    expect(JSON.stringify(audit?.metadata)).not.toContain("Brand-New-Pass-77");
  });

  it("rejects a wrong current password without touching the version", async () => {
    const created = await makeCustomer();
    await expect(changePassword(created.id, "wrong-password-1", "Brand-New-Pass-77")).rejects.toBeInstanceOf(WrongPasswordError);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: created.id } })).sessionVersion).toBe(1);
  });

  it("revokeSessions bumps the version without changing the password and audits the reason", async () => {
    const created = await makeCustomer();
    const before = await prisma.user.findUniqueOrThrow({ where: { id: created.id } });
    const r = await revokeSessions(created.id, null, "test-revocation");
    expect(r.sessionVersion).toBe(2);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: created.id } });
    expect(after.passwordHash).toBe(before.passwordHash);
    const audit = await prisma.auditLog.findFirst({ where: { action: "SESSIONS_REVOKED", entityId: created.id } });
    expect(audit?.metadata).toEqual({ reason: "test-revocation" });
  });

  it("recordAudit outside a request writes null context columns instead of failing", async () => {
    const created = await makeCustomer();
    await recordAudit({ userId: created.id, actorRole: "CUSTOMER", action: "TEST_CONTEXT", entityType: "User", entityId: created.id });
    const row = await prisma.auditLog.findFirstOrThrow({ where: { action: "TEST_CONTEXT", entityId: created.id } });
    expect(row.actorRole).toBe("CUSTOMER");
    expect(row.ipHash).toBeNull();
    expect(row.userAgent).toBeNull();
    expect(row.requestId).toBeNull();

    await recordAudit({ userId: created.id, action: "TEST_CONTEXT_EXPLICIT", entityType: "User", entityId: created.id, context: { ipHash: "abc", userAgent: "UA", requestId: "rid" } });
    const explicit = await prisma.auditLog.findFirstOrThrow({ where: { action: "TEST_CONTEXT_EXPLICIT", entityId: created.id } });
    expect(explicit).toMatchObject({ ipHash: "abc", userAgent: "UA", requestId: "rid" });
  });
});
