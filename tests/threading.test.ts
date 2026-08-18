import { describe, it, expect } from "vitest";
import { buildReplyReferences } from "@/lib/email/threading";

describe("buildReplyReferences", () => {
  it("appends the parent Message-ID to the parent's ancestry", () => {
    // The bug this covers: sending only the parent's References left out the very message being
    // replied to, so a client that threads on References showed the reply detached from it.
    expect(buildReplyReferences("<a@x> <b@x>", "<c@x>")).toBe("<a@x> <b@x> <c@x>");
  });

  it("uses the parent Message-ID alone when the parent has no References", () => {
    // First reply in a conversation: the original carries no References of its own.
    expect(buildReplyReferences("", "<first@x>")).toBe("<first@x>");
    expect(buildReplyReferences(undefined, "<first@x>")).toBe("<first@x>");
  });

  it("falls back to the ancestry when the parent Message-ID is unknown", () => {
    expect(buildReplyReferences("<a@x>", "")).toBe("<a@x>");
    expect(buildReplyReferences("<a@x>", undefined)).toBe("<a@x>");
  });

  it("returns empty when neither is known, rather than a stray space", () => {
    expect(buildReplyReferences("", "")).toBe("");
    expect(buildReplyReferences(undefined, undefined)).toBe("");
  });

  it("does not duplicate an id the ancestry already ends with", () => {
    // Some clients pre-append their own Message-ID to References before sending.
    expect(buildReplyReferences("<a@x> <b@x>", "<b@x>")).toBe("<a@x> <b@x>");
  });

  it("does not treat a substring match as already present", () => {
    // "<b@x>" must not be considered present because "<ab@x>" contains those characters.
    expect(buildReplyReferences("<ab@x>", "<b@x>")).toBe("<ab@x> <b@x>");
  });

  it("normalizes folded whitespace, since References is a folded header", () => {
    expect(buildReplyReferences("<a@x>\r\n <b@x>", "<c@x>")).toBe("<a@x> <b@x> <c@x>");
  });
});
