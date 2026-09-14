import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  SHEET_COLUMNS,
  rowToValues,
  type RegistrationRow,
  type RegistrationSheet,
  type StatusPatch,
} from "./sheet";

/**
 * Local CSV fallback driver. Writes to a file OUTSIDE the public folder so it is
 * never web-served. Path is configurable via REGISTRATION_CSV_PATH; defaults to
 * `.data/registrations.csv` under the project root.
 *
 * Note: this is a single-instance, best-effort store meant for local/self-hosted
 * review. It is not safe for concurrent multi-instance writes — use the Google
 * Sheets driver (or a real datastore export) for that.
 */
export class CsvRegistrationSheet implements RegistrationSheet {
  private readonly file: string;

  constructor() {
    const configured = process.env.REGISTRATION_CSV_PATH?.trim();
    this.file = configured
      ? path.resolve(configured)
      : path.join(process.cwd(), ".data", "registrations.csv");
  }

  private escape(value: string): string {
    const v = value ?? "";
    if (/[",\r\n]/.test(v)) return `"${v.replaceAll('"', '""')}"`;
    return v;
  }

  private parseLine(line: string): string[] {
    const out: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (line[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          cur += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        out.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out;
  }

  private async ensureFile(): Promise<string> {
    await mkdir(path.dirname(this.file), { recursive: true });
    try {
      return await readFile(this.file, "utf8");
    } catch {
      const header = SHEET_COLUMNS.map((c) => this.escape(c)).join(",") + "\n";
      await writeFile(this.file, header, "utf8");
      return header;
    }
  }

  async appendRegistration(row: RegistrationRow): Promise<void> {
    const existing = await this.ensureFile();
    const line = rowToValues(row).map((v) => this.escape(v)).join(",");
    const sep = existing.endsWith("\n") || existing.length === 0 ? "" : "\n";
    await writeFile(this.file, existing + sep + line + "\n", "utf8");
  }

  async updateStatus(registrationId: string, patch: StatusPatch): Promise<void> {
    const content = await this.ensureFile();
    const lines = content.split(/\r?\n/);
    // Column indexes (must match SHEET_COLUMNS order).
    const idIdx = 0;
    const statusIdx = SHEET_COLUMNS.indexOf("Verification Status");
    const verifiedByIdx = SHEET_COLUMNS.indexOf("Verified By");
    const verificationDateIdx = SHEET_COLUMNS.indexOf("Verification Date");
    const rejectionIdx = SHEET_COLUMNS.indexOf("Rejection Reason");

    let changed = false;
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i]) continue;
      const cells = this.parseLine(lines[i]);
      if (cells[idIdx] !== registrationId) continue;
      cells[statusIdx] = patch.verificationStatus;
      if (patch.verifiedBy !== undefined) cells[verifiedByIdx] = patch.verifiedBy;
      if (patch.verificationDate !== undefined) cells[verificationDateIdx] = patch.verificationDate;
      if (patch.rejectionReason !== undefined) cells[rejectionIdx] = patch.rejectionReason;
      lines[i] = cells.map((c) => this.escape(c ?? "")).join(",");
      changed = true;
      break;
    }
    if (changed) await writeFile(this.file, lines.join("\n"), "utf8");
  }
}
