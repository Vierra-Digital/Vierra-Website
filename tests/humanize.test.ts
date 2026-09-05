import { describe, expect, it } from "vitest";
import { HUMANIZE_STYLE, cleanAiTells, withHumanizedSystem } from "@/lib/ai/humanize";

describe("cleanAiTells", () => {
  it("turns a spaced em dash into the comma it was standing in for", () => {
    expect(cleanAiTells("We ship fast — and we ship well.")).toBe("We ship fast, and we ship well.");
  });

  it("replaces a bare em dash and keeps an en dash range as a hyphen", () => {
    expect(cleanAiTells("Leads—qualified ones—convert.")).toBe("Leads, qualified ones, convert.");
    expect(cleanAiTells("Expect 20–30 meetings.")).toBe("Expect 20-30 meetings.");
  });

  it("straightens curly quotes and the ellipsis character", () => {
    expect(cleanAiTells("“It’s ready”…")).toBe("\"It's ready\"...");
  });

  it("strips non-breaking and zero-width spaces", () => {
    expect(cleanAiTells("book a​ call")).toBe("book a call");
  });

  it("does not leave a doubled comma where a dash sat beside one", () => {
    expect(cleanAiTells("First, — then second.")).toBe("First, then second.");
  });

  it("does not leave a space before punctuation it created", () => {
    expect(cleanAiTells("Qualified leads — , not clicks.")).not.toContain(" ,");
  });

  it("is idempotent, so cleaning what the box already cleaned changes nothing", () => {
    const once = cleanAiTells("Growth is a system — not a campaign.");
    expect(cleanAiTells(once)).toBe(once);
  });

  it("leaves ordinary prose untouched", () => {
    const plain = "We build the outreach first, then tie our fee to the meetings it produces.";
    expect(cleanAiTells(plain)).toBe(plain);
  });

  it("returns empty input unchanged rather than throwing", () => {
    expect(cleanAiTells("")).toBe("");
  });
});

describe("withHumanizedSystem", () => {
  it("puts the style guide in front of the caller's prompt, keeping both", () => {
    const result = withHumanizedSystem("You are Artemis. Draft an email.");
    expect(result.startsWith(HUMANIZE_STYLE)).toBe(true);
    expect(result).toContain("You are Artemis. Draft an email.");
  });

  it("tells the model today's date, so a mandated format is not filled with an invented year", () => {
    const result = withHumanizedSystem("Draft an email.");
    const expected = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
    }).format(new Date());
    expect(result).toContain(`Today's date is ${expected}`);
    expect(result).toMatch(/Today's date is \d{2}\/\d{2}\/\d{4}/);
  });

  it("carries the rules that the deterministic pass cannot enforce", () => {
    // Buzzword and preamble bans only exist in the prompt; nothing strips them after the fact.
    expect(HUMANIZE_STYLE).toContain("delve");
    expect(HUMANIZE_STYLE).toContain("No preambles");
    expect(HUMANIZE_STYLE).toContain("MM/DD/YYYY");
  });

  it("does not claim to override a tone the caller asked for", () => {
    // compose/rewrite pass a requested tone; the box's wording ("overrides any default tone")
    // would fight those routes, so this copy is deliberately narrower.
    expect(HUMANIZE_STYLE).not.toContain("Overrides any default tone");
    expect(HUMANIZE_STYLE).toContain("does not override a tone you were asked to hit");
  });
});
