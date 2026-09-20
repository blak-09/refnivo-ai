import type { Campaign } from "@prisma/client";
import { formatMoney, formatPercent } from "@/lib/money";
import { formatDate } from "@/lib/utils/dates";
import { CAMPAIGN_TYPE_LABEL, COMMISSION_TYPE_LABEL, REWARD_TYPE_LABEL } from "@/lib/utils/labels";

export type CampaignRuleFields = Pick<
  Campaign,
  | "rewardType"
  | "customerRewardValue"
  | "creatorCommissionType"
  | "creatorCommissionValue"
  | "currency"
  | "minimumPurchaseAmount"
  | "newCustomerOnly"
  | "maxRewardPerCustomer"
  | "attributionWindowDays"
  | "budget"
  | "startDate"
  | "endDate"
  | "campaignType"
  | "requiresApproval"
>;

export function describeCustomerReward(c: Pick<CampaignRuleFields, "rewardType" | "customerRewardValue" | "currency" | "campaignType">): string {
  if (c.campaignType === "CREATOR_AFFILIATE") return "Not applicable (creator-only campaign)";
  if (c.rewardType === "PERCENTAGE") return `${formatPercent(c.customerRewardValue)} of the order value`;
  const amount = formatMoney(c.customerRewardValue, c.currency);
  if (c.rewardType === "VOUCHER") return `${amount} voucher`;
  if (c.rewardType === "DISCOUNT") return `${amount} discount`;
  return `${amount} per verified order`;
}

export function describeCreatorCommission(
  c: Pick<CampaignRuleFields, "creatorCommissionType" | "creatorCommissionValue" | "currency" | "campaignType">,
): string {
  if (c.campaignType === "CUSTOMER_REFERRAL") return "Not applicable (customer-only campaign)";
  if (c.creatorCommissionType === "PERCENTAGE") return `${formatPercent(c.creatorCommissionValue)} of the order value`;
  return `${formatMoney(c.creatorCommissionValue, c.currency)} per verified order`;
}

/** Short form for cards: "10%" or "₹150". */
export function shortCommission(c: Pick<CampaignRuleFields, "creatorCommissionType" | "creatorCommissionValue" | "currency">): string {
  return c.creatorCommissionType === "PERCENTAGE" ? formatPercent(c.creatorCommissionValue) : formatMoney(c.creatorCommissionValue, c.currency);
}

export function shortReward(c: Pick<CampaignRuleFields, "rewardType" | "customerRewardValue" | "currency">): string {
  return c.rewardType === "PERCENTAGE" ? formatPercent(c.customerRewardValue) : formatMoney(c.customerRewardValue, c.currency);
}

export function describeEligibility(c: CampaignRuleFields): string[] {
  const rules: string[] = [];
  rules.push(c.requiresApproval ? "Creators need brand approval" : "Creators join instantly");
  rules.push(c.newCustomerOnly ? "First-time customers only" : "New and returning customers");
  rules.push(c.minimumPurchaseAmount ? `Minimum order ${formatMoney(c.minimumPurchaseAmount, c.currency)}` : "No minimum order value");
  rules.push(`${c.attributionWindowDays}-day attribution window (store integrations)`);
  if (c.maxRewardPerCustomer) rules.push(`Max reward ${formatMoney(c.maxRewardPerCustomer, c.currency)} per order`);
  rules.push(c.budget ? `Budget ${formatMoney(c.budget, c.currency)}` : "No budget cap");
  return rules;
}

export function describeDuration(c: Pick<CampaignRuleFields, "startDate" | "endDate">): string {
  return c.endDate ? `${formatDate(c.startDate)} → ${formatDate(c.endDate)}` : `From ${formatDate(c.startDate)}, no end date`;
}

export function CampaignRulesGrid({ campaign }: { campaign: CampaignRuleFields }) {
  const rows: { label: string; value: React.ReactNode }[] = [
    { label: "Campaign type", value: CAMPAIGN_TYPE_LABEL[campaign.campaignType] },
    {
      label: "Creator commission",
      value:
        campaign.campaignType === "CUSTOMER_REFERRAL"
          ? describeCreatorCommission(campaign)
          : `${describeCreatorCommission(campaign)} · ${COMMISSION_TYPE_LABEL[campaign.creatorCommissionType]}`,
    },
    {
      label: "Customer reward",
      value:
        campaign.campaignType === "CREATOR_AFFILIATE"
          ? describeCustomerReward(campaign)
          : `${describeCustomerReward(campaign)} · ${REWARD_TYPE_LABEL[campaign.rewardType]}`,
    },
    { label: "Rules", value: describeEligibility(campaign).join(" · ") },
    { label: "Duration", value: describeDuration(campaign) },
  ];
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {rows.map((r) => (
        <div key={r.label} className="rounded-lg border bg-muted/30 px-3 py-2">
          <dt className="text-xs font-medium text-muted-foreground">{r.label}</dt>
          <dd className="mt-0.5 text-sm">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}
