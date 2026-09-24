import { describe, expect, it } from "vitest";
import { campaignVisibility, isCampaignLive } from "@/lib/domain/campaign-rules";

const NOW = new Date("2026-09-24T10:00:00Z");
const base = { status: "ACTIVE" as const, startDate: new Date("2026-09-01T00:00:00Z"), endDate: null as Date | null };

describe("campaignVisibility", () => {
  it("calls an in-window ACTIVE campaign live", () => {
    expect(campaignVisibility(base, NOW)).toMatchObject({ live: true, state: "LIVE", label: "Live", note: null });
    expect(campaignVisibility({ ...base, endDate: new Date("2026-10-01T00:00:00Z") }, NOW).live).toBe(true);
  });

  it("flags an ACTIVE campaign whose end date has passed — the marketplace hides it, so the dashboard must not just say Active", () => {
    const expired = { ...base, endDate: new Date("2026-09-20T00:00:00Z") };
    const v = campaignVisibility(expired, NOW);
    expect(v).toMatchObject({ live: false, state: "EXPIRED", label: "Ended" });
    expect(v.note).toMatch(/end date/i);
    // Matches what the public pages do with the same row.
    expect(isCampaignLive(expired, NOW)).toBe(false);
  });

  it("flags an ACTIVE campaign that has not started yet", () => {
    const v = campaignVisibility({ ...base, startDate: new Date("2026-10-05T00:00:00Z") }, NOW);
    expect(v).toMatchObject({ live: false, state: "SCHEDULED", label: "Scheduled" });
  });

  it("defers to the status label for every other status", () => {
    for (const status of ["DRAFT", "PAUSED", "ENDED", "ARCHIVED", "PENDING_REVIEW"] as const) {
      expect(campaignVisibility({ ...base, status }, NOW)).toEqual({ live: false, state: "OTHER", label: null, note: null });
    }
  });
});
