import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { createUser, changePassword, NoPasswordError, WrongPasswordError } from "@/lib/services/users";
import { resolveGoogleSignIn, userForGoogleAccount, type GoogleIdentity } from "@/lib/services/oauth";
import { uniq } from "../helpers";
import { requiredMigrationFromSource } from "../unit/required-migration.test";

function identity(overrides: Partial<GoogleIdentity> = {}): GoogleIdentity {
  const id = uniq("sub");
  return {
    providerAccountId: id,
    email: `${uniq("google")}@gmail.test`,
    emailVerified: true,
    name: "Google Person",
    picture: "https://lh3.googleusercontent.com/a/photo",
    ...overrides,
  };
}

describe("Google sign-in resolution", () => {
  const original = process.env.SIGNUP_APPROVAL;
  beforeEach(() => {
    process.env.SIGNUP_APPROVAL = "auto";
  });
  afterEach(() => {
    if (original === undefined) delete process.env.SIGNUP_APPROVAL;
    else process.env.SIGNUP_APPROVAL = original;
  });

  it("creates a new APPROVED, password-less account with the chosen role and links the Google id", async () => {
    const who = identity();
    const res = await resolveGoogleSignIn(who, "CREATOR");
    expect(res.kind).toBe("ok");
    if (res.kind !== "ok") return;
    expect(res.isNew).toBe(true);
    expect(res.user.role).toBe("CREATOR");
    expect(res.user.status).toBe("APPROVED");

    const row = await prisma.user.findUniqueOrThrow({ where: { id: res.user.id }, include: { oauthAccounts: true } });
    expect(row.passwordHash).toBeNull();
    expect(row.email).toBe(who.email.toLowerCase());
    expect(row.name).toBe("Google Person");
    expect(row.avatarUrl).toBe(who.picture);
    expect(row.approvedAt).not.toBeNull();
    expect(row.registrationId).toMatch(/^REF-/);
    expect(row.oauthAccounts).toHaveLength(1);
    expect(row.oauthAccounts[0]).toMatchObject({ provider: "google", providerAccountId: who.providerAccountId });

    const audit = await prisma.auditLog.findFirst({ where: { action: "USER_REGISTERED", entityId: res.user.id } });
    expect(JSON.stringify(audit?.metadata)).toContain('"provider":"google"');

    // The JWT callback resolves the same local user from the Google id.
    expect((await userForGoogleAccount(who.providerAccountId))?.id).toBe(res.user.id);
  });

  it("signs an already-linked account straight in and never creates a duplicate", async () => {
    const who = identity();
    const first = await resolveGoogleSignIn(who, "CUSTOMER");
    // Second visit: no role chosen (login page), different display name — still the same user.
    const again = await resolveGoogleSignIn({ ...who, name: "Renamed" }, null);
    expect(again.kind).toBe("ok");
    if (first.kind !== "ok" || again.kind !== "ok") return;
    expect(again.user.id).toBe(first.user.id);
    expect(again.isNew).toBe(false);
    expect(await prisma.user.count({ where: { email: who.email.toLowerCase() } })).toBe(1);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: first.user.id } })).name).toBe("Google Person");
  });

  it("links an existing password account with the same verified e-mail (no duplicate, password kept)", async () => {
    const email = `${uniq("existing")}@test.local`;
    const existing = await createUser({ name: "Existing", email, password: "Password1", role: "BRAND_OWNER" });
    const who = identity({ email: email.toUpperCase() });

    const res = await resolveGoogleSignIn(who, null);
    expect(res.kind).toBe("ok");
    if (res.kind !== "ok") return;
    expect(res.user.id).toBe(existing.id);
    expect(res.linked).toBe(true);
    expect(res.user.role).toBe("BRAND_OWNER");

    const row = await prisma.user.findUniqueOrThrow({ where: { id: existing.id }, include: { oauthAccounts: true } });
    expect(row.passwordHash).not.toBeNull();
    expect(row.oauthAccounts.map((a) => a.providerAccountId)).toEqual([who.providerAccountId]);
    expect(await prisma.auditLog.count({ where: { action: "OAUTH_ACCOUNT_LINKED", entityId: existing.id } })).toBe(1);
  });

  it("refuses to link or create when Google has not verified the e-mail", async () => {
    const email = `${uniq("unverified")}@test.local`;
    await createUser({ name: "Existing", email, password: "Password1", role: "CUSTOMER" });
    expect((await resolveGoogleSignIn(identity({ email, emailVerified: false }), null)).kind).toBe("email-unverified");
    expect((await resolveGoogleSignIn(identity({ emailVerified: false }), "CUSTOMER")).kind).toBe("email-unverified");
    expect(await prisma.oAuthAccount.count({ where: { email } })).toBe(0);
  });

  it("asks for a role when there is no account yet and none was chosen (login-page click)", async () => {
    const who = identity();
    expect((await resolveGoogleSignIn(who, null)).kind).toBe("no-account");
    expect(await prisma.user.count({ where: { email: who.email.toLowerCase() } })).toBe(0);
  });

  it("follows SIGNUP_APPROVAL: manual → PENDING account, no session", async () => {
    process.env.SIGNUP_APPROVAL = "manual";
    const who = identity();
    const res = await resolveGoogleSignIn(who, "BRAND_OWNER");
    expect(res.kind).toBe("pending");
    if (res.kind !== "pending") return;
    expect(res.user.status).toBe("PENDING");
    // A later attempt is blocked — still no duplicate.
    const again = await resolveGoogleSignIn(who, "BRAND_OWNER");
    expect(again).toMatchObject({ kind: "blocked", status: "PENDING" });
    expect(await prisma.user.count({ where: { email: who.email.toLowerCase() } })).toBe(1);
  });

  it("blocks suspended and rejected accounts", async () => {
    const who = identity();
    const res = await resolveGoogleSignIn(who, "CUSTOMER");
    if (res.kind !== "ok") throw new Error("expected ok");
    await prisma.user.update({ where: { id: res.user.id }, data: { status: "SUSPENDED" } });
    expect(await resolveGoogleSignIn(who, null)).toMatchObject({ kind: "blocked", status: "SUSPENDED" });
    await prisma.user.update({ where: { id: res.user.id }, data: { status: "REJECTED", rejectionReason: "nope" } });
    expect(await resolveGoogleSignIn(who, null)).toMatchObject({ kind: "blocked", status: "REJECTED" });
  });

  it("changePassword on a password-less account explains instead of comparing", async () => {
    const res = await resolveGoogleSignIn(identity(), "CUSTOMER");
    if (res.kind !== "ok") throw new Error("expected ok");
    await expect(changePassword(res.user.id, "anything", "NewPassword2")).rejects.toBeInstanceOf(NoPasswordError);
    await expect(changePassword(res.user.id, "anything", "NewPassword2")).rejects.toBeInstanceOf(WrongPasswordError);
  });
});

describe("schema currency probe (/api/health)", () => {
  // lib/db/health.ts is `server-only`; this mirrors its REQUIRED_MIGRATION query so the
  // constant can never point at a migration that does not exist in the repo.
  it("the migration the code requires is applied on a migrated database", async () => {
    const rows = await prisma.$queryRaw<{ n: number }[]>`
      SELECT COUNT(*)::int AS n FROM "_prisma_migrations"
      WHERE "migration_name" = ${requiredMigrationFromSource()} AND "finished_at" IS NOT NULL AND "rolled_back_at" IS NULL`;
    expect(Number(rows[0]?.n)).toBe(1);
  });
});
