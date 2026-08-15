import type { useBookingSlots } from "@/lib/booking/useBookingSlots";

type BookingSlotsState = ReturnType<typeof useBookingSlots>;

/**
 * Month calendar + day time-slot picker. Purely presentational — all state comes from
 * useBookingSlots so this can render identically inside the standalone /book page and
 * inside an in-modal booking step (e.g. AuditBookingStep).
 */
export default function SlotCalendar({
  state,
  onSelectTime,
}: {
  state: BookingSlotsState;
  onSelectTime: (iso: string) => void;
}) {
  const {
    viewMonth,
    slotsByDay,
    selectedDay,
    setSelectedDay,
    todayKey,
    canGoPrevMonth,
    canGoNextMonth,
    goToMonth,
    dayTimes,
    selectedDayLabel,
    weekdayLabels,
    calendarWeeks,
  } = state;

  if (slotsByDay.size === 0) {
    return <p className="mt-5 text-sm text-[#6B7280]">No open times right now.</p>;
  }

  return (
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
          {weekdayLabels.map((w, i) => (
            <div key={i}>{w}</div>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {calendarWeeks.flat().map((date, i) => {
            if (!date) return <div key={i} />;
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
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
                onClick={() => onSelectTime(iso)}
                className="w-full rounded-lg border border-[#E5E7EB] px-4 py-3 text-base font-medium text-[#1E1B2E] transition hover:border-[#701CC0] hover:bg-[#F9F5FD]"
              >
                {new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
