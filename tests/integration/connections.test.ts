import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import {
  connectionBetween,
  connectionCounts,
  ConnectionError,
  isIncoming,
  listConnections,
  respondToConnection,
  sendConnectionRequest,
} from "@/lib/services/connections";
import { makeCreator, makeOwnerWithBrand, uniq } from "../helpers";

/**
 * Brand ↔ creator connections: one relationship per pair, whichever side asks,
 * and only the side that did NOT ask may answer.
 */
/** Creators are only discoverable (and connectable) once approved, as in production. */
async function approvedCreator() {
  const creator = await makeCreator();
  await prisma.user.update({ where: { id: creator.id }, data: { status: "APPROVED" } });
  return creator;
}

async function pair() {
  const owner = await makeOwnerWithBrand(`Connect ${uniq("b")}`);
  const creator = await approvedCreator();
  return { owner, creator, brandId: owner.brand.id, creatorId: creator.id, ownerId: owner.user.id };
}

afterAll(() => prisma.$disconnect());

describe("sending requests", () => {
  it("a brand's request lands in the creator's incoming tab, not its own", async () => {
    const p = await pair();
    const row = await sendConnectionRequest({ brandId: p.brandId, creatorId: p.creatorId, initiator: "BRAND", actorId: p.ownerId, message: "Love your tech content." });
    expect(row).toMatchObject({ status: "PENDING", initiator: "BRAND", message: "Love your tech content." });

    const creatorView = { kind: "CREATOR", creatorId: p.creatorId } as const;
    const brandView = { kind: "BRAND", brandId: p.brandId } as const;
    expect(isIncoming(row, creatorView)).toBe(true);
    expect(isIncoming(row, brandView)).toBe(false);
    expect(await connectionCounts(creatorView)).toMatchObject({ INCOMING: 1, SENT: 0 });
    expect(await connectionCounts(brandView)).toMatchObject({ INCOMING: 0, SENT: 1 });
    // The creator was told.
    expect(await prisma.notification.count({ where: { userId: p.creatorId, type: "CONNECTION_REQUESTED" } })).toBe(1);
  });

  it("keeps one relationship per pair and refuses a second identical request", async () => {
    const p = await pair();
    await sendConnectionRequest({ brandId: p.brandId, creatorId: p.creatorId, initiator: "BRAND", actorId: p.ownerId });
    await expect(sendConnectionRequest({ brandId: p.brandId, creatorId: p.creatorId, initiator: "BRAND", actorId: p.ownerId })).rejects.toThrow(/already waiting/i);
    expect(await prisma.connection.count({ where: { brandId: p.brandId, creatorId: p.creatorId } })).toBe(1);
  });

  it("treats a request from the other side as an acceptance rather than a second row", async () => {
    const p = await pair();
    await sendConnectionRequest({ brandId: p.brandId, creatorId: p.creatorId, initiator: "BRAND", actorId: p.ownerId });
    const result = await sendConnectionRequest({ brandId: p.brandId, creatorId: p.creatorId, initiator: "CREATOR", actorId: p.creatorId });
    expect(result.status).toBe("ACCEPTED");
    expect(await prisma.connection.count({ where: { brandId: p.brandId, creatorId: p.creatorId } })).toBe(1);
  });

  it("refuses unavailable counterparties and self-connection", async () => {
    const p = await pair();
    await expect(sendConnectionRequest({ brandId: "nope", creatorId: p.creatorId, initiator: "BRAND", actorId: p.ownerId })).rejects.toBeInstanceOf(ConnectionError);
    await expect(sendConnectionRequest({ brandId: p.brandId, creatorId: "nope", initiator: "BRAND", actorId: p.ownerId })).rejects.toBeInstanceOf(ConnectionError);

    // A suspended creator is not connectable.
    const suspended = await approvedCreator();
    await prisma.user.update({ where: { id: suspended.id }, data: { status: "SUSPENDED" } });
    await expect(sendConnectionRequest({ brandId: p.brandId, creatorId: suspended.id, initiator: "BRAND", actorId: p.ownerId })).rejects.toThrow(/not available/i);

    // A brand owner cannot connect their brand to their own account.
    await expect(sendConnectionRequest({ brandId: p.brandId, creatorId: p.ownerId, initiator: "BRAND", actorId: p.ownerId })).rejects.toBeInstanceOf(ConnectionError);
  });
});

describe("responding", () => {
  it("accepting notifies the requester and moves the pair to Accepted for both sides", async () => {
    const p = await pair();
    const row = await sendConnectionRequest({ brandId: p.brandId, creatorId: p.creatorId, initiator: "BRAND", actorId: p.ownerId });
    const accepted = await respondToConnection({ connectionId: row.id, actorId: p.creatorId, side: "CREATOR", decision: "ACCEPT" });
    expect(accepted.status).toBe("ACCEPTED");
    expect(accepted.respondedAt).toBeTruthy();
    // The brand owner — who asked — is the one told.
    expect(await prisma.notification.count({ where: { userId: p.ownerId, type: "CONNECTION_ACCEPTED" } })).toBe(1);
    expect(await prisma.notification.count({ where: { userId: p.creatorId, type: "CONNECTION_ACCEPTED" } })).toBe(0);

    for (const viewer of [{ kind: "BRAND", brandId: p.brandId } as const, { kind: "CREATOR", creatorId: p.creatorId } as const]) {
      const { rows } = await listConnections(viewer, "ACCEPTED");
      expect(rows.map((r) => r.id)).toContain(row.id);
    }
  });

  it("refuses to let the requester answer their own request, or answer twice", async () => {
    const p = await pair();
    const row = await sendConnectionRequest({ brandId: p.brandId, creatorId: p.creatorId, initiator: "BRAND", actorId: p.ownerId });
    await expect(respondToConnection({ connectionId: row.id, actorId: p.ownerId, side: "BRAND", decision: "ACCEPT" })).rejects.toThrow(/your own request/i);

    await respondToConnection({ connectionId: row.id, actorId: p.creatorId, side: "CREATOR", decision: "DECLINE", note: "Not a fit right now" });
    await expect(respondToConnection({ connectionId: row.id, actorId: p.creatorId, side: "CREATOR", decision: "ACCEPT" })).rejects.toThrow(/already been answered/i);
    expect((await connectionBetween(p.brandId, p.creatorId))!.responseNote).toBe("Not a fit right now");
  });

  it("lets the other side ask again after a decline, but never after a block", async () => {
    const p = await pair();
    const row = await sendConnectionRequest({ brandId: p.brandId, creatorId: p.creatorId, initiator: "BRAND", actorId: p.ownerId });
    await respondToConnection({ connectionId: row.id, actorId: p.creatorId, side: "CREATOR", decision: "DECLINE" });

    const again = await sendConnectionRequest({ brandId: p.brandId, creatorId: p.creatorId, initiator: "CREATOR", actorId: p.creatorId, message: "Changed my mind" });
    expect(again).toMatchObject({ status: "PENDING", initiator: "CREATOR", message: "Changed my mind" });

    await respondToConnection({ connectionId: row.id, actorId: p.ownerId, side: "BRAND", decision: "BLOCK" });
    await expect(sendConnectionRequest({ brandId: p.brandId, creatorId: p.creatorId, initiator: "CREATOR", actorId: p.creatorId })).rejects.toThrow(/blocked/i);
  });
});

describe("isolation", () => {
  it("never shows one brand's connections to another brand, or one creator's to another", async () => {
    const a = await pair();
    const b = await pair();
    await sendConnectionRequest({ brandId: a.brandId, creatorId: a.creatorId, initiator: "BRAND", actorId: a.ownerId });

    const otherBrand = await listConnections({ kind: "BRAND", brandId: b.brandId }, "ALL");
    expect(otherBrand.rows).toHaveLength(0);
    const otherCreator = await listConnections({ kind: "CREATOR", creatorId: b.creatorId }, "ALL");
    expect(otherCreator.rows).toHaveLength(0);
    expect(await connectionBetween(b.brandId, a.creatorId)).toBeNull();
  });

  it("paginates instead of returning everything", async () => {
    const owner = await makeOwnerWithBrand(`Paging ${uniq("b")}`);
    for (let i = 0; i < 3; i++) {
      const creator = await approvedCreator();
      await sendConnectionRequest({ brandId: owner.brand.id, creatorId: creator.id, initiator: "BRAND", actorId: owner.user.id });
    }
    const page = await listConnections({ kind: "BRAND", brandId: owner.brand.id }, "ALL", { take: 2 });
    expect(page.rows).toHaveLength(2);
    expect(page.hasMore).toBe(true);
    expect(page.total).toBe(3);
    const last = await listConnections({ kind: "BRAND", brandId: owner.brand.id }, "ALL", { take: 2, skip: 2 });
    expect(last.rows).toHaveLength(1);
    expect(last.hasMore).toBe(false);
  });
});
