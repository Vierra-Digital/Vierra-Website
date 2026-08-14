import { describe, it, expect } from "vitest";
import { mapInBatches } from "@/lib/batch";

describe("mapInBatches", () => {
  it("returns results in input order regardless of batch size", async () => {
    const out = await mapInBatches([1, 2, 3, 4, 5], async (n) => n * 2, 2);
    expect(out).toEqual([2, 4, 6, 8, 10]);
  });

  it("passes the absolute index across batches", async () => {
    const out = await mapInBatches(["a", "b", "c", "d"], async (_v, i) => i, 2);
    expect(out).toEqual([0, 1, 2, 3]);
  });

  it("never runs more than `size` operations concurrently", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    await mapInBatches(
      Array.from({ length: 10 }, (_, i) => i),
      async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((r) => setTimeout(r, 3));
        inFlight -= 1;
      },
      3
    );
    expect(maxInFlight).toBeLessThanOrEqual(3);
    expect(maxInFlight).toBeGreaterThan(1); // it actually parallelized
  });

  it("handles empty input", async () => {
    expect(await mapInBatches([], async (x) => x)).toEqual([]);
  });

  it("rejects an invalid batch size", async () => {
    await expect(mapInBatches([1], async (x) => x, 0)).rejects.toThrow();
  });

  it("rejects if any operation throws", async () => {
    await expect(
      mapInBatches([1, 2, 3], async (n) => {
        if (n === 2) throw new Error("boom");
        return n;
      })
    ).rejects.toThrow("boom");
  });
});
