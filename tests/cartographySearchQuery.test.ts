import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ requireRole: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { $queryRaw: vi.fn() } }));

import { buildPrefixTsQuery } from "@/pages/api/cartography/search";

describe("buildPrefixTsQuery", () => {
  it("turns each word into a prefix-matching, AND-joined tsquery term", () => {
    expect(buildPrefixTsQuery("dental clin")).toBe("dental:* & clin:*");
  });

  it("strips punctuation from a word rather than dropping the whole word", () => {
    expect(buildPrefixTsQuery("O'Brien's")).toBe("OBriens:*");
  });

  it("collapses repeated whitespace and ignores empty tokens", () => {
    expect(buildPrefixTsQuery("  dental   clinic  ")).toBe("dental:* & clinic:*");
  });

  it("returns null when nothing usable survives (pure punctuation)", () => {
    expect(buildPrefixTsQuery("!!! ---")).toBeNull();
  });

  it("caps at 8 terms so an unbounded query can't blow up query cost", () => {
    const words = Array.from({ length: 12 }, (_, i) => `word${i}`);
    const result = buildPrefixTsQuery(words.join(" "));
    expect(result?.split(" & ")).toHaveLength(8);
  });
});
