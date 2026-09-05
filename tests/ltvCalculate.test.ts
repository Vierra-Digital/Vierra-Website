import { describe, expect, it } from "vitest";
import { calculateLtv, sanitizeNonNegative, sanitizePercent } from "@/lib/ltv/calculate";

describe("sanitizeNonNegative", () => {
  it("treats blank input as 0", () => {
    expect(sanitizeNonNegative("")).toBe(0);
  });
  it("rejects negative values", () => {
    expect(sanitizeNonNegative("-5")).toBe(0);
  });
  it("rejects non-finite input", () => {
    expect(sanitizeNonNegative("abc")).toBe(0);
    expect(sanitizeNonNegative("Infinity")).toBe(0);
  });
  it("keeps a valid decimal", () => {
    expect(sanitizeNonNegative("12.5")).toBe(12.5);
  });
});

describe("sanitizePercent", () => {
  it("clamps above 100 down to 100", () => {
    expect(sanitizePercent("150")).toBe(100);
  });
  it("clamps below 0 up to 0", () => {
    expect(sanitizePercent("-10")).toBe(0);
  });
  it("treats blank/invalid input as 0", () => {
    expect(sanitizePercent("")).toBe(0);
    expect(sanitizePercent("abc")).toBe(0);
  });
  it("keeps an in-range value", () => {
    expect(sanitizePercent("42")).toBe(42);
  });
});

describe("calculateLtv", () => {
  it("matches the documented worked example", () => {
    const { ltv, retainer } = calculateLtv({
      averagePurchaseValue: 500,
      costOfGoodsPercent: 20,
      numReferrals: 1,
      returnsPerYear: 2,
      customerTermYears: 3,
      numClientsBroughtIn: 4,
    });
    // grossProfit = 500 * 0.8 = 400; ltv = 400 * 2 * 3 * 2 = 4800; retainer = 4800 * 4 / 2 = 9600
    expect(ltv).toBe(4800);
    expect(retainer).toBe(9600);
  });

  it("returns 0/0 for all-zero input instead of NaN", () => {
    const { ltv, retainer } = calculateLtv({
      averagePurchaseValue: 0,
      costOfGoodsPercent: 0,
      numReferrals: 0,
      returnsPerYear: 0,
      customerTermYears: 0,
      numClientsBroughtIn: 0,
    });
    expect(ltv).toBe(0);
    expect(retainer).toBe(0);
  });

  it("never surfaces NaN or Infinity", () => {
    const { ltv, retainer } = calculateLtv({
      averagePurchaseValue: Number.MAX_VALUE,
      costOfGoodsPercent: 0,
      numReferrals: Number.MAX_VALUE,
      returnsPerYear: Number.MAX_VALUE,
      customerTermYears: Number.MAX_VALUE,
      numClientsBroughtIn: Number.MAX_VALUE,
    });
    expect(Number.isFinite(ltv)).toBe(true);
    expect(Number.isFinite(retainer)).toBe(true);
  });

  it("100% cost of goods zeroes out lifetime value", () => {
    const { ltv } = calculateLtv({
      averagePurchaseValue: 1000,
      costOfGoodsPercent: 100,
      numReferrals: 5,
      returnsPerYear: 5,
      customerTermYears: 5,
      numClientsBroughtIn: 5,
    });
    expect(ltv).toBe(0);
  });
});
