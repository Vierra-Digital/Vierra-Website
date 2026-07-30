import { useEffect, useState } from "react";

type TimelineEvent = { type: string; at: string; label: string; detail?: string };

function iconFor(type: string): string {
  switch (type) {
    case "booking":
      return "📅";
    case "click":
      return "🔗";
    case "open":
      return "👁";
    case "read":
      return "✓";
    case "campaign":
      return "📨";
    default:
      return "✉️";
  }
}

/** Unified activity timeline for a contact (emails, opens/clicks, campaigns, bookings). */
export default function ContactTimelineModal({ email, onClose }: { email: string; onClose: () => void }) {
  const [events, setEvents] = useState<TimelineEvent[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/contacts/timeline?email=${encodeURIComponent(email)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled) setEvents(Array.isArray(d?.events) ? d.events : []);
      })
      .catch(() => {
        if (!cancelled) setEvents([]);
      });
    return () => {
      cancelled = true;
    };
  }, [email]);

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-[#1E1B2E]/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-[#ECEAF1] bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="truncate text-sm font-semibold text-[#1E1B2E]">Timeline · {email}</h3>
          <button type="button" onClick={onClose} className="shrink-0 text-[#847FA0] hover:text-[#1E1B2E]" aria-label="Close">
            ✕
          </button>
        </div>
        {events === null ? (
          <div className="py-8 text-center text-sm text-[#847FA0]">Loading…</div>
        ) : events.length === 0 ? (
          <div className="py-8 text-center text-sm text-[#847FA0]">No activity yet.</div>
        ) : (
          <ul className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
            {events.map((e, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-0.5 shrink-0" aria-hidden>
                  {iconFor(e.type)}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#1E1B2E]">{e.label}</p>
                  {e.detail ? <p className="truncate text-xs text-[#6B7280]">{e.detail}</p> : null}
                  <p className="text-[11px] text-[#9A93AE]">
                    {new Date(e.at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
