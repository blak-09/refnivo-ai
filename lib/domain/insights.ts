import { formatMoney } from "@/lib/money";
import type { BrandOverview, CampaignBreakdownRow } from "@/lib/services/metrics";

export type Insight = { text: string; recommendation: string | null; sufficient: boolean };

const NOT_ENOUGH: Insight = {
  text: "Not enough data to generate a reliable insight.",
  recommendation:
    "Insights appear once your campaigns have at least 10 link clicks and a few verified orders. Publish a campaign and approve creators to get started.",
  sufficient: false,
};

/**
 * Deterministic, rule-based insight computed from real metrics. The AI phase
 * layers natural-language explanation on top of this — it never adds numbers.
 */
export function buildInsight(overview: BrandOverview, breakdown: CampaignBreakdownRow[]): Insight {
  if (overview.totalClicks < 10 && overview.verifiedConversions < 3) return NOT_ENOUGH;

  const ranked = [...breakdown].filter((b) => b.verified > 0).sort((a, b) => b.verified - a.verified);

  if (ranked.length >= 2) {
    const [top, next] = ranked;
    return {
      text: `"${top.name}" (${top.productName}) generated ${top.verified} verified orders versus ${next.verified} for "${next.name}" (${formatMoney(top.revenue)} vs ${formatMoney(next.revenue)} attributed revenue).`,
      recommendation: `Consider extending "${top.name}" or raising its commission slightly — it is currently your best-converting product campaign.`,
      sufficient: true,
    };
  }

  if (ranked.length === 1) {
    const only = ranked[0];
    const rate = only.clicks > 0 ? ((only.verified / only.clicks) * 100).toFixed(1) : null;
    return {
      text: `"${only.name}" has ${only.verified} verified orders from ${only.clicks} link clicks${rate !== null ? ` (${rate}% click-to-order)` : ""}.`,
      recommendation:
        overview.pendingVerification > 0
          ? `${overview.pendingVerification} order${overview.pendingVerification === 1 ? "" : "s"} are waiting for verification — verifying promptly keeps creators motivated.`
          : "Run a second campaign on another product to compare which offers convert best for your audience.",
      sufficient: true,
    };
  }

  if (overview.totalClicks >= 10) {
    return {
      text: `Your links have ${overview.totalClicks} clicks and ${overview.totalOrders} recorded orders, but none have been verified yet.`,
      recommendation: "Record orders that carry a referral code under Orders & Conversions, then verify them to release commissions.",
      sufficient: true,
    };
  }

  return NOT_ENOUGH;
}
