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
  // PENDING_REVIEW → ACTIVE is an admin decision (lib/services/admin.ts moderateCampaign), never a brand action.
  PUBLISH: { from: ["DRAFT"], to: "ACTIVE" },
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

const DAY_MS = 24 * 60 * 60 * 1000;

/** How long after a campaign stops (end date, pause, early end) the brand can still record orders placed before it. */
export const LATE_RECORDING_DAYS = 30;
/** Small allowance for clock differences when an order date is "now". */
const FUTURE_TOLERANCE_MS = 10 * 60 * 1000;

/** The moment a campaign stopped taking referrals, or null while it still runs. */
export function campaignCutoff(c: Pick<CampaignLike, "status" | "startDate" | "endDate"> & { stoppedAt?: Date | null }, now = new Date()): Date | null {
  const candidates: Date[] = [];
  if (c.endDate && c.endDate < now) candidates.push(c.endDate);
  if ((c.status === "PAUSED" || c.status === "ENDED") && c.stoppedAt) candidates.push(c.stoppedAt);
  if (!candidates.length) return null;
  return new Date(Math.min(...candidates.map((d) => d.getTime())));
}

/** Order dates entered as a calendar day are read in India time (the platform's market). */
const IST_OFFSET_MS = 330 * 60 * 1000;

/** The IST calendar day a yyyy-mm-dd input (parsed as UTC midnight) stands for. */
export function istDayWindow(day: Date): { start: Date; end: Date } {
  const start = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()) - IST_OFFSET_MS);
  return { start, end: new Date(start.getTime() + DAY_MS - 1) };
}

/** Today's date in IST as yyyy-mm-dd (default value for order-date inputs). */
export function istToday(now = new Date()): string {
  return new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

export type OrderDateCheck = { problem: string | null; orderedAt: Date };

/**
 * Can an order placed at `orderedAt` be recorded against this campaign now?
 * `problem` is null when it can, otherwise the reason (shown to the user).
 * `orderedAt` is the instant to store.
 *
 * A live campaign takes any order placed since it started. A campaign that has
 * since ended or been paused still takes orders that were placed while it was
 * running, for LATE_RECORDING_DAYS after it stopped — the brand often records
 * an order a day or two after it happened, and the partner earned it.
 *
 * With `wholeDay`, `orderedAt` is a calendar day (IST) rather than an instant:
 * the order counts if any moment of that day fits, so "today" and the last day
 * of a campaign are never refused by time-of-day. Pure.
 */
export function checkOrderDate(
  c: Pick<CampaignLike, "status" | "startDate" | "endDate"> & { stoppedAt?: Date | null },
  orderedAt: Date,
  now = new Date(),
  opts: { wholeDay?: boolean } = {},
): OrderDateCheck {
  const fail = (problem: string): OrderDateCheck => ({ problem, orderedAt });
  if (Number.isNaN(orderedAt.getTime())) return fail("Enter a valid order date.");
  const { start: earliest, end: latest } = opts.wholeDay ? istDayWindow(orderedAt) : { start: orderedAt, end: orderedAt };
  if (earliest.getTime() > now.getTime() + FUTURE_TOLERANCE_MS) return fail("The order date cannot be in the future.");
  if (latest < c.startDate) return fail("This order was placed before the campaign started, so it cannot be attributed to it.");
  const live = isCampaignLive(c, now);
  const cutoff = live ? null : campaignCutoff(c, now);
  if (!live) {
    if (c.status === "DRAFT" || c.status === "PENDING_REVIEW" || c.status === "ARCHIVED" || !cutoff) return fail("This campaign is not accepting orders.");
    if (earliest > cutoff) return fail(`This order was placed after the campaign stopped (${istToday(cutoff)}), so it cannot be attributed to it.`);
    if (now.getTime() - cutoff.getTime() > LATE_RECORDING_DAYS * DAY_MS) {
      return fail(`Orders for this campaign could be recorded until ${LATE_RECORDING_DAYS} days after it stopped. That window has closed.`);
    }
  }
  // A representative instant inside the allowed range.
  const upper = Math.min(latest.getTime(), now.getTime(), cutoff ? cutoff.getTime() : Infinity);
  const stored = new Date(Math.max(earliest.getTime(), c.startDate.getTime(), Math.min(upper, latest.getTime())));
  return { problem: null, orderedAt: stored };
}

/** Back-compat wrapper: only the problem. */
export function orderAcceptanceProblem(
  c: Pick<CampaignLike, "status" | "startDate" | "endDate"> & { stoppedAt?: Date | null },
  orderedAt: Date,
  now = new Date(),
): string | null {
  return checkOrderDate(c, orderedAt, now).problem;
}

/** Can a buyer still submit an order claim for this campaign? (Live, or inside the late-recording window.) */
export function acceptsOrderClaims(c: Pick<CampaignLike, "status" | "startDate" | "endDate"> & { stoppedAt?: Date | null }, now = new Date()): boolean {
  if (isCampaignLive(c, now)) return true;
  if (c.status !== "ACTIVE" && c.status !== "PAUSED" && c.status !== "ENDED") return false;
  const cutoff = campaignCutoff(c, now);
  return !!cutoff && now.getTime() - cutoff.getTime() <= LATE_RECORDING_DAYS * DAY_MS;
}

/** Commission hold: allowed range and the date a verified entry becomes payable. */
export const HOLD_DAYS_MAX = 60;
export function payableAtFor(holdDays: number, verifiedAt: Date): Date | null {
  return holdDays > 0 ? new Date(verifiedAt.getTime() + holdDays * DAY_MS) : null;
}

/** stoppedAt bookkeeping for a lifecycle action (pause/end record when referrals stopped; resume clears it). */
export function stoppedAtFor(action: CampaignAction, current: Date | null, now: Date): { stoppedAt?: Date | null } {
  if (action === "PAUSE") return { stoppedAt: now };
  if (action === "END") return { stoppedAt: current ?? now };
  if (action === "RESUME") return { stoppedAt: null };
  return {};
}

/**
 * Pre-publish review policy (CAMPAIGN_REVIEW env):
 *  - "first" (default): a brand's first campaign is reviewed by Refnivo before it goes live;
 *  - "all": every new campaign is reviewed;
 *  - "off": campaigns go live immediately.
 * Resuming a paused campaign is never reviewed.
 */
export type CampaignReviewMode = "off" | "first" | "all";
export function campaignReviewMode(env: Partial<Record<string, string>> = process.env): CampaignReviewMode {
  const v = (env.CAMPAIGN_REVIEW ?? "").trim().toLowerCase();
  return v === "off" || v === "all" ? v : "first";
}
export function campaignNeedsReview(mode: CampaignReviewMode, brandHasApprovedCampaign: boolean, brandVerified: boolean): boolean {
  if (mode === "off") return false;
  if (mode === "all") return true;
  return !brandHasApprovedCampaign && !brandVerified;
}
