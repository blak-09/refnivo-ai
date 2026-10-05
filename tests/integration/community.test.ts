import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { COMMUNITY_EVENTS, COMMUNITY_INVITE_URL, COMMUNITY_INVITES } from "@/lib/config/community";
import { communityClickSummary, parseCommunityClick, recordCommunityClick } from "@/lib/services/community";

afterAll(() => prisma.$disconnect());

describe("Refnivo Network config", () => {
  it("both circles use the one real WhatsApp invite (no invented per-circle links)", () => {
    expect(COMMUNITY_INVITE_URL).toBe("https://chat.whatsapp.com/JQ81NKeg6LpHWpvn7sawAe");
    expect(new Set(Object.values(COMMUNITY_INVITES))).toEqual(new Set([COMMUNITY_INVITE_URL]));
  });

  it("uses the agreed analytics event names", () => {
    expect(COMMUNITY_EVENTS).toEqual({ CREATOR: "creator_community_join_click", BRAND: "brand_community_join_click", GENERAL: "community_join_click" });
  });
});

describe("community click tracking", () => {
  it("accepts only known circles and placements", () => {
    expect(parseCommunityClick({ audience: "CREATOR", placement: "home-band" })).toEqual({ audience: "CREATOR", placement: "home-band" });
    expect(parseCommunityClick({ audience: "ADMIN", placement: "home-band" })).toBeNull();
    expect(parseCommunityClick({ audience: "BRAND", placement: "somewhere-else" })).toBeNull();
    expect(parseCommunityClick({ audience: "BRAND" })).toBeNull();
    expect(parseCommunityClick("CREATOR")).toBeNull();
    expect(parseCommunityClick(null)).toBeNull();
  });

  it("counts clicks per circle within the window and ranks placements", async () => {
    // Far-future window so rows from other tests or runs cannot leak in.
    const now = new Date("2099-06-30T12:00:00Z");
    const at = (daysAgo: number) => new Date(now.getTime() - daysAgo * 86_400_000);
    await prisma.communityClick.createMany({
      data: [
        { audience: "CREATOR", placement: "community-page", createdAt: at(1) },
        { audience: "CREATOR", placement: "community-page", createdAt: at(2) },
        { audience: "CREATOR", placement: "campaigns", createdAt: at(3) },
        { audience: "BRAND", placement: "creators", createdAt: at(4) },
        { audience: "GENERAL", placement: "home-band", createdAt: at(5) },
        { audience: "BRAND", placement: "creators", createdAt: at(40) }, // outside the 30-day window
      ],
    });
    const summary = await communityClickSummary(30, now);
    expect(summary).toMatchObject({ days: 30, creator: 3, brand: 1, general: 1, total: 5 });
    expect(summary.topPlacements[0]).toEqual({ placement: "community-page", clicks: 2 });
    await prisma.communityClick.deleteMany({ where: { createdAt: { gte: at(60) } } });
  });

  it("stores no personal data — only circle, placement and an optional role", async () => {
    await recordCommunityClick({ audience: "BRAND", placement: "brand-dashboard", role: "BRAND_OWNER" });
    const row = await prisma.communityClick.findFirstOrThrow({ where: { placement: "brand-dashboard" }, orderBy: { createdAt: "desc" } });
    expect(Object.keys(row).sort()).toEqual(["audience", "createdAt", "id", "placement", "role"]);
    expect(row.role).toBe("BRAND_OWNER");
  });
});
