import { describe, it, expect } from "vitest";
import { mapInBatches } from "@/lib/batch";

describe("mapInBatches", () => {
  it("never exceeds the requested concurrency", async () => {
    // The guarantee that matters for Gmail: firing a whole bulk selection at once is what returned
    // 429 "Too many concurrent requests for user" on part of the batch.
    let active = 0;
    let peak = 0;
    await mapInBatches(
      Array.from({ length: 28 }, (_, i) => i),
      async (item) => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 1));
        active -= 1;
        return item;
      },
      5
    );
    expect(peak).toBeLessThanOrEqual(5);
  });

  it("returns results in input order, not completion order", async () => {
    const result = await mapInBatches(
      [30, 1, 20, 2],
      async (ms) => {
        await new Promise((resolve) => setTimeout(resolve, ms));
        return ms;
      },
      4
    );
    expect(result).toEqual([30, 1, 20, 2]);
  });

  it("covers every item when the count is not a multiple of the batch size", async () => {
    const result = await mapInBatches([1, 2, 3, 4, 5, 6, 7], async (n) => n * 2, 3);
    expect(result).toEqual([2, 4, 6, 8, 10, 12, 14]);
  });

  it("handles an empty list", async () => {
    expect(await mapInBatches([], async (n) => n, 5)).toEqual([]);
  });

  it("rejects a nonsensical batch size rather than hanging", async () => {
    await expect(mapInBatches([1], async (n) => n, 0)).rejects.toThrow("size must be >= 1");
  });
});
