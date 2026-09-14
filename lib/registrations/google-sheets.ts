import "server-only";
import {
  SHEET_COLUMNS,
  rowToValues,
  type RegistrationRow,
  type RegistrationSheet,
  type StatusPatch,
} from "./sheet";

/**
 * Google Sheets driver (optional). Activated with REGISTRATION_SHEET_PROVIDER=google.
 *
 * Requires the `googleapis` package (`npm install googleapis`) and a Google
 * service account shared on the target spreadsheet. All credentials are read
 * from server-only env vars and never reach the browser:
 *
 *   GOOGLE_SHEETS_SPREADSHEET_ID   the spreadsheet id from its URL
 *   GOOGLE_SHEETS_CLIENT_EMAIL     service account email
 *   GOOGLE_SHEETS_PRIVATE_KEY      service account private key (\n-escaped ok)
 *   GOOGLE_SHEETS_SHEET_NAME       tab name (default "Registrations")
 *
 * The password/hash is never sent — the row shape has no such column.
 */

// Minimal structural types for the tiny googleapis surface we touch. Declared
// locally so this file type-checks and builds even without `googleapis` present;
// the module is only ever loaded when the provider is explicitly set to google.
type ValuesApi = {
  append(params: unknown): Promise<unknown>;
  get(params: unknown): Promise<{ data: { values?: string[][] } }>;
  update(params: unknown): Promise<unknown>;
};
type GoogleapisModule = {
  google: {
    auth: { JWT: new (opts: { email: string; key: string; scopes: string[] }) => unknown };
    sheets(opts: { version: "v4"; auth: unknown }): { spreadsheets: { values: ValuesApi } };
  };
};

async function loadGoogleapis(): Promise<GoogleapisModule> {
  // Optional dependency: resolved at runtime only when the google driver is
  // selected. The ignore comments keep bundlers from trying to resolve it at
  // build time (it may not be installed).
  const specifier = "googleapis";
  try {
    return (await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ specifier)) as unknown as GoogleapisModule;
  } catch {
    throw new Error(
      "REGISTRATION_SHEET_PROVIDER=google requires the 'googleapis' package. Run `npm install googleapis`.",
    );
  }
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var ${name} for the Google Sheets registration export.`);
  return value;
}

export class GoogleSheetsDriver implements RegistrationSheet {
  private readonly spreadsheetId = requiredEnv("GOOGLE_SHEETS_SPREADSHEET_ID");
  private readonly sheetName = process.env.GOOGLE_SHEETS_SHEET_NAME?.trim() || "Registrations";
  private valuesApiPromise: Promise<ValuesApi> | null = null;

  private async values(): Promise<ValuesApi> {
    if (!this.valuesApiPromise) {
      this.valuesApiPromise = (async () => {
        const { google } = await loadGoogleapis();
        const auth = new google.auth.JWT({
          email: requiredEnv("GOOGLE_SHEETS_CLIENT_EMAIL"),
          key: requiredEnv("GOOGLE_SHEETS_PRIVATE_KEY").replaceAll("\\n", "\n"),
          scopes: ["https://www.googleapis.com/auth/spreadsheets"],
        });
        return google.sheets({ version: "v4", auth }).spreadsheets.values;
      })();
    }
    return this.valuesApiPromise;
  }

  private async ensureHeader(values: ValuesApi): Promise<void> {
    const res = await values.get({ spreadsheetId: this.spreadsheetId, range: `${this.sheetName}!A1:A1` });
    if (!res.data.values || res.data.values.length === 0) {
      await values.update({
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheetName}!A1`,
        valueInputOption: "RAW",
        requestBody: { values: [[...SHEET_COLUMNS]] },
      });
    }
  }

  async appendRegistration(row: RegistrationRow): Promise<void> {
    const values = await this.values();
    await this.ensureHeader(values);
    await values.append({
      spreadsheetId: this.spreadsheetId,
      range: `${this.sheetName}!A:S`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [rowToValues(row)] },
    });
  }

  async updateStatus(registrationId: string, patch: StatusPatch): Promise<void> {
    const values = await this.values();
    const res = await values.get({ spreadsheetId: this.spreadsheetId, range: `${this.sheetName}!A:A` });
    const ids = res.data.values ?? [];
    let rowNumber = -1;
    for (let i = 0; i < ids.length; i++) {
      if (ids[i]?.[0] === registrationId) {
        rowNumber = i + 1; // 1-based row index in the sheet
        break;
      }
    }
    if (rowNumber < 1) return; // row not found — nothing to update

    // Verification columns are contiguous: O (Verification Status) … R (Rejection Reason).
    const range = `${this.sheetName}!O${rowNumber}:R${rowNumber}`;
    const existing = await values.get({ spreadsheetId: this.spreadsheetId, range });
    const current = existing.data.values?.[0] ?? [];
    const next = [
      patch.verificationStatus,
      patch.verifiedBy ?? current[1] ?? "",
      patch.verificationDate ?? current[2] ?? "",
      patch.rejectionReason ?? current[3] ?? "",
    ];
    await values.update({
      spreadsheetId: this.spreadsheetId,
      range,
      valueInputOption: "RAW",
      requestBody: { values: [next] },
    });
  }
}
