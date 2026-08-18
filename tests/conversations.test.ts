import { describe, it, expect } from "vitest";
import { conversationFor, conversationKeys, groupConversations, parseMessageIds } from "@/lib/gmail/conversations";

const m = (id: string, threadId: string, messageIdHeader: string, references = "", inReplyTo = "") => ({
  id,
  threadId,
  messageIdHeader,
  references,
  inReplyTo,
});

describe("parseMessageIds", () => {
  it("reads bracketed and bare ids, lowercased", () => {
    expect(parseMessageIds("<A@x> <b@x>")).toEqual(["<a@x>", "<b@x>"]);
    expect(parseMessageIds("a@x")).toEqual(["a@x"]);
    expect(parseMessageIds("")).toEqual([]);
  });
});

describe("the Dan case: two unrelated emails Gmail filed in ONE thread", () => {
  // Same threadId, same sender, no reference path between them — Gmail shows one row, which hid one
  // of the two emails. They must be two rows.
  const dan = [
    m("d1", "T1", "<dan-first@mail>"),
    m("d2", "T1", "<dan-second@mail>"),
  ];

  it("gives them different conversation keys", () => {
    const [k1, k2] = conversationKeys(dan);
    expect(k1).not.toBe(k2);
  });

  it("renders two rows, each counting one message", () => {
    const rows = groupConversations(dan);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.id)).toEqual(["d1", "d2"]);
    expect(rows.every((r) => r.threadCount === 1)).toBe(true);
  });
});

describe("genuine chains still collapse", () => {
  it("keeps an original and its reply on one row (the 8-vs-9 case)", () => {
    const rows = groupConversations([
      m("a1", "T1", "<root@x>"),
      m("a2", "T1", "<reply@x>", "<root@x>"),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].threadCount).toBe(2);
  });

  it("collapses a deep chain and counts every message", () => {
    const rows = groupConversations([
      m("a1", "T1", "<r@x>"),
      m("a2", "T1", "<r1@x>", "<r@x>"),
      m("a3", "T1", "<r2@x>", "<r@x> <r1@x>"),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].threadCount).toBe(3);
  });

  it("links via In-Reply-To when References is absent", () => {
    const rows = groupConversations([
      m("a1", "T1", "<r@x>"),
      m("a2", "T1", "<r1@x>", "", "<r@x>"),
    ]);
    expect(rows).toHaveLength(1);
  });

  it("keeps 8 conversations at 8 rows when one is a 2-message chain", () => {
    const rows = groupConversations([
      m("a1", "T1", "<a@x>"),
      m("a2", "T1", "<a-r@x>", "<a@x>"),
      ...Array.from({ length: 7 }, (_, i) => m(`s${i}`, `T${i + 2}`, `<s${i}@x>`)),
    ]);
    expect(rows).toHaveLength(8);
  });
});

describe("thread isolation", () => {
  it("never merges across Gmail threads even if a reference matches", () => {
    // A quoted history can repeat a Message-ID in an unrelated thread; that must not bridge them.
    const rows = groupConversations([
      m("x1", "T1", "<shared@x>"),
      m("y1", "T2", "<other@x>", "<shared@x>"),
    ]);
    expect(rows).toHaveLength(2);
  });
});

describe("standalone rows", () => {
  it("always gives a forced-standalone message its own row", () => {
    const rows = groupConversations(
      [m("d1", "T1", "<a@x>"), m("d2", "T1", "<b@x>", "<a@x>")],
      (msg) => msg.id === "d2"
    );
    expect(rows).toHaveLength(2);
  });

  it("preserves input order of representatives", () => {
    const rows = groupConversations([
      m("first", "T1", "<f@x>"),
      m("second", "T2", "<s@x>"),
      m("third", "T1", "<t@x>", "<f@x>"),
    ]);
    expect(rows.map((r) => r.id)).toEqual(["first", "second"]);
    expect(rows[0].threadCount).toBe(2);
  });
});

describe("conversationFor (what the reader shows)", () => {
  it("shows only the clicked email when Gmail merged two unrelated ones", () => {
    const dan = [
      m("a", "T", "<one@x>"),
      m("b", "T", "<two@x>"),
    ];
    // Whichever row is opened, the reader shows that email alone — not both stitched together.
    expect(conversationFor(dan, "a").map((m) => m.id)).toEqual(["a"]);
    expect(conversationFor(dan, "b").map((m) => m.id)).toEqual(["b"]);
  });

  it("keeps a real reply chain intact", () => {
    const chain = [
      m("a", "T", "<one@x>"),
      m("b", "T", "<two@x>", "", "<one@x>"),
    ];
    expect(conversationFor(chain, "b").map((m) => m.id)).toEqual(["a", "b"]);
  });

  it("returns everything rather than hiding the thread when the target is unknown", () => {
    const messages = [{ id: "a", threadId: "T" }, { id: "b", threadId: "T" }];
    expect(conversationFor(messages, "missing")).toHaveLength(2);
  });
});

describe("the Dan case: a sender's second email replies to something in our Sent folder", () => {
  // Dan sends #1. We reply (that message lives in Sent, not in this mailbox). Dan replies to *our*
  // message. Dan #2 still lists Dan #1 in its References ancestry, so linking on the whole chain
  // merged both onto one row with a count of 2 — the reported bug. Linking on the immediate parent
  // only breaks the chain at our absent reply, which is what makes these two rows.
  const inboxPage = [
    m("dan1", "T", "<dan-1@x>"),
    m("dan2", "T", "<dan-2@x>", "<dan-1@x> <ours@x>", "<ours@x>"),
  ];

  it("shows two rows, not one row counted as two", () => {
    const rows = groupConversations(inboxPage);
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.threadCount)).toEqual([1, 1]);
  });

  it("still falls back to the tail of References when In-Reply-To is missing", () => {
    const noInReplyTo = [
      m("dan1", "T", "<dan-1@x>"),
      m("dan2", "T", "<dan-2@x>", "<dan-1@x> <ours@x>"),
    ];
    expect(groupConversations(noInReplyTo)).toHaveLength(2);
  });

  it("keeps a chain together while every link in it is present", () => {
    const fullChain = [
      m("a", "T", "<a@x>"),
      m("b", "T", "<b@x>", "<a@x>", "<a@x>"),
      m("c", "T", "<c@x>", "<a@x> <b@x>", "<b@x>"),
    ];
    const rows = groupConversations(fullChain);
    expect(rows).toHaveLength(1);
    expect(rows[0].threadCount).toBe(3);
  });
});
