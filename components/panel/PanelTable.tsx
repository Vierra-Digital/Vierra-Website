"use client"

import React from "react"
import { ChevronLeft, ChevronRight, Search } from "lucide-react"

/**
 * The shared furniture for a panel list page — page header, toolbar controls, table card,
 * pagination.
 *
 * Every list page had been restyled on its own, so Clients, Staff Orbital and User Management
 * each ended up with a different search field, a different button height, a different table
 * card and a different pagination block. Nothing was individually wrong; together they read as
 * a page assembled from spare parts. These are the pieces they share, so a change to the
 * language happens once.
 *
 * Every toolbar control is CONTROL_HEIGHT tall, which is what makes a row of them look like a
 * row rather than a pile.
 */

const CONTROL_HEIGHT = "h-9"

/** Page frame: the scroll container, gutters and max width every list page sits in. */
export const PanelPage: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="w-full h-full bg-white text-[#111014] flex flex-col">
    <div className="flex-1 px-8 lg:px-14 pt-1 overflow-y-auto overflow-x-hidden">
      <div className="mx-auto w-full max-w-[1680px] flex flex-col h-full pb-16">{children}</div>
    </div>
  </div>
)

/**
 * Title and controls on one line. The title had been given a line of its own with the controls
 * stacked underneath, which cost a whole band of vertical space and left the search floating
 * with nothing to align to.
 */
export const PanelHeader: React.FC<{ title: string; children?: React.ReactNode }> = ({ title, children }) => (
  <div className="mt-8 mb-5 flex flex-wrap items-center justify-between gap-3">
    <h1 className="text-[30px] leading-[1.15] font-semibold tracking-[-0.025em] text-[#111827]">{title}</h1>
    {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
  </div>
)

export const PanelSearch: React.FC<{
  id: string
  label: string
  placeholder: string
  value: string
  onChange: (value: string) => void
  className?: string
}> = ({ id, label, placeholder, value, onChange, className = "w-56 lg:w-72" }) => (
  <div
    className={`${CONTROL_HEIGHT} flex items-center gap-2 rounded-lg border border-[#E4E0EC] bg-white px-3 transition-colors focus-within:border-[#701CC0] ${className}`}
  >
    <Search className="h-4 w-4 shrink-0 text-[#9CA3AF]" aria-hidden />
    <label htmlFor={id} className="sr-only">
      {label}
    </label>
    <input
      id={id}
      type="search"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="w-full bg-transparent text-[13px] text-[#111827] outline-none placeholder:text-[#9CA3AF]"
    />
  </div>
)

type ButtonProps = {
  onClick?: () => void
  children: React.ReactNode
  icon?: React.ReactNode
  variant?: "secondary" | "primary"
  disabled?: boolean
  type?: "button" | "submit"
  title?: string
}

export const PanelButton: React.FC<ButtonProps> = ({
  onClick,
  children,
  icon,
  variant = "secondary",
  disabled = false,
  type = "button",
  title,
}) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={`${CONTROL_HEIGHT} inline-flex items-center gap-2 rounded-lg px-3.5 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
      variant === "primary"
        ? "bg-[#701CC0] text-white hover:bg-[#5f17a5]"
        : "border border-[#E4E0EC] bg-white text-[#374151] hover:border-[#D6CFE4] hover:bg-[#FAF9FD]"
    }`}
  >
    {icon ? <span className="inline-flex h-4 w-4 items-center justify-center">{icon}</span> : null}
    {children}
  </button>
)

/** The popover a toolbar dropdown (Filter, and anything like it) hangs under. */
export const PanelPopover: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = "w-72",
}) => (
  <div
    className={`absolute right-0 z-50 mt-2 rounded-xl border border-[#E4E0EC] bg-white p-4 shadow-[0_16px_40px_-12px_rgba(16,24,40,0.25)] ${className}`}
  >
    {children}
  </div>
)

export const PanelSelect: React.FC<{
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
}> = ({ label, value, onChange, options }) => (
  <label className="mb-4 block last:mb-0">
    <span className="mb-1.5 block text-[11px] font-medium text-[#6B7280]">{label}</span>
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-9 w-full rounded-lg border border-[#E4E0EC] bg-white px-3 text-[13px] text-[#111827] focus:border-[#701CC0] focus:outline-none focus:ring-2 focus:ring-[#701CC0]/20"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </label>
)

/**
 * The table card. `overflow-hidden` is load-bearing: without it the white table spills over the
 * rounded corners and the radius only shows on the header strip.
 */
export const PanelCard: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="overflow-hidden rounded-2xl border border-[#E4E0EC] bg-white">{children}</div>
)

export const PanelTable: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="overflow-x-auto">
    <table className="w-full">{children}</table>
  </div>
)

/**
 * `whitespace-nowrap` so a two-word heading cannot wrap and make one header cell taller than the
 * rest — which is what made the header strip look crooked next to "Company Email".
 */
export const PanelTh: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = "" }) => (
  <th
    className={`whitespace-nowrap px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-[#6B7280] first:pl-6 last:pr-6 ${className}`}
  >
    {children}
  </th>
)

export const PanelTd: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = "" }) => (
  <td className={`px-5 py-4 text-[13px] text-[#111827] first:pl-6 last:pr-6 ${className}`}>{children}</td>
)

export const PanelThead: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <thead className="border-b border-[#E4E0EC] bg-[#F7F5FB]">
    <tr>{children}</tr>
  </thead>
)

export const PanelTbody: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <tbody className="divide-y divide-[#EFECF4] bg-white">{children}</tbody>
)

export const PanelTr: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <tr className="transition-colors hover:bg-[#F9F7FD]">{children}</tr>
)

/** A muted em-dash, so an empty cell reads as "nothing here" rather than as a rendering fault. */
export const PanelEmptyCell: React.FC = () => <span className="text-[#B9B4C6]">—</span>

type BadgeTone = "neutral" | "positive" | "warning" | "danger" | "info" | "accent"

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: "bg-[#F3F1F8] text-[#5B5468]",
  positive: "bg-[#E7F7EE] text-[#11734B]",
  warning: "bg-[#FDF3E2] text-[#8A5A00]",
  danger: "bg-[#FDECEC] text-[#B42318]",
  info: "bg-[#EAF1FE] text-[#1D4FBF]",
  accent: "bg-[#F2E9FE] text-[#5F17A5]",
}

export const PanelBadge: React.FC<{ tone?: BadgeTone; icon?: React.ReactNode; children: React.ReactNode }> = ({
  tone = "neutral",
  icon,
  children,
}) => (
  <span
    className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-medium ${BADGE_TONES[tone]}`}
  >
    {icon}
    {children}
  </span>
)

/**
 * Pagination as a footer inside the card, centred. It used to hang below the table joined to it
 * by nothing but margin; the row count that sat opposite the controls has gone, since the table
 * above it is the count.
 */
export const PanelPagination: React.FC<{
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}> = ({ page, pageSize, total, onPageChange }) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  return (
    <div className="flex items-center justify-center border-t border-[#EFECF4] bg-[#FCFBFE] px-6 py-3.5">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(0, page - 1))}
          disabled={page === 0}
          aria-label="Previous page"
          className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-medium text-[#374151] transition-colors hover:bg-white disabled:pointer-events-none disabled:opacity-40"
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
          Previous
        </button>
        <span className="px-1 text-[12.5px] tabular-nums text-[#6B7280]">
          {page + 1} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages - 1, page + 1))}
          disabled={page >= totalPages - 1}
          aria-label="Next page"
          className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-medium text-[#374151] transition-colors hover:bg-white disabled:pointer-events-none disabled:opacity-40"
        >
          Next
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    </div>
  )
}

/** Empty state, sized to sit inside the card rather than replacing it. */
export const PanelEmptyState: React.FC<{ message: string; image?: React.ReactNode; children?: React.ReactNode }> = ({
  message,
  image,
  children,
}) => (
  <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
    {image}
    <p className="text-[13px] text-[#6B7280]">{message}</p>
    {children}
  </div>
)
