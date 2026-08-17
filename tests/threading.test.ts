import { describe, it, expect } from "vitest";
import { chainFor, chainKeyFor, parseMessageIds, normalizeMessageId } from "@/lib/gmail/threading";

const msg = (id: string, messageIdHeader: string, references = "", inReplyTo = "") => ({
  id,
  messageIdHeader,
  references,
  inReplyTo,
});

describe("parseMessageIds", () => {
  it("extracts bracketed ids, oldest first", () => {
    expect(parseMessageIds("<a@x> <b@x>")).toEqual(["<a@x>", "<b@x>"]);
  });
  it("tolerates unbracketed ids and blanks", () => {
    expect(parseMessageIds("a@x b@x")).toEqual(["a@x", "b@x"]);
    expect(parseMessageIds("")).toEqual([]);
    expect(parseMessageIds(undefined)).toEqual([]);
  });
  it("lowercases so comparisons are case-insensitive", () => {
    expect(parseMessageIds("<AbC@X>")).toEqual(["<abc@x>"]);
  });
});

describe("normalizeMessageId", () => {
  it("returns the first id, normalized", () => {
    expect(normalizeMessageId("<A@x>")).toBe("<a@x>");
    expect(normalizeMessageId(undefined)).toBe("");
  });
});

describe("chainKeyFor", () => {
  it("gives two independent sends different keys even in one Gmail thread", () => {
    const a = msg("1", "<one@vierra>");
    const b = msg("2", "<two@vierra>");
    expect(chainKeyFor(a)).not.toBe(chainKeyFor(b));
  });

  it("groups a reply with the original it answers", () => {
    const original = msg("1", "<one@vierra>");
    const reply = msg("2", "<two@vierra>", "<one@vierra>");
    expect(chainKeyFor(reply)).toBe(chainKeyFor(original));
  });

  it("groups a deep chain under its root", () => {
    const root = msg("1", "<one@x>");
    const r1 = msg("2", "<two@x>", "<one@x>");
    const r2 = msg("3", "<three@x>", "<one@x> <two@x>");
    expect(chainKeyFor(r1)).toBe(chainKeyFor(root));
    expect(chainKeyFor(r2)).toBe(chainKeyFor(root));
  });

  it("keeps replies to DIFFERENT originals apart — the case threadId got wrong", () => {
    const replyToA = msg("10", "<ra@x>", "<a@x>");
    const replyToB = msg("11", "<rb@x>", "<b@x>");
    expect(chainKeyFor(replyToA)).not.toBe(chainKeyFor(replyToB));
  });

  it("uses In-Reply-To when References is absent", () => {
    const original = msg("1", "<one@x>");
    const reply = msg("2", "<two@x>", "", "<one@x>");
    expect(chainKeyFor(reply)).toBe(chainKeyFor(original));
  });

  it("falls back to the row id when no headers exist at all", () => {
    expect(chainKeyFor({ id: "abc" })).toBe("msg:abc");
  });
});

describe("chainFor", () => {
  it("returns only the conversation containing the opened message", () => {
    // One Gmail thread holding two unrelated conversations.
    const messages = [
      msg("1", "<one@x>"),
      msg("2", "<two@x>", "<one@x>"),
      msg("3", "<solo@x>"),
    ];
    expect(chainFor(messages, "1").map((m) => m.id)).toEqual(["1", "2"]);
    expect(chainFor(messages, "3").map((m) => m.id)).toEqual(["3"]);
  });

  it("walks a multi-step chain in both directions", () => {
    const messages = [
      msg("1", "<a@x>"),
      msg("2", "<b@x>", "<a@x>"),
      msg("3", "<c@x>", "<a@x> <b@x>"),
      msg("4", "<z@x>"),
    ];
    // Opening the newest reply still returns the whole chain, not just its ancestors.
    expect(chainFor(messages, "3").map((m) => m.id)).toEqual(["1", "2", "3"]);
    expect(chainFor(messages, "4").map((m) => m.id)).toEqual(["4"]);
  });

  it("preserves the input order", () => {
    const messages = [msg("1", "<a@x>"), msg("2", "<b@x>", "<a@x>"), msg("3", "<c@x>", "<a@x>")];
    expect(chainFor(messages, "2").map((m) => m.id)).toEqual(["1", "2", "3"]);
  });

  it("is a no-op for a single message or an unknown target", () => {
    const one = [msg("1", "<a@x>")];
    expect(chainFor(one, "1")).toEqual(one);
    const two = [msg("1", "<a@x>"), msg("2", "<b@x>")];
    // Unknown target: return everything rather than silently hiding the thread.
    expect(chainFor(two, "nope")).toEqual(two);
  });

  it("does not link messages that share no references", () => {
    const messages = [msg("1", "<a@x>"), msg("2", "<b@x>"), msg("3", "<c@x>")];
    expect(chainFor(messages, "2").map((m) => m.id)).toEqual(["2"]);
  });

  it("ignores a self-reference rather than treating it as a link", () => {
    const messages = [msg("1", "<a@x>", "<a@x>"), msg("2", "<b@x>")];
    expect(chainFor(messages, "1").map((m) => m.id)).toEqual(["1"]);
  });
});

describe("regression: 8 conversations must not render as 9 rows", () => {
  // The shipped rule was "does it have References?" — an original (none) got its own row and its
  // reply (some) got another, so one two-message conversation counted twice.
  it("keeps an original and its reply on a single row", () => {
    const original = msg("m1", "<root@vierra>");
    const reply = msg("m2", "<reply@vierra>", "<root@vierra>");
    const keys = new Set([chainKeyFor(original), chainKeyFor(reply)]);
    expect(keys.size).toBe(1);
  });

  it("counts 8 rows for 8 conversations when one of them is a 2-message chain", () => {
    const rows = [
      msg("a1", "<a@x>"),
      msg("a2", "<a-reply@x>", "<a@x>"), // same conversation as a1
      ...Array.from({ length: 7 }, (_, i) => msg(`s${i}`, `<solo${i}@x>`)),
    ];
    const distinct = new Set(rows.map(chainKeyFor));
    expect(distinct.size).toBe(8);
  });
});
