import { useEffect, useState } from "react";
import { FiSend, FiEye, FiMousePointer, FiMessageSquare } from "react-icons/fi";

type Summary = {
  totals: { sent: number; opens: number; clicks: number; replies: number };
};

const numberFmt = new Intl.NumberFormat();

/**
 * Dashboard-tab summary boxes — a simplified slice of the full client Analytics tab. Each box
 * is a button rather than a static tile, since clicking any of them jumps into the fuller
 * Analytics tab (see `onViewAnalytics`), matching how the numbers here are always a subset of
 * what that tab breaks down further.
 */
export default function ClientAnalyticsSummary({ onViewAnalytics }: { onViewAnalytics: () => void }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/client/dashboard/analytics-summary?days=30")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) setSummary(data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const boxes = [
    { label: "Emails sent", value: summary?.totals.sent ?? 0, icon: FiSend },
    { label: "Opens", value: summary?.totals.opens ?? 0, icon: FiEye },
    { label: "Clicks", value: summary?.totals.clicks ?? 0, icon: FiMousePointer },
    { label: "Replies", value: summary?.totals.replies ?? 0, icon: FiMessageSquare },
  ];

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#111827]">Email performance</h3>
        <span className="text-xs text-[#9CA3AF]">Last 30 days</span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {boxes.map(({ label, value, icon: Icon }) => (
          <button
            key={label}
            type="button"
            onClick={onViewAnalytics}
            className="group flex flex-col items-start gap-2 rounded-xl border border-[#ECEAF1] bg-white p-4 text-left transition hover:border-[#701CC0] hover:shadow-sm"
          >
            <Icon className="h-4 w-4 text-[#701CC0]" />
            <div className="text-2xl font-semibold tabular-nums text-[#111827]">
              {loading ? <span className="inline-block h-6 w-10 animate-pulse rounded bg-[#F1EFF6]" /> : numberFmt.format(value)}
            </div>
            <div className="text-xs text-[#6B7280] group-hover:text-[#701CC0]">{label}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
