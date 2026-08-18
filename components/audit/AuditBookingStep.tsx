import { useState } from "react";
import { motion } from "framer-motion";
import { useBookingSlots, bookSlot } from "@/lib/booking/useBookingSlots";
import SlotCalendar from "@/components/booking/SlotCalendar";
import { inter } from "@/lib/fonts";
import { track } from "@/lib/track";

export const AUDIT_CALL_BOOKING_SLUG = process.env.NEXT_PUBLIC_AUDIT_CALL_BOOKING_SLUG || "audit-call";
// Matches the server-side window for this slug (see BOOKING_LINKS_UNBOUNDED_WINDOW in
// pages/api/booking/[id]/slots.ts) — the server won't return slots past its own cap regardless
// of what's requested here, but requesting less than it allows would just re-impose a shorter
// window client-side for no reason.
const DAYS_AHEAD = 365;

type AuditBookingStepProps = {
  prefill: { name: string; email: string; notes?: string };
  onBooked: (when: string) => void;
};

export default function AuditBookingStep({ prefill, onBooked }: AuditBookingStepProps) {
  const booking = useBookingSlots(AUDIT_CALL_BOOKING_SLUG, DAYS_AHEAD);
  // TODO(audit-call-booking): a missing/misconfigured BookingLink (404 on the slots fetch —
  // `notFound`) and a real link with zero open slots both land here as an empty
  // `slotsByDay`, and both get the same "send us your availability" fallback below rather
  // than a distinct broken-link error. Once the real Vierra Meeting Link is provisioned
  // (Phase 0) and this stops being the common case in every environment, decide whether a
  // *genuinely* broken link still deserves its own error state instead of sharing this one.
  const { loading, slotsByDay, selected, setSelected } = booking;

  const [notes, setNotes] = useState(prefill.notes || "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const confirm = async () => {
    if (!selected || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const when = await bookSlot({
        slug: AUDIT_CALL_BOOKING_SLUG,
        start: selected,
        inviteeName: prefill.name,
        inviteeEmail: prefill.email,
        notes: notes.trim(),
      });
      onBooked(when);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not book that time. Please try another slot.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-14">
        <div className="h-9 w-9 rounded-full border-4 border-[#E9D4FB] border-t-[#701CC0] motion-safe:animate-spin" />
      </div>
    );
  }

  return (
    <div className={inter.className}>
      <p className="text-[#6B7280] mb-1 text-[15px]">
        Pick a time that works and we&apos;ll send a calendar invite with the video link to{" "}
        <span className="font-medium text-[#1A1033]">{prefill.email}</span>.
      </p>

      {selected ? (
        <div className="mt-5">
          <button
            type="button"
            onClick={() => setSelected("")}
            className="mb-3 text-xs font-semibold text-[#701CC0] hover:underline"
          >
            ← Choose a different time
          </button>
          <p className="text-sm font-medium text-[#1E1B2E]">
            {new Date(selected).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })} at{" "}
            {new Date(selected).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
          </p>
          <div className="mt-3 space-y-2 border-t border-[#EEF0F4] pt-4">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything to share before the call? (optional)"
              rows={2}
              className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-[#701CC0]"
            />
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <motion.button
              type="button"
              onClick={confirm}
              disabled={submitting}
              whileHover={submitting ? undefined : { scale: 1.02 }}
              whileTap={submitting ? undefined : { scale: 0.98 }}
              className="w-full rounded-lg bg-gradient-to-r from-[#701CC0] to-[#8F42FF] py-2.5 text-sm font-semibold text-white shadow-[0_6px_20px_-6px_rgba(112,28,192,0.6)] transition-all duration-200 hover:shadow-[0_8px_26px_-6px_rgba(112,28,192,0.7)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Booking…" : `Confirm for ${prefill.name.split(" ")[0] || "you"}`}
            </motion.button>
          </div>
        </div>
      ) : slotsByDay.size === 0 ? (
        <AvailabilityNoteFallback prefill={prefill} />
      ) : (
        <SlotCalendar state={booking} onSelectTime={setSelected} />
      )}
    </div>
  );
}

/**
 * Shown in place of the calendar when there are no open slots to pick from (see the TODO
 * above). Rather than leaving the visitor stuck looking at an empty calendar, let them leave
 * their availability for sales to follow up with directly.
 */
function AvailabilityNoteFallback({ prefill }: { prefill: { name: string; email: string; notes?: string } }) {
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const send = async () => {
    if (!note.trim() || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/audit/availabilityNote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: prefill.name, email: prefill.email, note: note.trim(), context: prefill.notes }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.message || "Could not send that. Please try again.");
      }
      setSent(true);
      track("audit_availability_note_sent");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send that. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <p className="mt-5 text-sm text-[#1E1B2E]">
        Thanks — we&apos;ll reach out to <span className="font-medium">{prefill.email}</span> to find a time that works.
      </p>
    );
  }

  return (
    <div className="mt-5">
      <p className="text-sm text-[#6B7280]">No open times right now. Let us know what works for you instead, and we&apos;ll reach out to schedule directly.</p>
      <div className="mt-3 space-y-2">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Weekday afternoons EST work best for me"
          rows={3}
          className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-[#701CC0]"
        />
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <motion.button
          type="button"
          onClick={send}
          disabled={submitting || !note.trim()}
          whileHover={submitting || !note.trim() ? undefined : { scale: 1.02 }}
          whileTap={submitting || !note.trim() ? undefined : { scale: 0.98 }}
          className="w-full rounded-lg bg-gradient-to-r from-[#701CC0] to-[#8F42FF] py-2.5 text-sm font-semibold text-white shadow-[0_6px_20px_-6px_rgba(112,28,192,0.6)] transition-all duration-200 hover:shadow-[0_8px_26px_-6px_rgba(112,28,192,0.7)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Sending…" : "Send our team your availability"}
        </motion.button>
      </div>
    </div>
  );
}
