"use client";
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { FiChevronDown, FiCheck } from "react-icons/fi";

/* Shared, theme-matched form controls used by the public modals
   (job application + free audit). White surface, purple accents. */

export const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-[15px] text-[#1A1033] placeholder-gray-400 shadow-sm outline-none transition-all duration-200 hover:border-gray-400 focus:border-[#701CC0] focus:ring-2 focus:ring-[#701CC0]/30";

export const labelClass = "mb-1.5 block text-sm font-medium text-[#3A3352]";

/** Lock body scroll while a modal is open, restoring the prior scroll position on close. */
export function useLockBodyScroll(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    const scrollY = window.scrollY;
    const body = document.body;
    const html = document.documentElement;
    const prev = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overflow: body.style.overflow,
    };
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    body.style.overflow = "hidden";
    return () => {
      // Disable smooth scroll-behavior so restoring the position is instant
      // (otherwise pages with `scroll-behavior: smooth` animate top → position).
      const prevScrollBehavior = html.style.scrollBehavior;
      html.style.scrollBehavior = "auto";
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.width = prev.width;
      body.style.overflow = prev.overflow;
      window.scrollTo(0, scrollY);
      requestAnimationFrame(() => {
        html.style.scrollBehavior = prevScrollBehavior;
      });
    };
  }, [locked]);
}

/** Format a US phone number as (123) 456-7890, digits only, capped at 10 digits. */
export function formatPhone(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 10);
  if (d.length === 0) return "";
  if (d.length < 4) return `(${d}`;
  if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

export const Field: React.FC<{
  label: string;
  htmlFor?: string;
  optional?: boolean;
  error?: string;
  children: React.ReactNode;
}> = ({ label, htmlFor, optional, error, children }) => (
  <div>
    <label htmlFor={htmlFor} className={labelClass}>
      {label}
      {optional && <span className="ml-1 font-normal text-gray-400">(Optional)</span>}
    </label>
    {children}
    {error && <p className="mt-1.5 text-xs text-red-500">{error}</p>}
  </div>
);

export const PrimaryButton: React.FC<{
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  children: React.ReactNode;
}> = ({ onClick, type = "button", disabled, children }) => (
  <motion.button
    type={type}
    onClick={onClick}
    disabled={disabled}
    whileHover={disabled ? undefined : { scale: 1.02 }}
    whileTap={disabled ? undefined : { scale: 0.98 }}
    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#701CC0] via-[#8F42FF] to-[#701CC0] animate-gradient px-6 py-2.5 text-sm font-medium text-white shadow-[0_6px_20px_-6px_rgba(112,28,192,0.6)] transition-all duration-200 hover:shadow-[0_8px_26px_-6px_rgba(112,28,192,0.7)] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
  >
    {children}
  </motion.button>
);

export interface SelectOption {
  value: string;
  label: string;
}

/**
 * Selectable button group (e.g. Yes / No). Each option is a pill that shows a
 * checkmark when chosen. Use for small option sets instead of a dropdown.
 */
export const OptionButtons: React.FC<{
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
}> = ({ value, onChange, options }) => (
  <div className="flex flex-wrap gap-2.5">
    {options.map((o) => {
      const active = value === o.value;
      return (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={active}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
            active
              ? "bg-[#701CC0]/10 text-[#701CC0] shadow-[0_4px_14px_-6px_rgba(112,28,192,0.5)]"
              : "bg-gray-100 text-[#3A3352] hover:bg-gray-200/70"
          }`}
        >
          <span
            className={`flex h-4 w-4 items-center justify-center rounded-full transition-colors ${
              active ? "bg-[#701CC0] text-white" : "bg-white"
            }`}
          >
            {active && <FiCheck className="h-2.5 w-2.5" strokeWidth={3} />}
          </span>
          {o.label}
        </button>
      );
    })}
  </div>
);

/**
 * Fully custom, theme-matched dropdown. Renders the option list in a portal so it
 * never gets clipped by the modal's scroll container, and closes on outside click,
 * scroll, or resize.
 */
export const ThemedSelect: React.FC<{
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  invalid?: boolean;
}> = ({ id, value, onChange, options, placeholder = "Select an option", invalid }) => {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ left: number; top: number; width: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const openMenu = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setCoords({ left: r.left, top: r.bottom + 6, width: r.width });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || listRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onReflow = () => setOpen(false);
    document.addEventListener("mousedown", onPointer);
    window.addEventListener("resize", onReflow);
    window.addEventListener("scroll", onReflow, true);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      window.removeEventListener("resize", onReflow);
      window.removeEventListener("scroll", onReflow, true);
    };
  }, [open]);

  const selected = options.find((o) => o.value === value);

  return (
    <>
      <button
        ref={btnRef}
        id={id}
        type="button"
        onClick={() => (open ? setOpen(false) : openMenu())}
        className={`${inputClass} flex items-center justify-between gap-2 text-left ${value ? "text-[#1A1033]" : "text-gray-400"} ${
          open ? "border-[#701CC0] bg-white ring-4 ring-[#701CC0]/10" : invalid ? "border-red-400" : "border-gray-200"
        }`}
      >
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#701CC0]/10 text-[#701CC0] transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        >
          <FiChevronDown className="h-3.5 w-3.5" />
        </span>
      </button>

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && coords && (
              <motion.ul
                ref={listRef}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.14, ease: "easeOut" }}
                style={{ position: "fixed", left: coords.left, top: coords.top, width: coords.width, zIndex: 300 }}
                className="max-h-60 overflow-auto rounded-xl border border-gray-100 bg-white p-1.5 shadow-[0_16px_40px_-12px_rgba(26,16,51,0.3)]"
              >
                {options.map((o) => {
                  const active = o.value === value;
                  return (
                    <li key={o.value}>
                      <button
                        type="button"
                        onClick={() => {
                          onChange(o.value);
                          setOpen(false);
                        }}
                        className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-[15px] transition-colors ${
                          active ? "bg-[#701CC0]/10 font-medium text-[#701CC0]" : "text-[#3A3352] hover:bg-gray-50"
                        }`}
                      >
                        <span className="truncate">{o.label}</span>
                        {active && <FiCheck className="h-4 w-4 shrink-0 text-[#701CC0]" />}
                      </button>
                    </li>
                  );
                })}
              </motion.ul>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
};
