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

/** Clean, solid surfaces (no frosted glass) — modern, high-contrast and easy to read. A
 *  hairline border gives crisp definition against the light page background. */
/** Chrome surface (side rail) — a hair off-white so it reads as chrome vs. the content. */
export const GLASS_CHROME = "bg-[#FAFAFB] border border-[#EBEAF0]";

/**
 * Content surface (list, reader, cards) — very slightly translucent so the starfield canvas
 * reads through as a faint tint, with a backdrop blur so dense mail stays crisp. Kept at 92%
 * (not lower) deliberately: the effective background stays near-white, so body text holds
 * comfortably above WCAG AA contrast.
 */
export const GLASS_SURFACE = "bg-white/[0.92] backdrop-blur-xl border border-[#EBEAF0]";

/** Modal/dialog surface — solid white, clearly elevated so dialogs read as "on top". */
export const GLASS_MODAL =
  "bg-white border border-[#EBEAF0] shadow-[0_28px_70px_-24px_rgba(20,16,40,0.45)]";

/** Modal scrim — a clear dim so the dialog stands apart from the panel behind it. */
export const GLASS_SCRIM = "bg-[#14101E]/55";

/** Soft elevation used across cards/panels. */
export const SHADOW_SM = "shadow-[0_2px_12px_-4px_rgba(46,16,80,0.14)]";
