import React from "react";
import dynamic from "next/dynamic";

// Lazy-load the compose editor (~13 @tiptap/* packages — a real chunk of the panel's Script
// Evaluation time) so it's fetched/parsed/evaluated only when the user actually opens
// compose/reply. Shared by ComposeWindow and InlineReply so both use the same lazy chunk rather
// than each wrapping their own dynamic() copy of it.
export const ComposeRichEditor = dynamic(() => import("@/components/email/ComposeRichEditor"), {
  ssr: false,
  loading: () => (
    <div className="h-full min-h-[200px] flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-4 border-[#E9D4FB] border-t-[#701CC0] motion-safe:animate-spin" />
    </div>
  ),
});

/** Format a Date as a `<input type="datetime-local">` value in the viewer's local timezone. */
export function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// Client-side cap on total compose attachment bytes. Kept conservative (below the server/platform
// request-body limit) so oversized sends fail fast with a clear message instead of an opaque 413.
/**
 * Total attachment bytes accepted before sending, measured decoded.
 *
 * The ceiling is the serverless request-body limit, not Gmail: API routes run as functions with a
 * 6 MB payload cap, and base64 inflates a file by a third, so 4 MB of files is about 5.4 MB on the
 * wire with room for the rest of the JSON. This was 20 MB — which encodes to roughly 27 MB — so a
 * large attachment passed this check and then failed at the platform, surfacing as a bare
 * "Failed to send." with nothing pointing at the size.
 */
export const MAX_TOTAL_ATTACHMENT_BYTES = 4 * 1024 * 1024;

/**
 * "Help me write" bolt. The stroke draws itself on a loop rather than pulsing a filled glyph —
 * a filled icon can only fade or scale, which reads as a notification badge, not as writing.
 * Drafting speeds the draw up and brightens it.
 */
export const BoltDraw: React.FC<{ className?: string; drafting?: boolean }> = ({ className, drafting }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden focusable="false">
    <path
      d="M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12l1-8.5Z"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={drafting ? "bolt-draw is-drafting" : "bolt-draw"}
    />
  </svg>
);

/** Google Drive mark, inline so the button carries the real logo without a remote fetch. */
export const DriveMark: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 87.3 78" className={className} aria-hidden focusable="false">
    <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da" />
    <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47" />
    <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335" />
    <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d" />
    <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc" />
    <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00" />
  </svg>
);

/**
 * Compose footer icon button. Gmail's composer is one row of quiet, chrome-less icons with a
 * single solid Send — so an "on" toggle (Confidential, Receipt, a set schedule) reads as a soft
 * brand-tinted disc rather than an outlined box, which is what made the old bar look blocky.
 */
export const composeIconClass = (active = false) =>
  `inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors duration-150 disabled:pointer-events-none disabled:opacity-35 ${
    active ? "bg-[#701CC0]/18 text-[#C8A6F5]" : "text-[#9C95B8] hover:bg-white/[0.07] hover:text-[#E7E2F5]"
  }`;

/** Row in the compose "More options" menu. */
export const composeMenuItemClass =
  "flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] font-medium text-[#D8D3EA] transition-colors duration-150 hover:bg-white/[0.06] disabled:pointer-events-none disabled:opacity-40";
