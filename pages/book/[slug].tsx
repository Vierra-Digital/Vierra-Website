import { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";

type SlotsResponse = { title: string; description: string | null; durationMinutes: number; slots: string[] };

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
// Must match the `days` query param on the slots fetch below — the calendar can only page
// through months that are actually within the fetched window.
const DAYS_AHEAD = 60;

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function BookingPage() {
  const router = useRouter();
  const slug = typeof router.query.slug === "string" ? router.query.slug : "";
  // Optional campaign-contact attribution, carried through from the email that linked here
  // (see components/PanelPages/EmailingPlatformSection.tsx's "Insert booking link"). Absent for
  // plain shared booking-page links — booking still works identically either way.
  const ref = typeof router.query.ref === "string" ? router.query.ref : "";
  const [data, setData] = useState<SlotsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string>("");
  const [viewMonth, setViewMonth] = useState<Date | null>(null);
  const [selected, setSelected] = useState<string>("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState<string>("");

  useEffect(() => {
    if (!slug) return;
    // Entering the loading state for a fetch this effect performs; slug is a route parameter, so the
    // request cannot be made any earlier.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    // Request the max window (default endpoint window is only 14 days) so the calendar's
    // month navigation has more than a couple weeks of real data to page through.
    fetch(`/api/booking/${encodeURIComponent(slug)}/slots?days=${DAYS_AHEAD}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: SlotsResponse) => setData(d))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  const slotsByDay = useMemo(() => {
    const groups = new Map<string, string[]>();
    for (const iso of data?.slots || []) {
      const key = dayKey(new Date(iso));
      const arr = groups.get(key) || [];
      arr.push(iso);
      groups.set(key, arr);
    }
    return groups;
  }, [data]);

  // Default to the first day/month that actually has open slots, once they load. Guarded on
  // viewMonth (not selectedDay) so this only ever runs once: goToMonth intentionally clears
  // selectedDay when paging between months, and keying this off selectedDay meant that clearing
  // it re-armed this effect, which then snapped viewMonth straight back to the first month —
  // i.e. every month-navigation click silently undid itself on the next render.
  useEffect(() => {
    if (viewMonth || slotsByDay.size === 0) return;
    const firstKey = [...slotsByDay.keys()].sort()[0];
    const [y, m, d] = firstKey.split("-").map(Number);
    // Picks a sensible default day once the slots arrive: the earliest one that has any. Only ever runs
    // while viewMonth is unset, per the guard above, so a month the visitor navigated to is never
    // overwritten — see the note above for the bug that caused.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedDay(firstKey);
    setViewMonth(new Date(y, m - 1, d));
  }, [slotsByDay, viewMonth]);

  // Bounded by the actual fetched window (today .. today+DAYS_AHEAD), not by which months
  // happen to contain an open slot — a month with zero open slots (fully booked, or outside
  // the host's availability days) should still be reachable, just showing an empty grid,
  // rather than making "next month" look broken.
  const monthRange = useMemo(() => {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + DAYS_AHEAD);
    return { min: new Date(now.getFullYear(), now.getMonth(), 1), max: new Date(end.getFullYear(), end.getMonth(), 1) };
  }, []);

  const calendarWeeks = useMemo(() => {
    if (!viewMonth) return [];
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startWeekday = new Date(year, month, 1).getDay();
    const cells: (Date | null)[] = [...Array(startWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1))];
    while (cells.length % 7 !== 0) cells.push(null);
    const weeks: (Date | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return weeks;
  }, [viewMonth]);

  const todayKey = dayKey(new Date());
  const canGoPrevMonth = Boolean(viewMonth && monthKey(viewMonth) > monthKey(monthRange.min));
  const canGoNextMonth = Boolean(viewMonth && monthKey(viewMonth) < monthKey(monthRange.max));

  const goToMonth = (offset: number) => {
    if (!viewMonth) return;
    setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + offset, 1));
    // The previously selected day may not even be visible in the new month — clear it so the
    // right-hand panel doesn't keep showing times for a day that's no longer on screen.
    setSelectedDay("");
  };

  const dayTimes = selectedDay ? slotsByDay.get(selectedDay) || [] : [];
  const selectedDayLabel = selectedDay
    ? new Date(`${selectedDay}T00:00:00`).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })
    : "Pick a day";

  const book = async () => {
    if (!selected || !name.trim() || !email.trim() || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/booking/${encodeURIComponent(slug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start: selected, inviteeName: name.trim(), inviteeEmail: email.trim(), notes: notes.trim(), ref }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.message || "Could not book that time.");
      setConfirmed(payload?.when || "your selected time");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not book.");
    } finally {
      setSubmitting(false);
    }
  };

  const picking = !loading && !notFound && !confirmed && !selected;
  const cardWidth = picking ? "max-w-4xl" : "max-w-lg";

  return (
    <>
      <Head>
        <title>{data?.title ? `Book — ${data.title}` : "Book a meeting"}</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <div
        className="flex min-h-screen items-center justify-center p-4"
        style={{ background: "radial-gradient(120% 120% at 50% -10%, #2e0a4f 0%, #1b0833 45%, #0d0119 100%)" }}
      >
        <div className={`w-full ${cardWidth} rounded-2xl border border-white/10 bg-white p-8 shadow-2xl transition-[max-width]`}>
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="h-9 w-9 rounded-full border-4 border-[#E9D4FB] border-t-[#701CC0] motion-safe:animate-spin" />
            </div>
          ) : notFound ? (
            <div className="text-center">
              <h1 className="text-lg font-semibold text-[#1E1B2E]">Link not found</h1>
              <p className="mt-2 text-sm text-[#6B7280]">This booking link is inactive or doesn&apos;t exist.</p>
            </div>
          ) : confirmed ? (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500 shadow-lg shadow-green-500/30">
                <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h1 className="text-lg font-semibold text-[#1E1B2E]">You&apos;re booked!</h1>
              <p className="mt-2 text-sm text-[#6B7280]">{data?.title} — {confirmed}. A confirmation is on its way to {email}.</p>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-semibold tracking-tight text-[#1E1B2E]">{data?.title}</h1>
              {data?.description ? <p className="mt-1 text-sm text-[#6B7280]">{data.description}</p> : null}
              <p className="mt-1 text-xs text-[#9A93AE]">{data?.durationMinutes} minutes · times shown in your local timezone</p>

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
                    {selectedDayLabel} at {new Date(selected).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                  </p>
                  <div className="mt-3 space-y-2 border-t border-[#EEF0F4] pt-4">
                    <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-[#701CC0]" />
                    <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Your email" className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-[#701CC0]" />
                    <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything to share? (optional)" rows={2} className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-[#701CC0]" />
                    {error ? <p className="text-sm text-red-600">{error}</p> : null}
                    <button
                      type="button"
                      onClick={book}
                      disabled={submitting || !name.trim() || !email.trim()}
                      className="w-full rounded-lg bg-[#701CC0] py-2.5 text-sm font-semibold text-white hover:bg-[#5F17A5] disabled:opacity-50"
                    >
                      {submitting ? "Booking…" : "Confirm booking"}
                    </button>
                  </div>
                </div>
              ) : slotsByDay.size === 0 ? (
                <p className="mt-5 text-sm text-[#6B7280]">No open times in the next couple of weeks.</p>
              ) : (
                <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-[minmax(0,1fr)_260px]">
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => goToMonth(-1)}
                        disabled={!canGoPrevMonth}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-[#4A465C] transition hover:bg-[#F0E8FA] hover:text-[#701CC0] disabled:pointer-events-none disabled:opacity-25"
                        aria-label="Previous month"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                          <polyline points="15 18 9 12 15 6" />
                        </svg>
                      </button>
                      <p className="text-sm font-semibold text-[#1E1B2E]">
                        {viewMonth?.toLocaleDateString([], { month: "long", year: "numeric" })}
                      </p>
                      <button
                        type="button"
                        onClick={() => goToMonth(1)}
                        disabled={!canGoNextMonth}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-[#4A465C] transition hover:bg-[#F0E8FA] hover:text-[#701CC0] disabled:pointer-events-none disabled:opacity-25"
                        aria-label="Next month"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </button>
                    </div>
                    <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase text-[#9A93AE]">
                      {WEEKDAY_LABELS.map((w, i) => (
                        <div key={i}>{w}</div>
                      ))}
                    </div>
                    <div className="mt-1 grid grid-cols-7 gap-1">
                      {calendarWeeks.flat().map((date, i) => {
                        if (!date) return <div key={i} />;
                        const key = dayKey(date);
                        const hasSlots = slotsByDay.has(key);
                        const isSelected = key === selectedDay;
                        const isToday = key === todayKey;
                        return (
                          <button
                            key={i}
                            type="button"
                            disabled={!hasSlots}
                            onClick={() => setSelectedDay(key)}
                            className={`aspect-square rounded-lg text-sm transition ${
                              isSelected
                                ? "bg-[#701CC0] font-semibold text-white"
                                : hasSlots
                                  ? `text-[#1E1B2E] hover:bg-[#F0E8FA] ${isToday ? "font-semibold text-[#701CC0]" : ""}`
                                  : "text-[#D8D5E2]"
                            }`}
                          >
                            {date.getDate()}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="sm:border-l sm:border-[#EEF0F4] sm:pl-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#847FA0]">{selectedDayLabel}</p>
                    <div className="flex max-h-80 flex-col gap-2.5 overflow-y-auto pr-1">
                      {dayTimes.length === 0 ? (
                        <p className="text-sm text-[#6B7280]">No times this day.</p>
                      ) : (
                        dayTimes.map((iso) => (
                          <button
                            key={iso}
                            type="button"
                            onClick={() => setSelected(iso)}
                            className="w-full rounded-lg border border-[#E5E7EB] px-4 py-3 text-base font-medium text-[#1E1B2E] transition hover:border-[#701CC0] hover:bg-[#F9F5FD]"
                          >
                            {new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
