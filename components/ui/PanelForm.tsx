import React from "react"
import { FiChevronDown, FiX } from "react-icons/fi"

/**
 * The panel's modal form styling, in one place.
 *
 * Staff Orbital's invite dialog set the house style — filled fields, small caps labels, a header
 * with a close control, a right-aligned footer — and every other dialog was reimplementing some
 * of it by eye. These are those pieces, so a new dialog matches by importing rather than by
 * copying a class string and dropping half of it.
 */
export const PANEL_FIELD_BASE =
  "h-9 w-full rounded-[10px] px-3 text-[13px] text-[#111827] ring-1 ring-inset transition-shadow focus:outline-none"

export const PANEL_FIELD = `${PANEL_FIELD_BASE} bg-[#F4F2F8] ring-transparent focus:bg-white focus:ring-[#701CC0]/35`

/** The same field, flagged. Composed from the base rather than rewritten, which is how the text
 *  colour went missing the first time and left people typing white on near-white. */
export const PANEL_FIELD_INVALID = `${PANEL_FIELD_BASE} bg-red-50 ring-red-300 focus:ring-red-400`

export const PanelFieldLabel: React.FC<{
  children: React.ReactNode
  required?: boolean
  hint?: string
}> = ({ children, required = false, hint }) => (
  <label className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#8B8598]">
    {children}
    {required && <span className="text-[#B42318]"> *</span>}
    {hint && <span className="font-normal normal-case tracking-normal text-[#9CA3AF]"> ({hint})</span>}
  </label>
)

/** A select in the panel's field styling, with our chevron rather than the platform's. */
export const PanelFieldSelect: React.FC<{
  value: string
  onChange: (value: string) => void
  children: React.ReactNode
}> = ({ value, onChange, children }) => (
  <span className="relative block">
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={`${PANEL_FIELD} appearance-none pr-9`}
    >
      {children}
    </select>
    <FiChevronDown
      className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#9CA3AF]"
      aria-hidden
    />
  </span>
)

export const PanelModalHeader: React.FC<{ title: string; onClose: () => void }> = ({ title, onClose }) => (
  <header className="mb-5 flex items-center justify-between gap-4">
    <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-[#111827]">{title}</h2>
    <button
      type="button"
      onClick={onClose}
      aria-label="Close"
      className="rounded-lg p-2 text-[#6B7280] transition-colors hover:bg-red-50 hover:text-red-600"
    >
      <FiX className="h-5 w-5" />
    </button>
  </header>
)

export const PanelModalFooter: React.FC<{
  onCancel: () => void
  onConfirm: () => void
  confirmLabel: string
  cancelLabel?: string
  confirmDisabled?: boolean
}> = ({ onCancel, onConfirm, confirmLabel, cancelLabel = "Cancel", confirmDisabled = false }) => (
  <div className="mt-6 flex justify-end gap-2">
    <button
      type="button"
      onClick={onCancel}
      className="h-9 rounded-[10px] bg-[#F4F2F8] px-3.5 text-[13px] font-medium text-[#374151] transition-colors hover:bg-[#EAE6F3]"
    >
      {cancelLabel}
    </button>
    <button
      type="button"
      onClick={onConfirm}
      disabled={confirmDisabled}
      className="h-9 rounded-[10px] bg-[#701CC0] px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-[#5f17a5] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {confirmLabel}
    </button>
  </div>
)
