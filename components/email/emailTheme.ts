/**
 * Styling guide for the email panel.
 *
 * Brand-first: Vierra purple (#701CC0) with the logo's purple gradient, solid surfaces over a
 * dark starfield canvas, and dense-but-readable mail typography.
 *
 * ## How to use this
 * Reach for a token before writing a raw Tailwind string. If a class string appears in more than
 * one place, it belongs here — that's how the panel drifted into a dozen near-identical button
 * styles in the first place. Compose tokens with `cn()` (lib/utils) when a call site needs extras:
 *
 *     <button className={cn(ICON_BUTTON, "text-red-600")} />
 *
 * Every token is a plain class string, so they work anywhere (panel, settings page, modals).
 */

/* ── Brand ──────────────────────────────────────────────────────────────────────────────── */

/** Brand logo assets (in /public/assets). */
export const BRAND_LOGO = {
  /** Full wordmark, dark — for light/frosted surfaces. */
  wordmarkDark: "/assets/vierra-logo-black.png",
  /** Full wordmark, white — for dark surfaces. */
  wordmarkLight: "/assets/vierra-logo.png",
  /** The wordmark used by the shared loading screen (inverted to white in CSS). */
  wordmarkLoader: "/assets/vierra-logo-black-3.png",
  /** Compact "V" mark. */
  mark: "/assets/vierra-v-2d.png",
} as const;

/** Core palette. Prefer these over inline hex so a brand tweak is a one-line change. */
export const COLORS = {
  brand: "#701CC0",
  brandDeep: "#5E17A8",
  brandLight: "#8B3BEE",
  canvas: "#18042a",
  ink: "#1E1B2E",
  inkMuted: "#4A465C",
  textMuted: "#6B7280",
  textSubtle: "#847FA0",
  hairline: "#EDEAF3",
  border: "#E5E7EB",
} as const;

/** Brand hero gradient (from the V logo). Use for primary CTAs. */
export const BRAND_GRADIENT = "linear-gradient(120deg,#7A17C5 0%,#A620AE 52%,#C42B9F 100%)";

/* ── Surfaces ───────────────────────────────────────────────────────────────────────────── */

/** Chrome surface (side rail) — a hair off-white so it reads as chrome vs. the content. */
export const GLASS_CHROME = "bg-[#FAFAFB] border border-[#EBEAF0]";

/** Content surface (list, reader, cards) — solid white for maximum readability on dense mail. */
export const GLASS_SURFACE = "bg-white border border-[#EBEAF0]";

/** Modal/dialog surface — solid white, clearly elevated so dialogs read as "on top". */
export const GLASS_MODAL =
  "bg-white border border-[#EBEAF0] shadow-[0_28px_70px_-24px_rgba(20,16,40,0.45)]";

/** Modal scrim — a clear dim so the dialog stands apart from the panel behind it. */
export const GLASS_SCRIM = "bg-[#14101E]/55";

/** Soft elevation used across cards/panels. */
export const SHADOW_SM = "shadow-[0_2px_12px_-4px_rgba(46,16,80,0.14)]";

/** Hairline divider between sections/rows. */
export const HAIRLINE = "border-[#EDEAF3]";

/* ── Buttons ────────────────────────────────────────────────────────────────────────────── */

/** Square icon-only button (toolbars, row actions). The panel's most repeated control. */
export const ICON_BUTTON =
  "inline-flex items-center justify-center rounded-lg border border-[#E5E7EB] p-2 text-sm text-[#374151] hover:bg-[#F9FAFB] disabled:opacity-50 disabled:cursor-not-allowed";

/** Icon button on a white toolbar (same shape, explicit white ground). */
export const ICON_BUTTON_SOLID =
  "p-2 rounded-lg border border-[#E5E7EB] bg-white text-[#374151] hover:bg-[#F3F4F6] disabled:opacity-50";

/** Borderless round icon button (compose chrome, Gmail-style). */
export const ICON_BUTTON_GHOST =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded text-[#5f6368] hover:bg-[#f1f3f4]";

/** Primary action. */
export const BUTTON_PRIMARY =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-[#701CC0] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#5E17A8] disabled:opacity-50 disabled:cursor-not-allowed";

/** Secondary / neutral action. */
export const BUTTON_SECONDARY =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-medium text-[#374151] transition-colors hover:bg-[#F9FAFB] disabled:opacity-50 disabled:cursor-not-allowed";

/** Small paging / compact control. */
export const BUTTON_COMPACT =
  "rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-1 text-xs text-[#374151] hover:bg-[#F3F4F6] disabled:opacity-50";

/** Destructive action. */
export const BUTTON_DANGER =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-[#DC2626] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#B91C1C] disabled:opacity-50";

/* ── Forms ──────────────────────────────────────────────────────────────────────────────── */

/** Field label sitting above an input. */
export const FIELD_LABEL = "mb-1 block text-sm font-medium text-[#374151]";

/** Text input / textarea / select. */
export const FIELD_INPUT =
  "w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#1E1B2E] outline-none transition focus:border-transparent focus:ring-2 focus:ring-[#701CC0]";

/** Inline search box (list toolbars). */
export const FIELD_SEARCH =
  "rounded-lg border border-transparent bg-white px-3 py-1.5 flex items-center gap-2 shadow-sm transition focus-within:ring-2 focus-within:ring-[#701CC0]";

/* ── Typography ─────────────────────────────────────────────────────────────────────────── */

/** Secondary body copy (descriptions, helper text). */
export const TEXT_MUTED = "text-sm text-[#6B7280]";

/** Emphasised body copy (names, values, row titles). */
export const TEXT_STRONG = "font-medium text-[#1E1B2E]";

/* ── Data display ───────────────────────────────────────────────────────────────────────── */

/** Uppercase micro-label used for table headers and stat captions. */
export const LABEL_MICRO = "text-[11px] font-semibold uppercase tracking-wide text-[#847FA0]";

/** Table header cell. */
export const TABLE_HEAD_CELL = "pb-2 text-left text-[10.5px] font-semibold uppercase tracking-wide text-[#847FA0]";

/** Table body row (hairline rule above). */
export const TABLE_ROW = "border-t border-[#F2EFF8]";

/** Pill/chip for statuses and tags. */
export const CHIP = "rounded-md px-2 py-1 text-xs font-medium";

/** Tonal chip variants, keyed by intent. */
export const CHIP_TONE = {
  brand: "bg-[#F5EFFF] text-[#701CC0]",
  success: "bg-[#ECFDF5] text-[#047857]",
  warning: "bg-[#FFFBEB] text-[#B45309]",
  danger: "bg-[#FEF2F2] text-[#B91C1C]",
  neutral: "bg-[#F4F2F8] text-[#5B5670]",
} as const;

/** Inline alert banners. */
export const ALERT = {
  error: "rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700",
  warning: "rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800",
  info: "rounded-lg border border-[#EBEAF0] bg-[#FAFAFB] px-4 py-3 text-sm text-[#6B7280]",
} as const;
