/**
 * Shared design tokens for the email panel redesign (Phase 1).
 *
 * Brand-first: Vierra purple (#701CC0) with the logo's purple→magenta gradient,
 * frosted-glass chrome over a soft purple field, solid-enough content surfaces
 * for readable dense mail. Skills (UI/UX Pro Max, Web Design Guidelines) informed
 * the recipe; the Vierra brand wins wherever they'd conflict.
 *
 * These are reusable Tailwind class strings so the look stays consistent as the
 * monolith is decomposed into components.
 */

/** Brand logo assets (in /public/assets). */
export const BRAND_LOGO = {
  /** Full wordmark, dark — for light/frosted surfaces. */
  wordmarkDark: "/assets/vierra-logo-black.png",
  /** Full wordmark, white — for dark surfaces (dark mode). */
  wordmarkLight: "/assets/vierra-logo.png",
  /** Compact "V" mark. */
  mark: "/assets/vierra-v-2d.png",
} as const;

/** Brand hero gradient (from the V logo: purple → magenta). Use for primary CTAs. */
export const BRAND_GRADIENT = "linear-gradient(120deg,#7A17C5 0%,#A620AE 52%,#C42B9F 100%)";

/** Unified frosted-glass surface — the sidebar, content pane, and their headers all use
 *  this same recipe so the three areas read as one cohesive glass system. */
const GLASS_BASE =
  "bg-[#F9FAFBE6] backdrop-blur-xl backdrop-saturate-150";

/** Chrome surface (side rail). */
export const GLASS_CHROME = GLASS_BASE;

/** Content surface (list, reader, cards). Same recipe as the chrome — kept synced. */
export const GLASS_SURFACE = GLASS_BASE;

/** Modal/dialog surface — mostly-opaque frosted white. */
export const GLASS_MODAL =
  "bg-white/90 backdrop-blur-2xl border border-white/70 shadow-[0_24px_60px_-20px_rgba(30,27,46,0.28)]";

/** Modal scrim. */
export const GLASS_SCRIM = "bg-[#1E1B2E]/25 backdrop-blur-sm";

/** Soft elevation used across cards/panels. */
export const SHADOW_SM = "shadow-[0_2px_12px_-4px_rgba(46,16,80,0.14)]";
