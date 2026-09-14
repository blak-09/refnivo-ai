/**
 * Money helpers. All amounts are integers in minor units (paise for INR).
 * Percentages are integers in basis points (1 bp = 0.01%, 1000 bp = 10%).
 * No floating-point arithmetic is used for financial values.
 */

export const BASIS_POINTS_PER_PERCENT = 100;
export const BASIS_POINTS_DENOMINATOR = 10_000;

export function rupeesToPaise(rupees: number): number {
  if (!Number.isFinite(rupees)) throw new Error("Invalid amount");
  // Round to avoid 0.1 + 0.2 style artefacts coming from form inputs.
  return Math.round(rupees * 100);
}

export function paiseToRupees(paise: number): number {
  return paise / 100;
}

export function percentToBasisPoints(percent: number): number {
  if (!Number.isFinite(percent)) throw new Error("Invalid percent");
  return Math.round(percent * BASIS_POINTS_PER_PERCENT);
}

export function basisPointsToPercent(bp: number): number {
  return bp / BASIS_POINTS_PER_PERCENT;
}

/** Integer percentage of an amount, rounded half-up. */
export function applyBasisPoints(amountMinor: number, bp: number): number {
  assertInt(amountMinor, "amount");
  assertInt(bp, "basis points");
  const product = amountMinor * bp;
  return Math.floor((product + BASIS_POINTS_DENOMINATOR / 2) / BASIS_POINTS_DENOMINATOR);
}

export function formatMoney(
  amountMinor: number | null | undefined,
  currency = "INR",
  opts: { compact?: boolean } = {},
): string {
  const value = (amountMinor ?? 0) / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
    notation: opts.compact ? "compact" : "standard",
  }).format(value);
}

export function formatPercent(bp: number): string {
  const pct = basisPointsToPercent(bp);
  return `${Number(pct.toFixed(2))}%`;
}

function assertInt(value: number, label: string) {
  if (!Number.isInteger(value)) throw new Error(`${label} must be an integer`);
}
