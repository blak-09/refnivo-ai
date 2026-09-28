import type { ConnectState } from "@/components/connections/connect-button";
import { getCurrentUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { connectionBetween } from "./connections";

/**
 * What the Connect button on a public profile should show for whoever is
 * looking. Returns UNAVAILABLE (the button renders nothing) for signed-out
 * visitors, the wrong role, an incomplete profile, or your own page — so a
 * visitor is never offered an action that would be refused.
 */
export async function connectStateForCreator(creatorUserId: string): Promise<{ state: ConnectState }> {
  const viewer = await getCurrentUser();
  if (!viewer || viewer.role !== "BRAND_OWNER" || viewer.id === creatorUserId) return { state: "UNAVAILABLE" };
  const brand = await prisma.brand.findFirst({ where: { ownerId: viewer.id, status: "ACTIVE" }, select: { id: true } });
  if (!brand) return { state: "UNAVAILABLE" };
  const row = await connectionBetween(brand.id, creatorUserId);
  return { state: toState(row, "BRAND") };
}

export async function connectStateForBrand(brandId: string): Promise<{ state: ConnectState }> {
  const viewer = await getCurrentUser();
  if (!viewer || viewer.role !== "CREATOR") return { state: "UNAVAILABLE" };
  const profile = await prisma.creatorProfile.findUnique({ where: { userId: viewer.id }, select: { id: true } });
  if (!profile) return { state: "UNAVAILABLE" };
  const owns = await prisma.brand.findFirst({ where: { id: brandId, ownerId: viewer.id }, select: { id: true } });
  if (owns) return { state: "UNAVAILABLE" };
  const row = await connectionBetween(brandId, viewer.id);
  return { state: toState(row, "CREATOR") };
}

function toState(row: { status: string; initiator: string } | null, side: "BRAND" | "CREATOR"): ConnectState {
  if (!row) return "NONE";
  if (row.status === "ACCEPTED") return "ACCEPTED";
  if (row.status === "BLOCKED") return "BLOCKED";
  if (row.status === "PENDING") return row.initiator === side ? "PENDING_SENT" : "PENDING_INCOMING";
  return "NONE"; // declined: either side may ask again
}
