import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { FiCheck, FiChevronDown, FiSearch } from "react-icons/fi"

/**
 * A dropdown the panel draws itself.
 *
 * The native `<select>` was fine for four options and wrong for two hundred and fifty: its open
 * list is drawn by the operating system, so it ignores every colour, radius and font on the page,
 * and it offers no way to search — finding a country meant scrolling a platform list that looked
 * nothing like the panel around it.
 *
 * This is a listbox: the trigger matches the panel's field treatment, the list is the panel's own
 * popover, and anything over a dozen options gets a filter box. Keyboard support is the part a
 * custom control usually loses, so it is here deliberately — arrows move, Enter picks, Escape
 * closes, Home/End jump, and typing filters.
 */

export type ComboboxOption = {
  value: string
  label: string
  /** Heading this option sits under, the equivalent of an `<optgroup>` label. */
  group?: string
}

const TRIGGER_BASE =
  "flex h-9 w-full items-center justify-between gap-2 rounded-[10px] px-3 text-left text-[13px] ring-1 ring-inset transition-shadow focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
const TRIGGER_OK = "bg-[#F4F2F8] text-[#111827] ring-transparent hover:bg-[#EFEBF6] focus:bg-white focus:ring-[#701CC0]/35"
const TRIGGER_BAD = "bg-red-50 text-[#111827] ring-red-300 focus:ring-red-400"

/**
 * The same control on a dark surface.
 *
 * The settings page renders twice — once on the panel's light cards and once inside the email
 * panel, which is dark. A light-only dropdown would have been unreadable there, which is exactly
 * how the native `<select>` behaved, so the tone is part of the control rather than something
 * each caller patches over.
 */
const TRIGGER_DARK = "bg-white/10 text-white ring-white/20 hover:bg-white/15 focus:ring-[#A855F7]/50"

/** Above this many options the list is worth filtering rather than scrolling. */
const FILTER_THRESHOLD = 12

type Props = {
  id?: string
  value: string
  options: ComboboxOption[]
  onChange: (value: string) => void
  /** Shown when nothing is selected, and as the first row for clearing the choice. */
  placeholder?: string
  /** Set when the field is flagged, so the trigger matches the panel's invalid treatment. */
  invalid?: boolean
  disabled?: boolean
  /** Replaces the list when there is nothing to pick from. */
  emptyMessage?: string
  /** "dark" for the email panel's surface; the panel's light cards are the default. */
  tone?: "panel" | "dark"
  /** Rendered inside the trigger, before the label — the board picker's board icon, say. */
  leading?: React.ReactNode
  "aria-label"?: string
}

const PanelCombobox: React.FC<Props> = ({
  id,
  value,
  options,
  onChange,
  placeholder = "Not Set",
  invalid = false,
  disabled = false,
  emptyMessage = "Nothing to choose from.",
  tone = "panel",
  leading,
  "aria-label": ariaLabel,
}) => {
  const dark = tone === "dark"
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [active, setActive] = useState(0)
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null)

  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const listId = useId()

  const selected = options.find((o) => o.value === value) ?? null
  const showFilter = options.length > FILTER_THRESHOLD

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    // Anything containing the text, but a prefix match sorts first — typing "ind" should reach
    // India before Ireland, which merely contains the letters.
    const matches = options.filter((o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase() === q)
    // Grouped lists keep the order they were given: reordering by match quality would interleave
    // groups and strand their headings.
    if (matches.some((o) => o.group)) return matches
    return matches.sort((a, b) => {
      const ap = a.label.toLowerCase().startsWith(q) ? 0 : 1
      const bp = b.label.toLowerCase().startsWith(q) ? 0 : 1
      return ap - bp || a.label.localeCompare(b.label)
    })
  }, [options, query])

  /** Position against the trigger, measured before paint so the list never appears misplaced. */
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return
    const update = () => {
      const r = triggerRef.current!.getBoundingClientRect()
      setRect({ top: r.bottom + 6, left: r.left, width: r.width })
    }
    update()
    // The dialog this usually sits in scrolls, so the list has to follow rather than detach.
    window.addEventListener("scroll", update, true)
    window.addEventListener("resize", update)
    return () => {
      window.removeEventListener("scroll", update, true)
      window.removeEventListener("resize", update)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    // Opening resets the filter and points the highlight at what is already chosen.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuery("")
    const index = Math.max(0, options.findIndex((o) => o.value === value))
    setActive(index)
    // Focus the filter where there is one, so typing goes somewhere sensible immediately.
    const t = window.setTimeout(() => searchRef.current?.focus(), 0)
    return () => window.clearTimeout(t)
  }, [open, options, value])

  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (listRef.current?.contains(target) || triggerRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [open])

  /** Keep the highlighted row in view when the arrows walk past the edge. */
  useEffect(() => {
    if (!open) return
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" })
  }, [active, open])

  const pick = (option: ComboboxOption) => {
    onChange(option.value)
    setOpen(false)
    triggerRef.current?.focus()
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!open) {
      if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(event.key)) {
        event.preventDefault()
        setOpen(true)
      }
      return
    }
    if (event.key === "Escape") {
      event.preventDefault()
      setOpen(false)
      triggerRef.current?.focus()
      return
    }
    if (event.key === "Tab") {
      setOpen(false)
      return
    }
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setActive((i) => Math.min(i + 1, visible.length - 1))
      return
    }
    if (event.key === "ArrowUp") {
      event.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
      return
    }
    if (event.key === "Home") {
      event.preventDefault()
      setActive(0)
      return
    }
    if (event.key === "End") {
      event.preventDefault()
      setActive(Math.max(0, visible.length - 1))
      return
    }
    if (event.key === "Enter") {
      event.preventDefault()
      const option = visible[active]
      if (option) pick(option)
    }
  }

  const list =
    open && rect ? (
      <div
        ref={listRef}
        // Portalled to body: inside the dialog the list would be clipped by the card's own
        // overflow the moment it was longer than the space beneath the field.
        style={{ top: rect.top, left: rect.left, width: rect.width }}
        className={`fixed z-[400] overflow-hidden rounded-xl border shadow-[0_16px_40px_-12px_rgba(16,24,40,0.35)] ${
          dark ? "border-white/15 bg-[#2A0A47]" : "border-[#E4E0EC] bg-white"
        }`}
        onKeyDown={onKeyDown}
      >
        {showFilter && (
          <div className={`flex items-center gap-2 border-b px-3 ${dark ? "border-white/10" : "border-[#EEF1F7]"}`}>
            <FiSearch className="h-3.5 w-3.5 shrink-0 text-[#9CA3AF]" aria-hidden />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setActive(0)
              }}
              placeholder="Search"
              aria-label="Search options"
              className={`h-9 w-full bg-transparent text-[13px] focus:outline-none ${
                dark ? "text-white placeholder:text-white/40" : "text-[#111827] placeholder:text-[#9CA3AF]"
              }`}
            />
          </div>
        )}
        <div role="listbox" id={listId} aria-label={ariaLabel} className="max-h-[248px] overflow-y-auto py-1">
          {visible.length === 0 ? (
            <p className={`px-3 py-3 text-[13px] ${dark ? "text-white/60" : "text-[#6B7280]"}`}>
              {query ? "No matches." : emptyMessage}
            </p>
          ) : (
            visible.map((option, i) => {
              const isSelected = option.value === value
              // A heading whenever the group changes, so grouped lists read the way the grouped
              // selects they replaced did. Filtering can leave a group with one row, and the
              // heading still belongs above it.
              const heading =
                option.group && option.group !== visible[i - 1]?.group ? option.group : null
              return (
                <React.Fragment key={option.value || "__none"}>
                  {heading && (
                    <p
                      className={`px-3 pb-1 pt-2 text-[10.5px] font-semibold uppercase tracking-[0.06em] ${
                        dark ? "text-white/45" : "text-[#9CA3AF]"
                      }`}
                    >
                      {heading}
                    </p>
                  )}
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  data-index={i}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(option)}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[13px] transition-colors ${
                    dark
                      ? `${i === active ? "bg-white/10" : "bg-transparent"} ${
                          isSelected ? "font-medium text-[#D8B4FE]" : "text-white"
                        }`
                      : `${i === active ? "bg-[#F4F2F8]" : "bg-white"} ${
                          isSelected ? "font-medium text-[#5F17A5]" : "text-[#111827]"
                        }`
                  }`}
                >
                  <span className="truncate">{option.label}</span>
                  {isSelected && (
                    <FiCheck
                      className={`h-3.5 w-3.5 shrink-0 ${dark ? "text-[#C084FC]" : "text-[#701CC0]"}`}
                      aria-hidden
                    />
                  )}
                </button>
                </React.Fragment>
              )
            })
          )}
        </div>
      </div>
    ) : null

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        className={`${TRIGGER_BASE} ${invalid ? TRIGGER_BAD : dark ? TRIGGER_DARK : TRIGGER_OK}`}
      >
        <span className="flex min-w-0 items-center gap-2">
          {leading}
          <span className={`truncate ${selected ? "" : dark ? "text-white/45" : "text-[#9CA3AF]"}`}>
            {selected ? selected.label : placeholder}
          </span>
        </span>
        <FiChevronDown
          className={`h-3.5 w-3.5 shrink-0 transition-transform ${
            dark ? "text-white/55" : "text-[#9CA3AF]"
          } ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {typeof document !== "undefined" && list ? createPortal(list, document.body) : null}
    </>
  )
}

export default PanelCombobox
