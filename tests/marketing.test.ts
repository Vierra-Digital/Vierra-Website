import { describe, it, expect } from "vitest";
import { pct } from "@/lib/api/marketing";

describe("pct", () => {
  it("computes a percentage rounded to 2 decimals", () => {
    expect(pct(1, 4)).toBe(25);
    expect(pct(1, 3)).toBe(33.33);
    expect(pct(2, 3)).toBe(66.67);
    expect(pct(4, 4)).toBe(100);
  });

  it("returns 0 when the denominator is 0 (no division by zero)", () => {
    expect(pct(0, 0)).toBe(0);
    expect(pct(5, 0)).toBe(0);
  });
});
