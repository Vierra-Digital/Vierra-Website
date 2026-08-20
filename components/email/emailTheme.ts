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

/* ── Surfaces ───────────────────────────────────────────────────────────────────────────── */

/** Content surface (list, reader, cards) — solid white for maximum readability on dense mail. */
export const GLASS_SURFACE = "bg-white border border-[#EBEAF0]";

/** Modal/dialog surface — solid white, clearly elevated so dialogs read as "on top". */
export const GLASS_MODAL =
  "bg-white border border-[#EBEAF0] shadow-[0_28px_70px_-24px_rgba(20,16,40,0.45)]";

/** Modal scrim — a clear dim so the dialog stands apart from the panel behind it. */
export const GLASS_SCRIM = "bg-[#14101E]/55";

/* ── Buttons ────────────────────────────────────────────────────────────────────────────── */

/** Square icon-only button (toolbars, row actions). The panel's most repeated control. */
export const ICON_BUTTON =
  "inline-flex items-center justify-center rounded-lg border border-[#E5E7EB] p-2 text-sm text-[#374151] hover:bg-[#F9FAFB] disabled:opacity-50 disabled:cursor-not-allowed";

/** Icon button on a white toolbar (same shape, explicit white ground). */
export const ICON_BUTTON_SOLID =
  "p-2 rounded-lg border border-[#E5E7EB] bg-white text-[#374151] hover:bg-[#F3F4F6] disabled:opacity-50";

/**
 * Reply / Reply all / Forward at the foot of an open message.
 *
 * Labelled rather than icon-only, because these sit with the message content instead of in a
 * toolbar where a row of glyphs is the convention. Outlined, so they read as available actions
 * without competing with the composer's filled Send.
 */
export const REPLY_ACTION_BUTTON =
  "email-reply-action inline-flex min-h-9 items-center gap-2 rounded-md px-4 text-[13px] font-medium transition-colors";

/** Primary action. */
export const BUTTON_PRIMARY =
  "inline-flex items-center justify-center rounded-xl bg-[#701CC0] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#5f17a5] disabled:cursor-not-allowed disabled:opacity-50";

/** Secondary / neutral action. */
export const BUTTON_SECONDARY =
  "inline-flex items-center justify-center rounded-xl border border-[#E5E7EB] bg-white px-3 py-1.5 text-sm font-medium text-[#374151] transition-colors hover:bg-[#F9FAFB]";

/** Outlined destructive action (inline row controls). */
export const BUTTON_DANGER_OUTLINE =
  "rounded-xl border border-red-200 px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50";

/* ── Forms ──────────────────────────────────────────────────────────────────────────────── */

/** Field label sitting above an input. */
export const FIELD_LABEL = "mb-1 block text-sm font-medium text-[#374151]";

/** Text input / textarea / select. */
export const FIELD_INPUT =
  "w-full rounded-xl border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm text-[#1E1B2E] placeholder-[#9CA3AF] focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#701CC0]";

/* ── Typography ─────────────────────────────────────────────────────────────────────────── */

/** Secondary body copy (descriptions, helper text). */
export const TEXT_MUTED = "text-sm text-[#6B7280]";

/** Emphasised body copy (names, values, row titles). */
export const TEXT_STRONG = "font-medium text-[#1E1B2E]";

/* ── Data display ───────────────────────────────────────────────────────────────────────── */

/** Inline alert banners. */
export const ALERT = {
  error: "rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700",
  warning: "rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800",
  info: "rounded-lg border border-[#EBEAF0] bg-[#FAFAFB] px-4 py-3 text-sm text-[#6B7280]",
} as const;
