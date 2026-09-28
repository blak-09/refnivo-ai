import { Prisma, type ConnectionInitiator, type ConnectionStatus } from "@prisma/client";
import { prisma, transaction } from "@/lib/db/prisma";
import { recordAudit } from "./audit";
import { notify } from "./notify";

/**
 * Brand ↔ creator connections.
 *
 * A connection is a direct working relationship, separate from campaigns: either
 * side can ask, the other accepts or declines, and an accepted pair can then
 * collaborate. There is exactly ONE row per brand/creator pair (unique key), so
 * both sides asking at the same time can never produce two relationships — the
 * second request joins the existing one.
 *
 * Nothing here exposes private data: the lists return the same public profile
 * fields the marketplace already shows, plus the message the sender wrote.
 */
export class ConnectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConnectionError";
  }
}

export const CONNECTION_TABS = ["ALL", "INCOMING", "SENT", "ACCEPTED", "DECLINED"] as const;
export type ConnectionTab = (typeof CONNECTION_TABS)[number];

export const connectionSelect = {
  id: true,
  status: true,
  initiator: true,
  message: true,
  responseNote: true,
  createdAt: true,
  respondedAt: true,
  brand: { select: { id: true, name: true, slug: true, logoUrl: true, industry: true, tagline: true, verificationStatus: true } },
  creator: {
    select: {
      id: true,
      name: true,
      creatorProfile: { select: { displayName: true, username: true, profileImageUrl: true, category: true, bio: true, instagramFollowers: true, youtubeSubscribers: true } },
    },
  },
} satisfies Prisma.ConnectionSelect;

export type ConnectionRow = Prisma.ConnectionGetPayload<{ select: typeof connectionSelect }>;

/** Which side is looking, used to turn `initiator` into "incoming" or "sent". */
export type Viewer = { kind: "BRAND"; brandId: string } | { kind: "CREATOR"; creatorId: string };

function viewerWhere(viewer: Viewer): Prisma.ConnectionWhereInput {
  return viewer.kind === "BRAND" ? { brandId: viewer.brandId } : { creatorId: viewer.creatorId };
}

/** A PENDING row is "incoming" for whoever did NOT open it. */
export function isIncoming(row: { status: ConnectionStatus; initiator: ConnectionInitiator }, viewer: Viewer): boolean {
  return row.status === "PENDING" && row.initiator !== viewer.kind;
}

function tabWhere(tab: ConnectionTab, viewer: Viewer): Prisma.ConnectionWhereInput {
  const otherSide: ConnectionInitiator = viewer.kind === "BRAND" ? "CREATOR" : "BRAND";
  switch (tab) {
    case "INCOMING":
      return { status: "PENDING", initiator: otherSide };
    case "SENT":
      return { status: "PENDING", initiator: viewer.kind };
    case "ACCEPTED":
      return { status: "ACCEPTED" };
    case "DECLINED":
      return { status: { in: ["DECLINED", "BLOCKED"] } };
    default:
      return {};
  }
}

/** One page of connections for a dashboard tab (newest first). */
export async function listConnections(viewer: Viewer, tab: ConnectionTab = "ALL", opts: { take?: number; skip?: number } = {}) {
  const where = { ...viewerWhere(viewer), ...tabWhere(tab, viewer) };
  const take = Math.min(opts.take ?? 25, 100);
  const [rows, total] = await Promise.all([
    prisma.connection.findMany({ where, orderBy: { updatedAt: "desc" }, take: take + 1, skip: opts.skip ?? 0, select: connectionSelect }),
    prisma.connection.count({ where }),
  ]);
  return { rows: rows.slice(0, take), hasMore: rows.length > take, total };
}

/** Counts for the tab badges, in one round trip. */
export async function connectionCounts(viewer: Viewer): Promise<Record<ConnectionTab, number>> {
  const base = viewerWhere(viewer);
  const [all, incoming, sent, accepted, declined] = await Promise.all(
    CONNECTION_TABS.map((tab) => prisma.connection.count({ where: { ...base, ...tabWhere(tab, viewer) } })),
  );
  return { ALL: all, INCOMING: incoming, SENT: sent, ACCEPTED: accepted, DECLINED: declined };
}

/** The pair's current state, for the Connect button on a public profile. */
export async function connectionBetween(brandId: string, creatorId: string) {
  return prisma.connection.findUnique({ where: { brandId_creatorId: { brandId, creatorId } }, select: connectionSelect });
}

export type SendConnectionInput = {
  brandId: string;
  creatorId: string;
  initiator: ConnectionInitiator;
  /** The signed-in user, for audit and notification addressing. */
  actorId: string;
  message?: string | null;
};

/**
 * Opens (or re-opens) a connection request.
 *
 * Rules: a brand owner cannot connect to their own creator account; a declined
 * request may be sent again by the other side; a BLOCKED pair is final; an
 * already-accepted pair is a no-op rather than an error.
 */
export async function sendConnectionRequest(input: SendConnectionInput, now = new Date()): Promise<ConnectionRow> {
  const [brand, creator] = await Promise.all([
    prisma.brand.findUnique({ where: { id: input.brandId }, select: { id: true, name: true, ownerId: true, status: true } }),
    prisma.user.findUnique({ where: { id: input.creatorId }, select: { id: true, name: true, status: true, deletedAt: true, creatorProfile: { select: { displayName: true } } } }),
  ]);
  if (!brand || brand.status !== "ACTIVE") throw new ConnectionError("That brand is not available to connect with.");
  if (!creator || creator.deletedAt || creator.status !== "APPROVED" || !creator.creatorProfile) throw new ConnectionError("That creator is not available to connect with.");
  if (brand.ownerId === creator.id) throw new ConnectionError("You cannot connect a brand to its own owner.");

  const existing = await prisma.connection.findUnique({ where: { brandId_creatorId: { brandId: input.brandId, creatorId: input.creatorId } } });
  if (existing) {
    if (existing.status === "BLOCKED") throw new ConnectionError("This connection is blocked.");
    if (existing.status === "ACCEPTED") return connectionBetween(input.brandId, input.creatorId) as Promise<ConnectionRow>;
    if (existing.status === "PENDING") {
      if (existing.initiator === input.initiator) throw new ConnectionError("Your request is already waiting for a reply.");
      // The other side asked first: replying with a request of your own accepts theirs.
      return respondToConnection({ connectionId: existing.id, actorId: input.actorId, side: input.initiator, decision: "ACCEPT" }, now);
    }
  }

  const message = input.message?.trim() || null;
  const row = await transaction(async (tx) => {
    const created = existing
      ? await tx.connection.update({
          where: { id: existing.id },
          data: { initiator: input.initiator, status: "PENDING", message, responseNote: null, respondedAt: null },
          select: connectionSelect,
        })
      : await tx.connection.create({
          data: { brandId: input.brandId, creatorId: input.creatorId, initiator: input.initiator, status: "PENDING", message },
          select: connectionSelect,
        });

    const creatorName = creator.creatorProfile?.displayName ?? creator.name;
    const toCreator = input.initiator === "BRAND";
    await notify(
      {
        userId: toCreator ? creator.id : brand.ownerId,
        type: "CONNECTION_REQUESTED",
        idempotencyKey: `connection:${created.id}:${now.getTime()}`,
        title: toCreator ? `${brand.name} wants to connect` : `${creatorName} wants to connect`,
        body: message ? `“${message}”` : "Open your connections to accept or decline.",
        href: toCreator ? "/dashboard/creator/connections" : "/dashboard/brand/connections",
        email: true,
      },
      tx,
    );
    await recordAudit(
      { userId: input.actorId, action: "CONNECTION_REQUESTED", entityType: "Connection", entityId: created.id, metadata: { brandId: input.brandId, creatorId: input.creatorId, initiator: input.initiator } },
      tx,
    );
    return created;
  });
  return row;
}

export type RespondInput = {
  connectionId: string;
  actorId: string;
  /** Which side is answering — checked against `initiator` so nobody accepts their own request. */
  side: ConnectionInitiator;
  decision: "ACCEPT" | "DECLINE" | "BLOCK";
  note?: string | null;
};

export async function respondToConnection(input: RespondInput, now = new Date()): Promise<ConnectionRow> {
  return transaction(async (tx) => {
    const row = await tx.connection.findUnique({
      where: { id: input.connectionId },
      select: { id: true, status: true, initiator: true, brandId: true, creatorId: true, brand: { select: { name: true, ownerId: true } }, creator: { select: { name: true, creatorProfile: { select: { displayName: true } } } } },
    });
    if (!row) throw new ConnectionError("Connection not found.");
    if (input.decision !== "BLOCK") {
      if (row.status !== "PENDING") throw new ConnectionError("This request has already been answered.");
      if (row.initiator === input.side) throw new ConnectionError("You cannot answer your own request.");
    }

    const status: ConnectionStatus = input.decision === "ACCEPT" ? "ACCEPTED" : input.decision === "BLOCK" ? "BLOCKED" : "DECLINED";
    const updated = await tx.connection.update({
      where: { id: row.id },
      data: { status, responseNote: input.note?.trim() || null, respondedAt: now },
      select: connectionSelect,
    });

    if (input.decision === "ACCEPT") {
      // Tell whoever asked, not whoever answered.
      const notifyCreator = row.initiator === "CREATOR";
      const creatorName = row.creator.creatorProfile?.displayName ?? row.creator.name;
      await notify(
        {
          userId: notifyCreator ? row.creatorId : row.brand.ownerId,
          type: "CONNECTION_ACCEPTED",
          idempotencyKey: `connection:${row.id}:accepted`,
          title: notifyCreator ? `${row.brand.name} accepted your request` : `${creatorName} accepted your request`,
          body: "You can now work together on a collaboration.",
          href: notifyCreator ? "/dashboard/creator/connections" : "/dashboard/brand/connections",
          email: true,
        },
        tx,
      );
    }
    await recordAudit(
      { userId: input.actorId, action: `CONNECTION_${status}`, entityType: "Connection", entityId: row.id, metadata: { brandId: row.brandId, creatorId: row.creatorId, side: input.side } },
      tx,
    );
    return updated;
  });
}

/** Admin oversight: newest connections across the platform. */
export async function listAllConnections(status: ConnectionStatus | "ALL" = "ALL", take = 100) {
  return prisma.connection.findMany({
    where: status === "ALL" ? {} : { status },
    orderBy: { updatedAt: "desc" },
    take,
    select: connectionSelect,
  });
}

export async function countConnectionsByStatus(): Promise<Record<string, number>> {
  const rows = await prisma.connection.groupBy({ by: ["status"], _count: { _all: true } });
  return Object.fromEntries(rows.map((r) => [r.status, r._count._all]));
}
