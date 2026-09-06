import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";

type RowActionMenuProps = {
  label: string;
  children: React.ReactNode;
  menuWidthClassName?: string;
};

type RowActionMenuItemProps = {
  onClick: () => void;
  icon?: React.ReactNode;
  children: React.ReactNode;
  /**
   * Only two: ordinary and destructive. There used to be an "accent" tone as well, which put a
   * purple item among the grey ones for no reason a reader could work out — three colours in a
   * seven-item menu, only one of which meant anything.
   */
  tone?: "default" | "danger";
  disabled?: boolean;
};

export const RowActionMenuItem: React.FC<RowActionMenuItemProps> = ({
  onClick,
  icon,
  children,
  tone = "default",
  disabled = false,
}) => {
  const toneClass =
    tone === "danger" ? "text-[#B42318] hover:bg-[#FDECEC]" : "text-[#374151] hover:bg-[#F5F3F9]";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex h-8 w-full items-center gap-2.5 whitespace-nowrap rounded-md px-2.5 text-left text-[13px] transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${toneClass}`}
    >
      {icon ? (
        <span
          className={`inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center [&>*]:h-3.5 [&>*]:w-3.5 ${
            tone === "danger" ? "" : "text-[#9CA3AF]"
          }`}
        >
          {icon}
        </span>
      ) : null}
      <span className="truncate">{children}</span>
    </button>
  );
};

/** Hairline between groups — destructive actions shouldn't sit flush against ordinary ones. */
export const RowActionMenuDivider: React.FC = () => <div className="my-1 h-px bg-[#EFECF4]" />;

/** Small caps label for a group of related actions. */
export const RowActionMenuLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="px-2.5 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#9CA3AF]">
    {children}
  </div>
);

const GAP = 6;
const EDGE = 8;

/**
 * Drops separators that have nothing to separate.
 *
 * Call sites decide their items with conditions — a session action only when there is a session,
 * Remove only when the row can be removed — so a menu can end up with a rule and no items above
 * it, or a "Session" heading with nothing under it. Both read as a menu that has been cut off.
 * Rather than making every call site's conditions agree with its dividers, the menu drops any
 * separator that is leading, trailing, or next to another, and any label with no item following.
 */
function tidySeparators(children: React.ReactNode): React.ReactNode[] {
  const items = React.Children.toArray(children).filter(Boolean);
  const isDivider = (node: React.ReactNode) =>
    React.isValidElement(node) && node.type === RowActionMenuDivider;
  const isLabel = (node: React.ReactNode) => React.isValidElement(node) && node.type === RowActionMenuLabel;

  const kept: React.ReactNode[] = [];
  for (let i = 0; i < items.length; i += 1) {
    const node = items[i];
    if (isDivider(node)) {
      // Nothing before it, or the previous kept node is itself a divider.
      if (kept.length === 0 || isDivider(kept[kept.length - 1])) continue;
      // Nothing after it worth separating.
      if (!items.slice(i + 1).some((later) => !isDivider(later))) continue;
    }
    if (isLabel(node)) {
      const next = items[i + 1];
      if (next === undefined || isDivider(next) || isLabel(next)) continue;
    }
    kept.push(node);
  }
  // A trailing divider can survive the loop when everything after it was a label that was dropped.
  while (kept.length > 0 && isDivider(kept[kept.length - 1])) kept.pop();
  return kept;
}

const RowActionMenu: React.FC<RowActionMenuProps> = ({ label, children, menuWidthClassName = "w-[188px]" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const close = useCallback(() => {
    setIsOpen(false);
    setPosition(null);
  }, []);

  /** Closing by keyboard should put the caret back where it came from, not at the top of the page. */
  const closeAndRefocus = useCallback(() => {
    close();
    buttonRef.current?.focus();
  }, [close]);

  /**
   * Placement is measured, not guessed.
   *
   * This used to assume every menu was 150px tall and flip above the row whenever the row sat in
   * the lower half of the window. A menu with more than four items is taller than that, so it was
   * positioned from a number it never matched: flipped menus started ~110px too low and covered
   * the row that opened them, and menus that opened downward ran off the bottom of the card.
   *
   * useLayoutEffect, so the measurement and the move happen before paint — the menu is rendered
   * hidden until `position` exists, so there is nothing to see at the wrong place first.
   */
  useLayoutEffect(() => {
    if (!isOpen || !buttonRef.current || !menuRef.current) return;
    const button = buttonRef.current.getBoundingClientRect();
    const menu = menuRef.current.getBoundingClientRect();

    let top = button.bottom + GAP;
    if (top + menu.height > window.innerHeight - EDGE) {
      const above = button.top - menu.height - GAP;
      // Above if it fits there; otherwise pin to the bottom edge rather than overflow either way.
      top = above >= EDGE ? above : Math.max(EDGE, window.innerHeight - menu.height - EDGE);
    }

    // Right-aligned to the trigger, then clamped so a wide menu near the edge stays on screen.
    const left = Math.min(Math.max(EDGE, button.right - menu.width), window.innerWidth - menu.width - EDGE);

    setPosition({ top, left });
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      if (buttonRef.current?.contains(event.target as Node)) return;
      close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeAndRefocus();
    };
    // Fixed positioning is resolved once, so anything that moves the trigger invalidates it.
    // Closing is the honest response — a menu that drifts away from its row is worse than one
    // that dismisses.
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [isOpen, close, closeAndRefocus]);

  // Move focus into the menu when it opens, so it is operable without a mouse.
  useEffect(() => {
    if (isOpen) menuRef.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
  }, [isOpen]);

  return (
    <div
      className="relative"
      onBlur={(event) => {
        // Tabbing out of the menu closes it, the same as clicking away.
        if (!event.currentTarget.contains(event.relatedTarget as Node)) close();
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        className={`inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
          isOpen ? "bg-[#EFECF4] text-[#374151]" : "text-[#9CA3AF] hover:bg-[#F5F3F9] hover:text-[#374151]"
        }`}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {isOpen && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          className={`fixed z-[100] ${menuWidthClassName} rounded-xl border border-[#E4E0EC] bg-white p-1 shadow-[0_10px_28px_-8px_rgba(16,24,40,0.22)]`}
          style={{
            top: position?.top ?? 0,
            left: position?.left ?? 0,
            visibility: position ? "visible" : "hidden",
          }}
          onClick={close}
        >
          {tidySeparators(children)}
        </div>
      )}
    </div>
  );
};

export default RowActionMenu;
