import "server-only";

/**
 * Registration spreadsheet export.
 *
 * The database is the source of truth for every account and its verification
 * status. This module mirrors ONLY non-sensitive registration details to a
 * spreadsheet so a human can review them out-of-band, exactly as in the flow:
 *
 *   Signup form → database → spreadsheet (non-sensitive) → admin verifies →
 *   database status = APPROVED → login.
 *
 * SECURITY:
 *  - The password and its hash are NEVER written here — there is no column for
 *    them. The hash lives only in the `users` table.
 *  - Credentials for the sheet provider come from server-only env vars and are
 *    never exposed to the browser.
 *  - Exporting is best-effort: a spreadsheet failure must never block a
 *    registration or an admin decision (the DB already recorded it).
 *
 * Default driver: `csv` (writes to a file OUTSIDE the public folder). Set
 * REGISTRATION_SHEET_PROVIDER=google to use the Google Sheets driver instead.
 */

/** Ordered, human-readable column headers (no password/hash column by design). */
export const SHEET_COLUMNS = [
  "Registration ID",
  "Full Name",
  "Email",
  "Phone",
  "Role",
  "Brand Name",
  "Brand Website",
  "Brand Category",
  "Creator Category",
  "Instagram Handle",
  "Instagram Followers",
  "YouTube Channel",
  "YouTube Subscribers",
  "Registration Date",
  "Verification Status",
  "Verified By",
  "Verification Date",
  "Rejection Reason",
  "Notes",
] as const;

export type RegistrationRow = {
  registrationId: string;
  fullName: string;
  email: string;
  phone: string;
  role: string;
  brandName: string;
  brandWebsite: string;
  brandCategory: string;
  creatorCategory: string;
  instagramHandle: string;
  instagramFollowers: string;
  youtubeChannel: string;
  youtubeSubscribers: string;
  registrationDate: string;
  verificationStatus: string;
  verifiedBy: string;
  verificationDate: string;
  rejectionReason: string;
  notes: string;
};

export type StatusPatch = {
  verificationStatus: string;
  verifiedBy?: string;
  verificationDate?: string;
  rejectionReason?: string;
};

/** Serialize a row into the exact column order above. */
export function rowToValues(row: RegistrationRow): string[] {
  return [
    row.registrationId,
    row.fullName,
    row.email,
    row.phone,
    row.role,
    row.brandName,
    row.brandWebsite,
    row.brandCategory,
    row.creatorCategory,
    row.instagramHandle,
    row.instagramFollowers,
    row.youtubeChannel,
    row.youtubeSubscribers,
    row.registrationDate,
    row.verificationStatus,
    row.verifiedBy,
    row.verificationDate,
    row.rejectionReason,
    row.notes,
  ];
}

/** Build a fully-populated row (non-sensitive only) from a created registration. */
export function buildRegistrationRow(input: {
  registrationId: string;
  name: string;
  email: string;
  phone?: string | null;
  role: string;
  details: Record<string, string | number> | null | undefined;
  createdAt: Date;
  verificationStatus?: string;
}): RegistrationRow {
  const d = input.details ?? {};
  const str = (v: unknown) => (v === undefined || v === null ? "" : String(v));
  return {
    registrationId: input.registrationId,
    fullName: input.name,
    email: input.email,
    phone: input.phone ?? "",
    role: input.role,
    brandName: str(d.brandName),
    brandWebsite: str(d.brandWebsite),
    brandCategory: str(d.brandCategory),
    creatorCategory: str(d.creatorCategory),
    instagramHandle: str(d.instagramHandle),
    instagramFollowers: str(d.instagramFollowers),
    youtubeChannel: str(d.youtubeChannel),
    youtubeSubscribers: str(d.youtubeSubscribers),
    registrationDate: input.createdAt.toISOString(),
    verificationStatus: input.verificationStatus ?? "PENDING",
    verifiedBy: "",
    verificationDate: "",
    rejectionReason: "",
    notes: "",
  };
}

export interface RegistrationSheet {
  /** Append one registration as a new row. */
  appendRegistration(row: RegistrationRow): Promise<void>;
  /** Update the verification columns of an existing row, matched by Registration ID. */
  updateStatus(registrationId: string, patch: StatusPatch): Promise<void>;
}

let cached: RegistrationSheet | null = null;

async function getRegistrationSheet(): Promise<RegistrationSheet> {
  if (cached) return cached;
  const provider = (process.env.REGISTRATION_SHEET_PROVIDER ?? "csv").toLowerCase();
  switch (provider) {
    case "google": {
      const { GoogleSheetsDriver } = await import("./google-sheets");
      cached = new GoogleSheetsDriver();
      return cached;
    }
    case "csv":
    default: {
      const { CsvRegistrationSheet } = await import("./csv");
      cached = new CsvRegistrationSheet();
      return cached;
    }
  }
}

/** Best-effort append — logs and swallows any error. */
export async function exportRegistration(row: RegistrationRow): Promise<void> {
  try {
    const sheet = await getRegistrationSheet();
    await sheet.appendRegistration(row);
  } catch (err) {
    console.error("[registration-sheet] append failed", err instanceof Error ? err.message : err);
  }
}

/** Best-effort status update — logs and swallows any error. */
export async function exportStatusUpdate(registrationId: string, patch: StatusPatch): Promise<void> {
  try {
    const sheet = await getRegistrationSheet();
    await sheet.updateStatus(registrationId, patch);
  } catch (err) {
    console.error("[registration-sheet] status update failed", err instanceof Error ? err.message : err);
  }
}
