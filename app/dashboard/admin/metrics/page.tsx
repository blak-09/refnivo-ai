import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard, PageHeader } from "@/components/dashboard/primitives";
import { requireRole } from "@/lib/auth/guards";
import { getPlatformMetrics, type Rate } from "@/lib/services/platform-metrics";

export const metadata: Metadata = { title: "Metrics" };

function pct(r: Rate) {
  return r.value === null ? "No data yet" : `${(r.value * 100).toFixed(r.value < 0.1 ? 1 : 0)}%`;
}
function counts(r: Rate) {
  return `${r.numerator.toLocaleString("en-IN")} of ${r.denominator.toLocaleString("en-IN")}`;
}

export default async function AdminMetricsPage() {
  await requireRole("ADMIN");
  const m = await getPlatformMetrics();
  const groups: { title: string; description: string; items: { label: string; rate?: Rate; value?: string; hint: string }[] }[] = [
    {
      title: "Activation",
      description: "Do new accounts get to the point where the product works for them?",
      items: [
        { label: "Brand signup completion", rate: m.brandSignupCompletion, hint: "Brand accounts with a completed brand profile" },
        { label: "Creator signup completion", rate: m.creatorSignupCompletion, hint: "Creator accounts with a completed profile" },
        { label: "Campaign activation", rate: m.campaignActivation, hint: "Launched ≥ 14 days ago with an approved partner and a click within 14 days" },
        { label: "Referral link usage (30 days)", rate: m.linkUsage30d, hint: "Active links older than 30 days with a click in the last 30" },
      ],
    },
    {
      title: "Orders & trust",
      description: "Are orders being recorded, decided and paid fairly? (last 90 days unless noted)",
      items: [
        { label: "Verified order rate", rate: m.verifiedOrderRate, hint: "Verified (incl. later refunded) of all decided orders" },
        { label: "Median time to verify", value: m.medianHoursToVerify === null ? "No data yet" : m.medianHoursToVerify < 48 ? `${m.medianHoursToVerify.toFixed(1)} h` : `${(m.medianHoursToVerify / 24).toFixed(1)} days`, hint: "From recording to verification" },
        { label: "Claim response within 7 days", rate: m.claimResponse7d, hint: "Buyer order claims the brand confirmed or rejected within a week" },
        { label: "Contest rate (all time)", rate: m.contestRate, hint: "Orders contested by a partner, per verified order" },
        { label: "Reversed after payout (all time)", rate: m.paidThenReversed, hint: "Commissions reversed after being included in a payout" },
        { label: "Orders waiting > 7 days", value: m.stalePurchased7d.toLocaleString("en-IN"), hint: "Recorded but not yet verified or rejected" },
        { label: "Claims waiting > 7 days", value: m.staleClaims7d.toLocaleString("en-IN"), hint: "Buyer claims the brand has not answered" },
      ],
    },
    {
      title: "Retention & revenue",
      description: "Do brands keep using Refnivo, and do they pay?",
      items: [
        { label: "Brand retention (30 days)", rate: m.brandRetention, hint: "Brands active in the previous 30 days that were active again in the last 30" },
        { label: "Plan conversion", rate: m.planConversion, hint: "Brands that used the free launches and then bought a plan" },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Metrics"
        description="Computed live from database rows; nothing is estimated. Steps that need page-view events (wizard drop-off, campaign views) are not recorded by the app, so they are not shown."
      />
      {groups.map((g) => (
        <Card key={g.title}>
          <CardHeader>
            <CardTitle>{g.title}</CardTitle>
            <CardDescription>{g.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              {g.items.map((i) => (
                <KpiCard key={i.label} label={i.label} value={i.rate ? pct(i.rate) : i.value} hint={i.rate ? `${counts(i.rate)} · ${i.hint}` : i.hint} />
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
