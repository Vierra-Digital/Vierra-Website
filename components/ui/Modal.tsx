"use client";

import React, { useEffect, useState } from "react";
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
 */
export default function Modal({
  isOpen = true,
  onClose,
  children,
  zIndexClass = "z-50",
  backdropClassName = "bg-black/50 backdrop-blur-sm",
  cardClassName = "w-full max-w-md rounded-lg bg-white p-6 shadow-xl",
  label,
  closeOnBackdrop = true,
  closeOnEscape = true,
}: ModalProps) {
  // Portal to <body> so the backdrop is always a top-level fixed layer. Mounted
  // deep in the tree, an ancestor's overflow/transform/stacking context can break
  // `position: fixed` and `backdrop-filter` (the blur silently fails). Rendering
  // into body sidesteps all of that. Client-only (modals only open on interaction).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, closeOnEscape, onClose]);

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
          className={cardClassName}
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
