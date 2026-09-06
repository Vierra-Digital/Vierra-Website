"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type ModalProps = {
  /** Defaults to true so callers that already gate on their own condition can omit it. */
  isOpen?: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Tailwind z-index utility for the backdrop (modals stack at different layers). */
  zIndexClass?: string;
  /** Backdrop styling override (default: dim + blur). */
  backdropClassName?: string;
  /** Card styling — set per modal to preserve its width/padding. Pass `null` to render children bare. */
  cardClassName?: string | null;
  /** aria-label for the dialog card. */
  label?: string;
  /** When false, clicking the backdrop does not close (e.g. while saving). */
  closeOnBackdrop?: boolean;
  /** When false, Escape does not close. */
  closeOnEscape?: boolean;
};

/**
 * Shared modal shell: fixed backdrop, centered card, click-outside + Escape to close.
 * Replaces the ~identical overlay markup duplicated across the app's dialogs.
 *
 * Note for anyone passing their own `cardClassName`: this portals into <body>, and globals.css
 * applies `text-foreground` — which is white — to body. So a card that sets no colour of its own
 * makes every unstyled child inside it white on white. The default below sets one; a custom card
 * has to as well (or be one of the deliberately dark email dialogs).
 */
export default function Modal({
  isOpen = true,
  onClose,
  children,
  zIndexClass = "z-50",
  backdropClassName = "bg-black/50 backdrop-blur-sm",
  cardClassName = "w-full max-w-md rounded-lg bg-white p-6 text-[#111827] shadow-xl",
  label,
  closeOnBackdrop = true,
  closeOnEscape = true,
}: ModalProps) {
  // Portal to <body> so the backdrop is always a top-level fixed layer. Mounted
  // deep in the tree, an ancestor's overflow/transform/stacking context can break
  // `position: fixed` and `backdrop-filter` (the blur silently fails). Rendering
  // into body sidesteps all of that. Client-only (modals only open on interaction).
  const [mounted, setMounted] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  // The portal target only exists in the browser, so the first render has to produce nothing and the
  // mount has to be recorded afterwards. See the note above for why this portals at all. Layout effect
  // (not a plain effect) so the flip happens before the browser paints — callers that swap one modal
  // for a differently-typed one (a full unmount + mount, e.g. switching create-account flows) never
  // show a blank frame in between.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useLayoutEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;
    const onKey = (e: KeyboardEvent) => {
      const dialogs = document.querySelectorAll('[role="dialog"][aria-modal="true"]');
      if (e.key === "Escape" && (!cardRef.current || dialogs.item(dialogs.length - 1) === cardRef.current)) {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, closeOnEscape, onClose]);

  useEffect(() => {
    if (!mounted || !isOpen || !cardRef.current) return;
    const card = cardRef.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusable = () => Array.from(card.querySelectorAll<HTMLElement>(
      'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]'
    )).filter(element => element.tabIndex >= 0 && element.getClientRects().length > 0);
    const isTopDialog = () => {
      const dialogs = document.querySelectorAll('[role="dialog"][aria-modal="true"]');
      return dialogs.item(dialogs.length - 1) === card;
    };
    if (isTopDialog()) (focusable()[0] ?? card).focus();

    const onTab = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !isTopDialog()) return;
      const items = focusable();
      const first = items[0];
      const last = items[items.length - 1];
      if (!first) {
        event.preventDefault();
        card.focus();
      } else if (event.shiftKey && (document.activeElement === first || document.activeElement === card || !card.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !card.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onTab);
    return () => {
      document.removeEventListener("keydown", onTab);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [mounted, isOpen]);

  if (!isOpen || !mounted) return null;

  const overlay = (
    <div
      className={`fixed inset-0 ${zIndexClass} flex items-center justify-center p-4 ${backdropClassName}`}
      onClick={closeOnBackdrop ? onClose : undefined}
      role="presentation"
    >
      {cardClassName === null ? (
        children
      ) : (
        <div
          ref={cardRef}
          tabIndex={-1}
          className={`${cardClassName} max-h-[calc(100dvh-2rem)] overflow-y-auto`}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label={label}
        >
          {children}
        </div>
      )}
    </div>
  );

  return createPortal(overlay, document.body);
}
