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

/** Vibrant Vierra field the glass sits over — deeper purple→magenta so the frosting has real colour to refract. */
export const APP_BACKGROUND =
  "radial-gradient(1200px 720px at -4% -20%, #DAC4FF 0%, rgba(218,196,255,0) 52%)," +
  "radial-gradient(1120px 680px at 120% -10%, #F3CDE9 0%, rgba(243,205,233,0) 48%)," +
  "radial-gradient(1020px 900px at 50% 145%, #D2C6FF 0%, rgba(210,198,255,0) 58%)," +
  "linear-gradient(155deg,#EEE6FB 0%,#ECE9FC 46%,#F5E9FB 100%)";

/** Frosted glass chrome (rail, toolbars, overlays) — translucent + lavender-tinted so the brand field shows through; light-catching inset edge. */
export const GLASS_CHROME =
  "bg-gradient-to-b from-white/62 to-[#EDE3FF]/44 backdrop-blur-2xl backdrop-saturate-150 border border-white/55 ring-1 ring-inset ring-white/45";

/** Frosted-but-readable content surface (list, reader, cards) — solid enough for crisp text, with a glass edge. */
export const GLASS_SURFACE =
  "bg-gradient-to-b from-white/92 to-[#FBF9FF]/85 backdrop-blur-xl backdrop-saturate-150 border border-white/60 ring-1 ring-inset ring-white/50";

/** Glass modal/dialog surface. */
export const GLASS_MODAL =
  "bg-white/80 backdrop-blur-2xl backdrop-saturate-150 border border-white/80 shadow-[0_30px_70px_-20px_rgba(46,16,80,0.6)]";

/** Modal scrim. */
export const GLASS_SCRIM = "bg-[#2E1050]/25 backdrop-blur-sm";

/** Primary brand button (solid). */
export const BTN_PRIMARY =
  "bg-[#701CC0] hover:bg-[#5F17A5] text-white font-semibold rounded-xl shadow-[0_10px_22px_-8px_rgba(112,28,192,0.55)] transition";

/** Soft elevation used across cards/panels. */
export const SHADOW_SOFT = "shadow-[0_10px_40px_-12px_rgba(46,16,80,0.18)]";
export const SHADOW_SM = "shadow-[0_2px_12px_-4px_rgba(46,16,80,0.14)]";

/** Brand color tokens (hex) for inline styles / SVG. */
export const BRAND = {
  purple: "#701CC0",
  purple600: "#5F17A5",
  purple700: "#4C1D95",
  magenta: "#C42B9F",
  tint050: "#F5EFFF",
  tint100: "#ECE0FF",
  tint200: "#DEC9F6",
  ink: "#1E1B2E",
  ink2: "#4A465C",
  muted: "#847FA0",
  hair: "#EAE5F4",
} as const;
