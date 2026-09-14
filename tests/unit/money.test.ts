import { describe, expect, it } from "vitest";
import {
  applyBasisPoints,
  basisPointsToPercent,
  formatMoney,
  formatPercent,
  paiseToRupees,
  percentToBasisPoints,
  rupeesToPaise,
} from "@/lib/money";

describe("money helpers", () => {
  it("converts rupees to integer paise without float drift", () => {
    expect(rupeesToPaise(100)).toBe(10_000);
    expect(rupeesToPaise(0.1 + 0.2)).toBe(30);
    expect(rupeesToPaise(1234.56)).toBe(123_456);
    expect(paiseToRupees(123_456)).toBe(1234.56);
  });

  it("converts percent to basis points", () => {
    expect(percentToBasisPoints(10)).toBe(1000);
    expect(percentToBasisPoints(12.5)).toBe(1250);
    expect(basisPointsToPercent(1250)).toBe(12.5);
  });

  it("applies basis points with integer rounding (half-up)", () => {
    expect(applyBasisPoints(100_000, 1000)).toBe(10_000); // 10% of ₹1000 = ₹100
    expect(applyBasisPoints(33_333, 1000)).toBe(3_333); // 3333.3 → 3333
    expect(applyBasisPoints(5, 1000)).toBe(1); // 0.5 → 1 (half-up)
    expect(applyBasisPoints(0, 1000)).toBe(0);
  });

  it("rejects non-integer inputs", () => {
    expect(() => applyBasisPoints(100.5, 1000)).toThrow();
    expect(() => applyBasisPoints(100, 10.5)).toThrow();
    expect(() => rupeesToPaise(Number.NaN)).toThrow();
  });

  it("formats INR", () => {
    expect(formatMoney(10_000)).toBe("₹100");
    expect(formatMoney(12_345)).toBe("₹123.45");
    expect(formatMoney(null)).toBe("₹0");
    expect(formatPercent(1000)).toBe("10%");
    expect(formatPercent(1250)).toBe("12.5%");
  });
});
