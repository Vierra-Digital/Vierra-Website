import { describe, it, expect } from "vitest";
import { toBadgeCounts } from "@/pages/api/gmail/counts";
import { mapSendAsEntries } from "@/pages/api/gmail/send-as";
import { sanitizePageSize, sanitizeKeys, PAGE_SIZE_MIN, PAGE_SIZE_MAX } from "@/pages/api/gmail/nav-layout";
import { validateRecipientCsv, orderModules, BADGE_MODULES, PAGE_SIZE, MODULES } from "@/components/email/constants";
import type { ModuleKey } from "@/components/email/types";

/**
 * Sidebar badge counts.
 *
 * These regressed twice in the same way: a number derived from the visible page rather than
 * from the mailbox, which silently caps at one page. The shape below is the contract that
 * prevents it — Inbox/Spam are unread, Drafts is a total, and the mailboxes Gmail doesn't
 * badge stay at zero regardless of what the API returns for them.
 */
describe("toBadgeCounts", () => {
  it("takes unread for Inbox and Spam, and the total for Drafts", () => {
    const counts = toBadgeCounts(
      { messagesTotal: 72970, messagesUnread: 63266 },
      { messagesTotal: 2, messagesUnread: 0 },
      { messagesTotal: 9, messagesUnread: 1 }
    );
    expect(counts.inbox).toBe(63266);
    expect(counts.drafts).toBe(2);
    expect(counts.spam).toBe(1);
  });

  it("never badges Sent, Trash or Archive", () => {
    const counts = toBadgeCounts(
      { messagesUnread: 5 },
      { messagesTotal: 5 },
      { messagesUnread: 5 }
    );
    expect(counts.sent).toBe(0);
    expect(counts.trash).toBe(0);
    expect(counts.archive).toBe(0);
  });

  it("is not capped by any page size", () => {
    const counts = toBadgeCounts({ messagesUnread: 402 }, {}, {});
    expect(counts.inbox).toBe(402);
    expect(counts.inbox).toBeGreaterThan(PAGE_SIZE);
  });

  it("treats missing, null and malformed fields as zero", () => {
    expect(toBadgeCounts({}, {}, {})).toEqual({
      inbox: 0,
      sent: 0,
      drafts: 0,
      spam: 0,
      trash: 0,
      archive: 0,
      starred: 0,
    });
    // Starred is optional on the wire (older payloads omit it) and must still floor to 0.
    expect(toBadgeCounts({}, {}, {}, undefined).starred).toBe(0);
    expect(toBadgeCounts({}, {}, {}, { messagesUnread: 7 }).starred).toBe(7);
    const junk = { messagesUnread: undefined, messagesTotal: undefined };
    expect(toBadgeCounts(junk, junk, junk).inbox).toBe(0);
    expect(toBadgeCounts({ messagesUnread: NaN }, {}, {}).inbox).toBe(0);
  });

  it("clamps negatives to zero rather than rendering a negative badge", () => {
    expect(toBadgeCounts({ messagesUnread: -4 }, { messagesTotal: -1 }, {}).inbox).toBe(0);
    expect(toBadgeCounts({ messagesUnread: -4 }, { messagesTotal: -1 }, {}).drafts).toBe(0);
  });

  it("floors fractional values", () => {
    expect(toBadgeCounts({ messagesUnread: 12.9 }, {}, {}).inbox).toBe(12);
  });

  it("only badges the modules the sidebar actually renders a number for", () => {
    // Starred badges its unread count like Inbox/Spam; Sent and Archive carry none (as in Gmail).
    expect([...BADGE_MODULES].sort()).toEqual(["drafts", "inbox", "spam", "starred"]);
    expect(BADGE_MODULES.has("sent" as ModuleKey)).toBe(false);
    expect(BADGE_MODULES.has("archive" as ModuleKey)).toBe(false);
  });
});

/**
 * Send-as aliases. The primary address carries no verificationStatus at all, so a filter
 * written only against the status drops the user's own address from the From selector.
 */
describe("mapSendAsEntries", () => {
  const realWorld = [
    { sendAsEmail: "alexersion@gmail.com", isPrimary: true },
    { sendAsEmail: "alex@vierradev.com", verificationStatus: "accepted" },
    { sendAsEmail: "business@alexersion.com", verificationStatus: "accepted" },
    { sendAsEmail: "business@alexshick.com", verificationStatus: "accepted" },
  ];

  it("keeps the primary address even with no verificationStatus", () => {
    const aliases = mapSendAsEntries(realWorld);
    expect(aliases.map((a) => a.email)).toContain("alexersion@gmail.com");
    expect(aliases.find((a) => a.isPrimary)?.email).toBe("alexersion@gmail.com");
  });

  it("keeps every accepted alias", () => {
    expect(mapSendAsEntries(realWorld).map((a) => a.email)).toEqual([
      "alexersion@gmail.com",
      "alex@vierradev.com",
      "business@alexersion.com",
      "business@alexshick.com",
    ]);
  });

  it("drops aliases Gmail has not accepted", () => {
    const aliases = mapSendAsEntries([
      { sendAsEmail: "primary@example.com", isPrimary: true },
      { sendAsEmail: "pending@example.com", verificationStatus: "pending" },
      { sendAsEmail: "nostatus@example.com" },
    ]);
    expect(aliases.map((a) => a.email)).toEqual(["primary@example.com"]);
  });

  it("lowercases and trims addresses so they compare against the account email", () => {
    const aliases = mapSendAsEntries([{ sendAsEmail: "  Alex@VierraDev.com  ", verificationStatus: "accepted" }]);
    expect(aliases[0].email).toBe("alex@vierradev.com");
  });

  it("carries the display name through, defaulting to empty", () => {
    const aliases = mapSendAsEntries([
      { sendAsEmail: "a@b.com", displayName: "Alex Shick", isPrimary: true },
      { sendAsEmail: "c@d.com", verificationStatus: "accepted" },
    ]);
    expect(aliases[0].displayName).toBe("Alex Shick");
    expect(aliases[1].displayName).toBe("");
  });

  it("drops entries with no address instead of emitting a blank option", () => {
    expect(mapSendAsEntries([{ sendAsEmail: "", isPrimary: true }, { isPrimary: true }])).toEqual([]);
  });

  it("returns an empty list for non-array payloads", () => {
    for (const input of [undefined, null, {}, "sendAs", 42]) {
      expect(mapSendAsEntries(input)).toEqual([]);
    }
  });
});

/** Rows-per-page preference, editable in Settings and clamped on both sides. */
describe("sanitizePageSize", () => {
  it("keeps a value inside the supported range", () => {
    expect(sanitizePageSize(50)).toBe(50);
    expect(sanitizePageSize("25")).toBe(25);
  });

  it("clamps to the range the mailbox list can serve", () => {
    expect(sanitizePageSize(1)).toBe(PAGE_SIZE_MIN);
    expect(sanitizePageSize(10_000)).toBe(PAGE_SIZE_MAX);
  });

  it("treats blank, zero and junk as 'use the default'", () => {
    for (const input of ["", "   ", 0, -5, "abc", null, undefined, NaN, {}]) {
      expect(sanitizePageSize(input)).toBeNull();
    }
  });

  it("floors fractional input", () => {
    expect(sanitizePageSize(33.7)).toBe(33);
  });

  it("accepts the built-in default unchanged", () => {
    expect(sanitizePageSize(PAGE_SIZE)).toBe(PAGE_SIZE);
  });
});

/** Nav preference key sanitising — shared by the hidden set and the custom order. */
describe("sanitizeKeys", () => {
  it("trims, lowercases and de-dupes", () => {
    expect(sanitizeKeys([" Inbox ", "INBOX", "spam"])).toEqual(["inbox", "spam"]);
  });

  it("ignores non-strings and empties", () => {
    expect(sanitizeKeys(["inbox", 5, null, "", "   ", {}])).toEqual(["inbox"]);
  });

  it("returns empty for non-array input", () => {
    expect(sanitizeKeys("inbox")).toEqual([]);
    expect(sanitizeKeys(undefined)).toEqual([]);
  });

  it("bounds the list and the key length", () => {
    expect(sanitizeKeys(Array.from({ length: 80 }, (_, i) => `k${i}`))).toHaveLength(40);
    expect(sanitizeKeys(["x".repeat(41)])).toEqual([]);
    expect(sanitizeKeys(["x".repeat(40)])).toHaveLength(1);
  });
});

/** Cc/Bcc validation runs before send and is the last guard against a malformed header. */
describe("validateRecipientCsv", () => {
  it("accepts an empty field", () => {
    expect(validateRecipientCsv("Cc", "")).toBeNull();
    expect(validateRecipientCsv("Bcc", "   ")).toBeNull();
  });

  it("accepts a single address and a comma-separated list", () => {
    expect(validateRecipientCsv("Cc", "a@b.com")).toBeNull();
    expect(validateRecipientCsv("Cc", "a@b.com, c@d.com ,e@f.co")).toBeNull();
  });

  it("accepts display-name form", () => {
    expect(validateRecipientCsv("Cc", "Alex Shick <alex@vierradev.com>")).toBeNull();
    expect(validateRecipientCsv("Bcc", "Alex <a@b.com>, Chris <c@d.com>")).toBeNull();
  });

  it("names the offending address and the field", () => {
    const error = validateRecipientCsv("Bcc", "a@b.com, not-an-email");
    expect(error).toContain("Bcc");
    expect(error).toContain("not-an-email");
  });

  it("rejects a malformed address inside display-name form", () => {
    expect(validateRecipientCsv("Cc", "Alex <nope>")).not.toBeNull();
  });

  it("tolerates a trailing comma", () => {
    expect(validateRecipientCsv("Cc", "a@b.com,")).toBeNull();
  });
});

/** Sidebar ordering — a saved order must never drop or duplicate a module. */
describe("orderModules", () => {
  const items = MODULES.map((m) => ({ key: m.key }));

  it("is a pure permutation of the input", () => {
    const ordered = orderModules(items, ["trash", "inbox"]);
    expect(ordered).toHaveLength(items.length);
    expect([...ordered].map((i) => i.key).sort()).toEqual(items.map((i) => i.key).sort());
  });

  it("puts ordered keys first, in the saved order", () => {
    const ordered = orderModules(items, ["trash", "spam"]);
    expect(ordered[0].key).toBe("trash");
    expect(ordered[1].key).toBe("spam");
  });

  it("keeps unordered keys in their original relative order", () => {
    const ordered = orderModules(items, ["trash"]);
    const rest = ordered.slice(1).map((i) => i.key);
    const expected = items.map((i) => i.key).filter((k) => k !== "trash");
    expect(rest).toEqual(expected);
  });

  it("ignores keys in the saved order that no longer exist", () => {
    const ordered = orderModules(items, ["retired-module", "trash"]);
    expect(ordered[0].key).toBe("trash");
    expect(ordered).toHaveLength(items.length);
  });

  it("returns the input untouched for an empty order", () => {
    expect(orderModules(items, [])).toEqual(items);
  });
});
