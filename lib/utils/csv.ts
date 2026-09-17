/**
 * Minimal CSV writer. Pure (unit-tested). Every cell is quoted when it contains
 * a delimiter, quote or newline, and cells starting with = + - @ are prefixed
 * with a single quote so spreadsheets never execute them as formulas.
 */
export type CsvRow = Record<string, string | number | boolean | null | undefined>;

export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s = typeof value === "string" ? value : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(rows: CsvRow[], columns?: string[]): string {
  if (!rows.length) return "";
  const cols = columns ?? Array.from(rows.reduce((set, r) => (Object.keys(r).forEach((k) => set.add(k)), set), new Set<string>()));
  const lines = [cols.map(csvCell).join(",")];
  for (const row of rows) lines.push(cols.map((c) => csvCell(row[c])).join(","));
  return lines.join("\r\n");
}
