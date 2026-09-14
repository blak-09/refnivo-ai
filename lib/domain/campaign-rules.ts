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

export function hasEnded(c: Pick<CampaignLike, "endDate">, now = new Date()): boolean {
  return !!c.endDate && c.endDate < now;
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
