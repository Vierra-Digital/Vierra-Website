import { useState } from "react";
import { m as motion } from "framer-motion";
import {
  useBookingSlots,
  bookSlot,
  formatLocalDateTime,
  detectBrowserTimeZone,
  COMMON_TIMEZONES,
  BookingConflictError,
  type BookingConfirmation,
} from "@/lib/booking/useBookingSlots";
import SlotCalendar from "@/components/booking/SlotCalendar";
import { inter } from "@/lib/fonts";
import { track } from "@/lib/track";
import { inputClass } from "@/components/ui/modalForm";

export const AUDIT_CALL_BOOKING_SLUG = process.env.NEXT_PUBLIC_AUDIT_CALL_BOOKING_SLUG || "audit-call";
// A year-out horizon didn't make sense for a call this short-notice, and it's what pushed every
// slots fetch over Google's freeBusy ~3-month range cap (see the fail-closed handling and
// getBusyOverRange in lib/calendar/googleCalendar.ts) — 3 weeks stays well under both the
// business need and that limit. This slug stays in BOOKING_LINKS_UNBOUNDED_WINDOW (.env) despite
// the name: at 7 days/week x 32 fifteen-minute slots/day, the default 200-slot cap that env var
// also lifts would otherwise truncate the picker to under a week, well short of the 21 requested.
const DAYS_AHEAD = 21;

type AuditBookingStepProps = {
  prefill: { name: string; email: string; notes?: string };
  onBooked: (confirmation: BookingConfirmation) => void;
};

export default function AuditBookingStep({ prefill, onBooked }: AuditBookingStepProps) {
  const [timezone, setTimezone] = useState(detectBrowserTimeZone);
  const timezoneOptions = Array.from(new Set([timezone, ...COMMON_TIMEZONES]));
  const booking = useBookingSlots(AUDIT_CALL_BOOKING_SLUG, DAYS_AHEAD, timezone);
  // TODO(audit-call-booking): a missing/misconfigured BookingLink (404 on the slots fetch —
  // `notFound`) and a real link with zero open slots both land here as an empty
  // `slotsByDay`, and both get the same "send us your availability" fallback below rather
  // than a distinct broken-link error. Once the real Vierra Meeting Link is provisioned
  // (Phase 0) and this stops being the common case in every environment, decide whether a
  // *genuinely* broken link still deserves its own error state instead of sharing this one.
  const { loading, data, slotsByDay, selected, setSelected, refetch } = booking;

  const [notes, setNotes] = useState(prefill.notes || "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const confirm = async () => {
    if (!selected || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const result = await bookSlot({
        slug: AUDIT_CALL_BOOKING_SLUG,
        start: selected,
        inviteeName: prefill.name,
        inviteeEmail: prefill.email,
        notes: notes.trim(),
      });
      onBooked({
        when: formatLocalDateTime(selected, timezone),
        startIso: selected,
        durationMinutes: data?.durationMinutes || 30,
        title: data?.title || "Vierra Audit Call",
        id: result.id,
        joinUrl: result.joinUrl,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not book that time. Please try another slot.");
      // A 409 means the picker's slot list is stale (someone else booked it, or it was taken in
      // another tab) — refetch so the dead slot disappears instead of leaving the visitor to
      // retry the same time and get the same error again.
      if (e instanceof BookingConflictError) refetch();
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
      {data ? (
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-[#9A93AE]">
          <span>{data.durationMinutes} minutes · times shown in</span>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            aria-label="Timezone"
            className="rounded border border-[#E5E7EB] bg-white px-1 py-0.5 text-xs text-[#4A465C] outline-none focus:border-[#701CC0]"
          >
            {timezoneOptions.map((tz) => (
              <option key={tz} value={tz}>
                {tz.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {selected ? (
        <div className="mt-5">
          <button
            type="button"
            onClick={() => setSelected("")}
            className="mb-3 text-xs font-semibold text-[#701CC0] hover:underline"
          >
            ← Choose a different time
          </button>
          <p className="text-sm font-medium text-[#1E1B2E]">{formatLocalDateTime(selected, timezone)}</p>
          <div className="mt-3 space-y-2 border-t border-[#EEF0F4] pt-4">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything to share before the call? (optional)"
              rows={2}
              className={`${inputClass} text-sm`}
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
          className={`${inputClass} text-sm`}
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
