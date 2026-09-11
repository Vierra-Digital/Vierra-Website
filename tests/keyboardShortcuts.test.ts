import { describe, expect, it } from "vitest";
import { resolveShortcutAction, isEditableTarget } from "@/hooks/useKeyboardShortcuts";

describe("resolveShortcutAction", () => {
  it("resolves global shortcuts regardless of selection state", () => {
    expect(resolveShortcutAction("?", false, false, false)).toBe("help");
    expect(resolveShortcutAction("Escape", false, false, false)).toBe("close");
    expect(resolveShortcutAction("c", false, false, false)).toBe("compose");
  });

  it("ignores every shortcut key when a modifier is held", () => {
    expect(resolveShortcutAction("c", true, true, true)).toBeNull();
    expect(resolveShortcutAction("e", true, true, true)).toBeNull();
    expect(resolveShortcutAction("?", true, true, true)).toBeNull();
  });

  it("gates reply/forward/star on an open message, not just a selection", () => {
    expect(resolveShortcutAction("r", false, false, true)).toBeNull();
    expect(resolveShortcutAction("a", false, false, true)).toBeNull();
    expect(resolveShortcutAction("f", false, false, true)).toBeNull();
    expect(resolveShortcutAction("s", false, false, true)).toBeNull();

    expect(resolveShortcutAction("r", false, true, false)).toBe("reply");
    expect(resolveShortcutAction("a", false, true, false)).toBe("replyAll");
    expect(resolveShortcutAction("f", false, true, false)).toBe("forward");
    expect(resolveShortcutAction("s", false, true, false)).toBe("star");
  });

  it("gates archive/trash/read-state on canActOnSelection (open message or checked rows)", () => {
    expect(resolveShortcutAction("e", false, false, false)).toBeNull();
    expect(resolveShortcutAction("#", false, false, false)).toBeNull();
    expect(resolveShortcutAction("Backspace", false, false, false)).toBeNull();
    expect(resolveShortcutAction("U", false, false, false)).toBeNull();
    expect(resolveShortcutAction("I", false, false, false)).toBeNull();

    expect(resolveShortcutAction("e", false, false, true)).toBe("archive");
    expect(resolveShortcutAction("#", false, false, true)).toBe("trash");
    expect(resolveShortcutAction("Backspace", false, false, true)).toBe("trash");
    expect(resolveShortcutAction("U", false, false, true)).toBe("markUnread");
    expect(resolveShortcutAction("I", false, false, true)).toBe("markRead");
  });

  it("does not infer canActOnSelection from hasOpenMessage — callers must OR them themselves", () => {
    // EmailingPlatformSection passes canActOnSelection: hasOpenMessage || hasSelectedEmails;
    // the pure function itself treats the two flags independently.
    expect(resolveShortcutAction("e", false, true, false)).toBeNull();
  });

  it("returns null for unmapped keys", () => {
    expect(resolveShortcutAction("z", false, true, true)).toBeNull();
    expect(resolveShortcutAction("1", false, true, true)).toBeNull();
  });

  it("is case-sensitive: lowercase i/u are unmapped, uppercase are mark-read/unread", () => {
    expect(resolveShortcutAction("i", false, false, true)).toBeNull();
    expect(resolveShortcutAction("u", false, false, true)).toBeNull();
  });
});

describe("isEditableTarget", () => {
  const makeTarget = (overrides: Partial<{ tagName: string; isContentEditable: boolean; type: string }>) =>
    ({ tagName: "DIV", isContentEditable: false, ...overrides }) as unknown as EventTarget;

  it("treats text-entry inputs, textarea, and select tags as editable", () => {
    expect(isEditableTarget(makeTarget({ tagName: "INPUT", type: "text" }))).toBe(true);
    expect(isEditableTarget(makeTarget({ tagName: "INPUT" }))).toBe(true); // no type attr defaults to "text"
    expect(isEditableTarget(makeTarget({ tagName: "INPUT", type: "email" }))).toBe(true);
    expect(isEditableTarget(makeTarget({ tagName: "INPUT", type: "password" }))).toBe(true);
    expect(isEditableTarget(makeTarget({ tagName: "TEXTAREA" }))).toBe(true);
    expect(isEditableTarget(makeTarget({ tagName: "SELECT" }))).toBe(true);
  });

  it("does not treat a focused checkbox/radio/button input as editable", () => {
    // A row-select checkbox left focused after a click must not swallow every shortcut key.
    expect(isEditableTarget(makeTarget({ tagName: "INPUT", type: "checkbox" }))).toBe(false);
    expect(isEditableTarget(makeTarget({ tagName: "INPUT", type: "radio" }))).toBe(false);
    expect(isEditableTarget(makeTarget({ tagName: "INPUT", type: "button" }))).toBe(false);
  });

  it("treats contentEditable elements as editable regardless of tag", () => {
    expect(isEditableTarget(makeTarget({ tagName: "DIV", isContentEditable: true }))).toBe(true);
  });

  it("treats a plain div and non-element targets as not editable", () => {
    expect(isEditableTarget(makeTarget({ tagName: "DIV" }))).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
    expect(isEditableTarget({} as EventTarget)).toBe(false);
  });
});
