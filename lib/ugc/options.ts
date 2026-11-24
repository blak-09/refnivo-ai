/** UGC collaboration options shared by forms, validation and display. Pure. */

export const UGC_CONTENT_TYPES = [
  { value: "VIDEO", label: "Short video (Reels / Shorts)" },
  { value: "PHOTO", label: "Photos" },
  { value: "UNBOXING", label: "Unboxing" },
  { value: "REVIEW", label: "Review / testimonial" },
  { value: "TUTORIAL", label: "How-to / tutorial" },
  { value: "VOICEOVER", label: "Voice-over" },
] as const;

export const UGC_USAGE_RIGHTS = [
  { value: "ORGANIC_3M", label: "Brand's own social pages · 3 months" },
  { value: "ORGANIC_12M", label: "Brand's own social pages · 12 months" },
  { value: "ADS_3M", label: "Social pages + paid ads · 3 months" },
  { value: "ADS_12M", label: "Social pages + paid ads · 12 months" },
  { value: "PERPETUAL", label: "All channels, no time limit" },
] as const;

export const UGC_CONTENT_TYPE_LABEL: Record<string, string> = Object.fromEntries(UGC_CONTENT_TYPES.map((o) => [o.value, o.label]));
export const UGC_USAGE_LABEL: Record<string, string> = Object.fromEntries(UGC_USAGE_RIGHTS.map((o) => [o.value, o.label]));

/** Fee per creator, in paise: ₹100 – ₹2,00,000. */
export const UGC_FEE_MIN = 10_000;
export const UGC_FEE_MAX = 20_000_000;
export const UGC_MAX_CREATORS = 50;
/** Content rounds per collaboration: the first delivery plus two revisions. */
export const UGC_MAX_ROUNDS = 3;
export const UGC_MAX_IMAGES = 10;
export const UGC_MAX_LINKS = 5;

export const UGC_BRIEF_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  OPEN: "Open for applications",
  CLOSED: "Closed",
  ARCHIVED: "Archived",
};

export const UGC_COLLAB_STATUS_LABEL: Record<string, string> = {
  APPLIED: "Applied",
  DECLINED: "Not selected",
  WITHDRAWN: "Withdrawn",
  IN_PROGRESS: "Creating content",
  SUBMITTED: "Content submitted",
  REVISION_REQUESTED: "Revision requested",
  APPROVED: "Approved",
  CANCELLED: "Cancelled",
};

/** Collaborations that hold one of the brief's creator slots. */
export const UGC_ACTIVE_STATUSES = ["IN_PROGRESS", "SUBMITTED", "REVISION_REQUESTED", "APPROVED"] as const;

/** Badge tone for a collaboration status (maps onto StatusBadge's palette). */
export function ugcCollabTone(status: string): string {
  if (status === "APPROVED") return "ACTIVE";
  if (status === "SUBMITTED" || status === "APPLIED") return "PENDING";
  if (status === "REVISION_REQUESTED" || status === "IN_PROGRESS") return "PENDING_REVIEW";
  if (status === "DECLINED" || status === "CANCELLED") return "REJECTED";
  return "ENDED";
}

export function ugcBriefTone(status: string): string {
  return status === "OPEN" ? "ACTIVE" : status === "DRAFT" ? "DRAFT" : status === "CLOSED" ? "PAUSED" : "ARCHIVED";
}
