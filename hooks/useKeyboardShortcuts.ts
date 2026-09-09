import { useEffect, useRef } from "react";

export type MailboxShortcutHandlers = {
  /** A message is open in the reader (viewMode === "message") — gates reply/forward/star, which
   *  only make sense against one specific open message, not a list checkbox selection. */
  hasOpenMessage: boolean;
  /** Something to act on exists — either a message is open, or one or more rows are checked in
   *  the list — gates archive/trash/read-state, which (like Gmail) work from either place. */
  canActOnSelection: boolean;
  onArchive: () => void;
  onTrash: () => void;
  onMarkRead: () => void;
  onMarkUnread: () => void;
  onToggleStar: () => void;
  onCompose: () => void;
  onReply: () => void;
  onReplyAll: () => void;
  onForward: () => void;
  /** Escape: close the open message (back to the list). No-ops if nothing is open. */
  onClose: () => void;
  onShowHelp: () => void;
};

export type ShortcutAction =
  | "help"
  | "close"
  | "compose"
  | "star"
  | "reply"
  | "replyAll"
  | "forward"
  | "archive"
  | "trash"
  | "markUnread"
  | "markRead";

/**
 * Pure key -> action mapping, extracted from the DOM listener so it's testable without rendering
 * anything (this repo's test setup has no jsdom/testing-library — see tests/keyboardShortcuts.
 * test.ts). Held modifier keys (Cmd/Ctrl/Alt) always resolve to no action, so browser/OS shortcuts
 * on the same letter keep working.
 */
export function resolveShortcutAction(
  key: string,
  modifierPressed: boolean,
  hasOpenMessage: boolean,
  canActOnSelection: boolean
): ShortcutAction | null {
  if (modifierPressed) return null;
  if (key === "?") return "help";
  if (key === "Escape") return "close";
  if (key === "c") return "compose";

  if (hasOpenMessage) {
    if (key === "s") return "star";
    if (key === "r") return "reply";
    if (key === "a") return "replyAll";
    if (key === "f") return "forward";
  }

  if (canActOnSelection) {
    if (key === "e") return "archive";
    if (key === "#" || key === "Backspace") return "trash";
    if (key === "U") return "markUnread";
    if (key === "I") return "markRead";
  }

  return null;
}

// <input> types that don't accept character input — a checkbox left focused after a row-select
// click must not swallow every subsequent shortcut key the way a text field would.
const NON_TEXT_INPUT_TYPES = new Set([
  "checkbox",
  "radio",
  "button",
  "submit",
  "reset",
  "range",
  "color",
  "file",
  "image",
]);

/**
 * True while focus is inside a text input, textarea, select, or any contentEditable surface
 * (the search box, the compose rich editor, inline reply) — shortcuts must never fire there.
 *
 * Duck-typed on `tagName`/`isContentEditable` rather than `instanceof HTMLElement`: this repo's
 * Vitest config runs with `environment: "node"` (no DOM globals), so tests exercise this against
 * plain mock objects, not real elements.
 */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== "object" || !("tagName" in target)) return false;
  const el = target as { tagName?: unknown; isContentEditable?: unknown; type?: unknown };
  if (el.isContentEditable) return true;
  if (el.tagName === "TEXTAREA" || el.tagName === "SELECT") return true;
  if (el.tagName === "INPUT") return !NON_TEXT_INPUT_TYPES.has(String(el.type ?? "text").toLowerCase());
  return false;
}

const PREVENT_DEFAULT_ACTIONS: ReadonlySet<ShortcutAction> = new Set(["help", "compose", "trash"]);

/**
 * Gmail-style single-key shortcuts for the mail reader. A single document-level keydown listener
 * (there was none before this — verified no collision) that no-ops while focus is inside any
 * editable surface (see isEditableTarget), so typing is never hijacked.
 *
 * Handlers are read from a ref updated in an effect (not during render — react-hooks/refs flags
 * a direct assignment as a render side effect), so the listener itself is attached once per
 * `enabled` change instead of being torn down and rebuilt on every render just because a caller
 * passed fresh inline closures.
 */
export function useKeyboardShortcuts(handlers: MailboxShortcutHandlers, enabled = true): void {
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      const h = handlersRef.current;
      const action = resolveShortcutAction(
        event.key,
        event.metaKey || event.ctrlKey || event.altKey,
        h.hasOpenMessage,
        h.canActOnSelection
      );
      if (!action) return;
      if (PREVENT_DEFAULT_ACTIONS.has(action)) event.preventDefault();
      switch (action) {
        case "help":
          h.onShowHelp();
          break;
        case "close":
          h.onClose();
          break;
        case "compose":
          h.onCompose();
          break;
        case "star":
          h.onToggleStar();
          break;
        case "reply":
          h.onReply();
          break;
        case "replyAll":
          h.onReplyAll();
          break;
        case "forward":
          h.onForward();
          break;
        case "archive":
          h.onArchive();
          break;
        case "trash":
          h.onTrash();
          break;
        case "markUnread":
          h.onMarkUnread();
          break;
        case "markRead":
          h.onMarkRead();
          break;
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}
