import { describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import { applyBootstrap } from "../../scripts/lib/admin-bootstrap-apply";
import { makeCustomer, uniq } from "../helpers";

const PASSWORD = "Bootstrap-Pass-2026-x";

async function hash() {
  return bcrypt.hash(PASSWORD, 4); // low cost: test speed only
}

describe("admin bootstrap (local test database)", () => {
  it("creates a single admin with mustChangePassword=true, sessionVersion=1 and an audit row without secrets", async () => {
    const email = `${uniq("boot")}@company.test`;
    const result = await applyBootstrap(prisma, { email, name: "Ops", passwordHash: await hash(), env: { ADMIN_ALLOW_ADDITIONAL: "1" } });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.action).toBe("create");

    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.role).toBe("ADMIN");
    expect(user.status).toBe("APPROVED");
    expect(user.mustChangePassword).toBe(true);
    expect(user.sessionVersion).toBe(1);
    expect(user.approvedAt).not.toBeNull();
    expect(await bcrypt.compare(PASSWORD, user.passwordHash)).toBe(true);

    const audit = await prisma.auditLog.findFirst({ where: { action: "ADMIN_BOOTSTRAPPED", entityId: user.id } });
    expect(audit).not.toBeNull();
    const meta = JSON.stringify(audit?.metadata);
    expect(meta).not.toContain(PASSWORD);
    expect(meta).not.toContain(user.passwordHash);
    expect(meta).toContain('"mustChangePassword":true');
  });

  it("refuses to create a second admin by default and records the refusal", async () => {
    const email = `${uniq("second")}@company.test`;
    const result = await applyBootstrap(prisma, { email, name: "Second", passwordHash: await hash(), env: {} });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.decision.code).toBe("ADMIN_EXISTS");
    expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
    expect(await prisma.auditLog.count({ where: { action: "ADMIN_BOOTSTRAP_REFUSED" } })).toBeGreaterThan(0);
  });

  it("never promotes or overwrites an existing non-admin account, even with rotation enabled", async () => {
    const customer = await makeCustomer();
    const before = await prisma.user.findUniqueOrThrow({ where: { id: customer.id } });
    const result = await applyBootstrap(prisma, {
      email: customer.email,
      name: "Attacker",
      passwordHash: await hash(),
      env: { ADMIN_ROTATE_EXISTING: "1", ADMIN_ALLOW_ADDITIONAL: "1" },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.decision.code).toBe("EMAIL_EXISTS_NOT_ADMIN");
    const after = await prisma.user.findUniqueOrThrow({ where: { id: customer.id } });
    expect(after.role).toBe("CUSTOMER");
    expect(after.passwordHash).toBe(before.passwordHash);
    expect(after.name).toBe(before.name);
    expect(after.sessionVersion).toBe(before.sessionVersion);
  });

  it("refuses an existing admin email by default; rotates (bumping sessionVersion) only with ADMIN_ROTATE_EXISTING=1", async () => {
    const email = `${uniq("rotate")}@company.test`;
    const created = await applyBootstrap(prisma, { email, name: "Ops", passwordHash: await hash(), env: { ADMIN_ALLOW_ADDITIONAL: "1" } });
    expect(created.ok).toBe(true);
    // Simulate the admin having completed the first rotation.
    await prisma.user.update({ where: { email }, data: { mustChangePassword: false, sessionVersion: 2 } });

    const refused = await applyBootstrap(prisma, { email, name: "Ops", passwordHash: await hash(), env: { ADMIN_ALLOW_ADDITIONAL: "1" } });
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.decision.code).toBe("EMAIL_EXISTS");

    const newHash = await bcrypt.hash("Another-Strong-Pass-99", 4);
    const rotated = await applyBootstrap(prisma, { email, name: "Ops", passwordHash: newHash, env: { ADMIN_ROTATE_EXISTING: "1", ADMIN_ALLOW_ADDITIONAL: "1" } });
    expect(rotated.ok).toBe(true);
    if (rotated.ok) expect(rotated.action).toBe("rotate");
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.role).toBe("ADMIN");
    expect(user.passwordHash).toBe(newHash);
    expect(user.sessionVersion).toBe(3); // every existing session invalidated
    expect(user.mustChangePassword).toBe(true);
  });
});
