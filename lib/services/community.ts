import { prisma } from "@/lib/db/prisma";
import { COMMUNITY_AUDIENCES, COMMUNITY_PLACEMENTS, type CommunityAudience, type CommunityPlacement } from "@/lib/config/community";

/**
 * Refnivo Network join-click counts. A click is recorded the moment someone
 * taps a "Join … community" CTA (before WhatsApp opens), so these are interest
 * signals, not confirmed members — WhatsApp does not tell us who actually joined.
 */
export function parseCommunityClick(raw: unknown): { audience: CommunityAudience; placement: CommunityPlacement } | null {
  if (!raw || typeof raw !== "object") return null;
  const { audience, placement } = raw as Record<string, unknown>;
  if (typeof audience !== "string" || !(COMMUNITY_AUDIENCES as readonly string[]).includes(audience)) return null;
  if (typeof placement !== "string" || !(COMMUNITY_PLACEMENTS as readonly string[]).includes(placement)) return null;
  return { audience: audience as CommunityAudience, placement: placement as CommunityPlacement };
}

export async function recordCommunityClick(input: { audience: CommunityAudience; placement: CommunityPlacement; role: string | null }) {
  await prisma.communityClick.create({ data: input });
}

/** Admin overview: clicks per circle and top placements over the last `days` days. */
export async function communityClickSummary(days = 30, now = new Date()) {
  const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const [byAudience, byPlacement] = await Promise.all([
    prisma.communityClick.groupBy({ by: ["audience"], where: { createdAt: { gte: since } }, _count: { _all: true } }),
    prisma.communityClick.groupBy({ by: ["placement"], where: { createdAt: { gte: since } }, _count: { _all: true }, orderBy: { _count: { placement: "desc" } }, take: 3 }),
  ]);
  const count = (a: CommunityAudience) => byAudience.find((r) => r.audience === a)?._count._all ?? 0;
  const creator = count("CREATOR");
  const brand = count("BRAND");
  const general = count("GENERAL");
  return {
    days,
    creator,
    brand,
    general,
    total: creator + brand + general,
    topPlacements: byPlacement.map((p) => ({ placement: p.placement, clicks: p._count._all })),
  };
}
