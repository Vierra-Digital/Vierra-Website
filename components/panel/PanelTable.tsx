"use client"

import React from "react"
import { ChevronDown, ChevronLeft, ChevronRight, Search } from "lucide-react"

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

/**
 * Page frame: gutters and max width. Deliberately not a scroll container.
 *
 * It used to be one — `flex-1 overflow-y-auto overflow-x-hidden` — nested inside #right-side-body
 * in pages/panel.tsx, which is already `h-full overflow-y-auto`. The inner box had no height to
 * resolve `h-full` against, so it collapsed to whatever the content currently measured, and
 * anything taller than that overflowed it: an open filter popover was cut off mid-list, and the
 * empty state was tall enough that switching between "no results" and results flashed a scrollbar
 * on and off. One scroller, owned by the panel.
 */
export const PanelPage: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="w-full bg-white text-[#111014]">
    <div className="px-8 lg:px-14 pt-1">
      <div className="mx-auto w-full max-w-[1680px] pb-16">{children}</div>
    </div>
  </div>
)

/**
 * Title and controls on one line. The title had been given a line of its own with the controls
 * stacked underneath, which cost a whole band of vertical space and left the search floating
 * with nothing to align to.
 */
export const PanelHeader: React.FC<{ title: string; children?: React.ReactNode }> = ({ title, children }) => (
  <div className="mt-8 mb-7 flex flex-wrap items-center justify-between gap-3">
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
  /* Filled, not outlined. A row of hairline boxes is the look this panel is moving away from;
     a tinted field reads as an input without drawing a rectangle around every control. */
  <div
    className={`${CONTROL_HEIGHT} flex items-center gap-2 rounded-[10px] bg-[#F4F2F8] px-3 ring-1 ring-inset ring-transparent transition-shadow focus-within:bg-white focus-within:ring-[#701CC0]/35 ${className}`}
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
    className={`${CONTROL_HEIGHT} inline-flex items-center gap-2 rounded-[10px] px-3.5 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
      variant === "primary"
        ? "bg-[#701CC0] text-white shadow-[0_1px_2px_rgba(112,28,192,0.35)] hover:bg-[#5f17a5]"
        : "bg-[#F4F2F8] text-[#374151] hover:bg-[#EAE6F3]"
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
    className={`absolute right-0 z-50 mt-2 rounded-xl border border-[#E4E0EC] bg-white p-4 shadow-[0_16px_40px_-12px_rgba(16,24,40,0.22)] ${className}`}
  >
    {children}
  </div>
)

/** Field styling shared by the panel's selects and text inputs, so they line up as a set. */
export const PANEL_FIELD =
  "h-9 w-full rounded-[10px] bg-[#F4F2F8] px-3 text-[13px] text-[#111827] ring-1 ring-inset ring-transparent transition-shadow focus:bg-white focus:outline-none focus:ring-[#701CC0]/35"

/**
 * A select with our own chevron.
 *
 * Left native, each select drew the platform's arrow at whatever inset the platform chose, so a
 * stack of them had arrows at different distances from the edge. `appearance-none` plus one
 * absolutely positioned icon puts every arrow in the same place.
 */
export const PanelSelect: React.FC<{
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
}> = ({ label, value, onChange, options }) => (
  <label className="mb-4 block last:mb-0">
    <span className="mb-1.5 block text-[11px] font-medium text-[#6B7280]">{label}</span>
    <span className="relative block">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${PANEL_FIELD} appearance-none pr-9`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#9CA3AF]"
        aria-hidden
      />
    </span>
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
 * Pagination: two chevrons and a position, centred in the card's footer.
 *
 * "‹ Previous  1 / 3  Next ›" spelled out in two directions what the arrows already say, and put
 * three text elements where the eye only needs one.
 */
export const PanelPagination: React.FC<{
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}> = ({ page, pageSize, total, onPageChange }) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const step = (delta: number) => onPageChange(Math.min(totalPages - 1, Math.max(0, page + delta)))
  const arrow =
    "inline-flex h-7 w-7 items-center justify-center rounded-md text-[#6B7280] transition-colors hover:bg-white hover:text-[#111827] disabled:pointer-events-none disabled:text-[#C7C4D2]"
  return (
    <div className="flex items-center justify-center gap-1 border-t border-[#EFECF4] bg-[#FCFBFE] px-6 py-3">
      <button type="button" onClick={() => step(-1)} disabled={page === 0} aria-label="Previous page" className={arrow}>
        <ChevronLeft className="h-4 w-4" aria-hidden />
      </button>
      <span className="min-w-[76px] text-center text-[12.5px] tabular-nums text-[#6B7280]">
        Page <span className="font-medium text-[#374151]">{page + 1}</span> of {totalPages}
      </span>
      <button
        type="button"
        onClick={() => step(1)}
        disabled={page >= totalPages - 1}
        aria-label="Next page"
        className={arrow}
      >
        <ChevronRight className="h-4 w-4" aria-hidden />
      </button>
    </div>
  )
}

/**
 * Reset control at the foot of a filter popover. It used to be a full-width button carrying its
 * own `border-t`, so the rule was part of the button and moved with its hover state.
 */
export const PanelClearFilters: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <div className="mt-1 border-t border-[#EFECF4] pt-3">
    <button
      type="button"
      onClick={onClick}
      className="h-8 w-full rounded-lg bg-[#F4F2F8] text-[12.5px] font-medium text-[#6B7280] transition-colors hover:bg-[#EAE6F3] hover:text-[#374151]"
    >
      Clear all filters
    </button>
  </div>
)

/**
 * Empty state, standing on its own rather than inside the table card. Drawing a bordered box
 * around an illustration and one line of text framed the absence of results as though it were
 * a result.
 */
export const PanelEmptyState: React.FC<{
  title: string
  message: string
  image?: React.ReactNode
  children?: React.ReactNode
}> = ({ title, message, image, children }) => (
  <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
    {image}
    <h3 className="mt-1 text-lg font-semibold text-[#111827]">{title}</h3>
    <p className="mt-2 max-w-md text-sm text-[#6B7280]">{message}</p>
    {children ? <div className="mt-4">{children}</div> : null}
  </div>
)

export type PanelColumn<T> = {
  key: string
  header: React.ReactNode
  cell: (row: T) => React.ReactNode
  /** Right-aligns both the heading and the cells — for action or numeric columns. */
  align?: "left" | "right"
  className?: string
}

/**
 * The list page itself: loading, empty, table, pagination.
 *
 * Every page repeated the same four branches around its own copy of the table markup, which is
 * how they drifted — one paginated inside the card and another below it, one showed an
 * illustration when empty and another a sentence. A page now supplies its columns and its rows;
 * the shape around them is decided once, here.
 *
 * Rows are sliced here too, so a page cannot paginate its display and count something else.
 */
export function PanelDataTable<T>({
  rows,
  columns,
  getRowKey,
  loading = false,
  loadingLabel,
  page,
  pageSize,
  onPageChange,
  emptyTitle,
  emptyMessage,
  emptyImage,
  emptyAction,
}: {
  rows: T[]
  columns: Array<PanelColumn<T>>
  getRowKey: (row: T) => string
  loading?: boolean
  loadingLabel?: React.ReactNode
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  emptyTitle: string
  emptyMessage: string
  emptyImage?: React.ReactNode
  emptyAction?: React.ReactNode
}) {
  if (loading) {
    return <div className="flex items-center justify-center py-12">{loadingLabel}</div>
  }
  if (rows.length === 0) {
    return (
      <PanelEmptyState title={emptyTitle} message={emptyMessage} image={emptyImage}>
        {emptyAction}
      </PanelEmptyState>
    )
  }

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
  // Clamped rather than reset: a filter that shrinks the list can leave the page index past the
  // end, and slicing beyond the array renders an empty table with no way to tell why.
  const safePage = Math.min(page, totalPages - 1)
  const visible = rows.slice(safePage * pageSize, (safePage + 1) * pageSize)

  return (
    <PanelCard>
      <PanelTable>
        <PanelThead>
          {columns.map((column) => (
            <PanelTh key={column.key} className={column.align === "right" ? "!text-right" : ""}>
              {column.header}
            </PanelTh>
          ))}
        </PanelThead>
        <PanelTbody>
          {visible.map((row) => (
            <PanelTr key={getRowKey(row)}>
              {columns.map((column) => (
                <PanelTd
                  key={column.key}
                  className={`${column.align === "right" ? "text-right" : ""} ${column.className ?? ""}`}
                >
                  {column.cell(row)}
                </PanelTd>
              ))}
            </PanelTr>
          ))}
        </PanelTbody>
      </PanelTable>
      <PanelPagination page={safePage} pageSize={pageSize} total={rows.length} onPageChange={onPageChange} />
    </PanelCard>
  )
}
