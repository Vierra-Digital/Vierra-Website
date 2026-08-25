import { describe, it, expect } from "vitest";
import { collapsesThreads } from "@/lib/gmail/mailboxCollapse";

describe("collapsesThreads", () => {
  it("collapses Archive and Sent, where your own copy sits beside the original", () => {
    expect(collapsesThreads("archive")).toBe(true);
    expect(collapsesThreads("sent")).toBe(true);
  });

  it("never collapses the Inbox — a second email from one sender must be its own row", () => {
    // The reported bug: Gmail files two unrelated emails from the same person in one thread when
    // they share a subject, so collapsing there hides one of them entirely.
    expect(collapsesThreads("inbox")).toBe(false);
  });

  it("leaves drafts alone, since a draft is an editable object rather than a conversation", () => {
    expect(collapsesThreads("drafts")).toBe(false);
  });

  it("does not collapse the other views either", () => {
    for (const mailbox of ["spam", "trash", "starred", "important", "allmail", "scheduled"]) {
      expect(collapsesThreads(mailbox), mailbox).toBe(false);
    }
  });
});
