import { useEffect, useMemo, useState } from "react";
import { FiCalendar, FiClock } from "react-icons/fi";
import { resolveLocalTimeZone, formatMeetingDate, isMeetingToday, formatMeetingTimeRange } from "@/lib/meetingFormat";

type Meeting = {
  id: string;
  title: string;
  startIso: string;
  endIso: string | null;
  meetingLink: string | null;
};

/**
 * Compact meetings widget for the client dashboard — same data shape and formatting as the admin
 * dashboard's Upcoming Meetings card, but an inline list rather than a dedicated 400px rail
 * column, since it sits alongside the analytics summary rather than owning a whole side panel.
 */
export default function ClientUpcomingMeetings() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const localTimeZone = useMemo(() => resolveLocalTimeZone(), []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/client/dashboard/upcoming-meetings")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("failed"))))
      .then((data) => {
        if (cancelled) return;
        setMeetings(Array.isArray(data?.meetings) ? data.meetings : []);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="rounded-xl bg-[#F1EFF6] p-4">
      <h3 className="mb-3 text-sm font-semibold text-[#111827]">Upcoming Meetings</h3>
      {loading ? (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-white" />
          ))}
        </div>
      ) : error ? (
        <p className="text-sm text-[#6B7280]">Couldn&apos;t load meetings. Try refreshing.</p>
      ) : meetings.length === 0 ? (
        <div className="flex items-center gap-3 rounded-lg bg-white p-3">
          <FiCalendar className="h-5 w-5 shrink-0 text-[#701CC0]" />
          <p className="text-sm text-[#6B7280]">No upcoming meetings scheduled.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {meetings.map((meeting) => (
            <div key={meeting.id} className="flex items-center justify-between gap-3 rounded-lg bg-white p-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-[#111827]">{meeting.title}</div>
                <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-[#6B7280]">
                  <span className={`flex items-center gap-1 ${isMeetingToday(meeting.startIso, localTimeZone) ? "font-semibold text-red-600" : ""}`}>
                    <FiCalendar className="h-3 w-3" />
                    {formatMeetingDate(meeting.startIso, localTimeZone)}
                  </span>
                  <span className="flex items-center gap-1">
                    <FiClock className="h-3 w-3" />
                    {formatMeetingTimeRange(meeting.startIso, meeting.endIso, localTimeZone)}
                  </span>
                </div>
              </div>
              {meeting.meetingLink ? (
                <a
                  href={meeting.meetingLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 rounded-md bg-[#701CC0] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[#5f17a5]"
                >
                  Join
                </a>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
