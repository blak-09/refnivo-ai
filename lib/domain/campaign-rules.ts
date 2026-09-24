import type { CampaignStatus } from "@prisma/client";
import type { CampaignAction } from "@/lib/validation/campaign";

/**
 * Pure campaign lifecycle rules. No database access — unit tested directly.
 */

export type CampaignLike = {
  status: CampaignStatus;
  startDate: Date;
  endDate: Date | null;
  customerRewardValue: number;
  creatorCommissionValue: number;
  budget: number | null;
  campaignType: "CREATOR_AFFILIATE" | "CUSTOMER_REFERRAL" | "HYBRID";
};

/** Allowed status transitions per action. */
export const TRANSITIONS: Record<CampaignAction, { from: CampaignStatus[]; to: CampaignStatus }> = {
  PUBLISH: { from: ["DRAFT", "PENDING_REVIEW"], to: "ACTIVE" },
  PAUSE: { from: ["ACTIVE"], to: "PAUSED" },
  RESUME: { from: ["PAUSED"], to: "ACTIVE" },
  END: { from: ["ACTIVE", "PAUSED"], to: "ENDED" },
  ARCHIVE: { from: ["DRAFT", "PAUSED", "ENDED"], to: "ARCHIVED" },
};

export const EDITABLE_STATUSES: CampaignStatus[] = ["DRAFT", "PENDING_REVIEW", "ACTIVE", "PAUSED"];

export function canEdit(status: CampaignStatus): boolean {
  return EDITABLE_STATUSES.includes(status);
}

export function canTransition(status: CampaignStatus, action: CampaignAction): boolean {
  return TRANSITIONS[action].from.includes(status);
}

export function availableActions(status: CampaignStatus): CampaignAction[] {
  return (Object.keys(TRANSITIONS) as CampaignAction[]).filter((a) => canTransition(status, a));
}

/**
 * A campaign is "live" when it can accept new clicks and eligible conversions:
 * status ACTIVE and today is inside its date window.
 */
export function isCampaignLive(c: Pick<CampaignLike, "status" | "startDate" | "endDate">, now = new Date()): boolean {
  if (c.status !== "ACTIVE") return false;
  if (c.startDate > now) return false;
  if (c.endDate && c.endDate < now) return false;
  return true;
}

/**
 * What the brand should actually be told about a campaign.
 *
 * `status` alone is misleading: a campaign stays ACTIVE in the database after
 * its end date passes (nothing runs a clock over the table), while every public
 * surface hides it and no new order can be attributed to it. Showing a plain
 * "Active" badge in that state reads as data loss — the brand sees the campaign
 * in the dashboard but cannot find it on the site. Pure; unit tested.
 */
export type CampaignVisibility = {
  live: boolean;
  /** LIVE = publicly visible; SCHEDULED/EXPIRED = ACTIVE row that is not; OTHER = the status speaks for itself. */
  state: "LIVE" | "SCHEDULED" | "EXPIRED" | "OTHER";
  /** Badge label; null means "use the status label". */
  label: string | null;
  /** One line explaining why it is not visible, and what fixes it. */
  note: string | null;
};

export function campaignVisibility(c: Pick<CampaignLike, "status" | "startDate" | "endDate">, now = new Date()): CampaignVisibility {
  if (c.status !== "ACTIVE") return { live: false, state: "OTHER", label: null, note: null };
  if (c.startDate > now) return { live: false, state: "SCHEDULED", label: "Scheduled", note: "Publicly visible from its start date." };
  if (c.endDate && c.endDate < now) {
    return {
      live: false,
      state: "EXPIRED",
      label: "Ended",
      note: "Past its end date, so it is hidden from the marketplace and cannot take new orders. Edit the campaign to extend the end date.",
    };
  }
  return { live: true, state: "LIVE", label: "Live", note: null };
}

/**
 * Validation that must pass before a campaign can go ACTIVE. Returns a list of
 * human-readable problems; an empty list means it can be published.
 */
export function publishProblems(c: CampaignLike, now = new Date()): string[] {
  const problems: string[] = [];
  if (c.campaignType !== "CREATOR_AFFILIATE" && c.customerRewardValue <= 0) {
    problems.push("Customer reward must be greater than zero for campaigns that include customers.");
  }
  if (c.campaignType !== "CUSTOMER_REFERRAL" && c.creatorCommissionValue <= 0) {
    problems.push("Creator commission must be greater than zero for campaigns that include creators.");
  }
  if (c.endDate && c.endDate < now) problems.push("End date is in the past. Update the duration first.");
  if (c.endDate && c.endDate <= c.startDate) problems.push("End date must be after the start date.");
  if (c.budget !== null && c.budget <= 0) problems.push("Budget must be greater than zero or left empty.");
  return problems;
}
