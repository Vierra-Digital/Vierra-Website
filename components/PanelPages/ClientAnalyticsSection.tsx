import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FiSend, FiEye, FiMousePointer, FiMessageSquare } from "react-icons/fi";

type AnalyticsSummary = {
  days: number;
  totals: { sent: number; opens: number; clicks: number; replies: number; bounces: number; unsubscribes: number };
  trend: { date: string; sent: number; opens: number; clicks: number }[];
  campaigns: { total: number; active: number };
  contacts: { total: number; replyRate: number };
};

const numberFmt = new Intl.NumberFormat();
const pctFmt = (n: number) => `${Math.round(n * 100)}%`;
const RANGE_OPTIONS = [30, 90] as const;

/**
 * Client-facing Analytics tab — a deliberately simplified counterpart to the staff-only
 * EmailAnalyticsView. Same visual language (purple area chart, flat KPI strip) but only the
 * numbers that are safe and meaningful for a client to see: campaign send/open/click/reply
 * totals and a trend line, not per-message deliverability detail, domain auth, or Postmaster
 * reputation (those stay admin-only).
 */
export default function ClientAnalyticsSection() {
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [days, setDays] = useState<(typeof RANGE_OPTIONS)[number]>(30);

  useEffect(() => {
    let cancelled = false;
    // Entering the loading state for a fetch that the effect itself performs — same pattern as
    // EmailAnalyticsView.tsx's range-change effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError("");
    fetch(`/api/client/dashboard/analytics-summary?days=${days}`, { cache: "no-store" })
      .then(async (r) => {
        const payload = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(payload?.message || "Couldn't load analytics.");
        return payload as AnalyticsSummary;
      })
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Couldn't load analytics.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [days]);

  const series = useMemo(
    () =>
      (data?.trend ?? []).map((row) => ({
        label: new Date(row.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        opens: row.opens,
        clicks: row.clicks,
      })),
    [data]
  );

  const kpis = [
    { label: "Sent", icon: <FiSend className="h-3.5 w-3.5" />, value: data?.totals.sent ?? 0 },
    { label: "Opens", icon: <FiEye className="h-3.5 w-3.5" />, value: data?.totals.opens ?? 0 },
    { label: "Clicks", icon: <FiMousePointer className="h-3.5 w-3.5" />, value: data?.totals.clicks ?? 0 },
    { label: "Replies", icon: <FiMessageSquare className="h-3.5 w-3.5" />, value: data?.totals.replies ?? 0 },
  ];

  return (
    <div className="flex-1 px-6 pt-2 lg:px-10">
      <div className="mx-auto w-full max-w-5xl pb-16">
        <div className="mb-2 mt-8 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-[#111827]">Analytics</h1>
          <div className="flex overflow-hidden rounded-lg border border-[#ECEAF1]">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setDays(option)}
                className={`px-3 py-1.5 text-xs font-medium transition ${
                  days === option ? "bg-[#701CC0] text-white" : "bg-white text-[#6B7280] hover:bg-[#F8F0FF]"
                }`}
              >
                {option}d
              </button>
            ))}
          </div>
        </div>

        {error ? (
          <p className="mt-6 text-sm text-red-600">{error}</p>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-[#ECEAF1] bg-[#ECEAF1] sm:grid-cols-4">
              {kpis.map((k) => (
                <div key={k.label} className="bg-white px-5 py-5">
                  <div className="flex items-center gap-1.5 text-[#847FA0]">
                    {k.icon}
                    <span className="text-[11px] font-semibold uppercase tracking-wide">{k.label}</span>
                  </div>
                  <div className="mt-2 text-2xl font-bold tabular-nums text-[#1E1B2E]">
                    {loading ? <span className="inline-block h-6 w-12 animate-pulse rounded bg-[#F1EFF6]" /> : numberFmt.format(k.value)}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-xl bg-[#FBFAFD] p-4">
              <h3 className="mb-3 text-[13px] font-semibold text-[#2A2540]">Opens &amp; clicks over time</h3>
              {series.length === 0 ? (
                <p className="text-[13px] text-[#7B7691]">No tracked activity in this range yet.</p>
              ) : (
                <div className="h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                      <defs>
                        <linearGradient id="clientGOpens" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#701CC0" stopOpacity={0.24} />
                          <stop offset="100%" stopColor="#701CC0" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="clientGClicks" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#8B3BEE" stopOpacity={0.18} />
                          <stop offset="100%" stopColor="#8B3BEE" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F2EFF8" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#847FA0" }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "#847FA0" }} tickLine={false} axisLine={false} allowDecimals={false} width={32} />
                      <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #EAE5F4", fontSize: 12 }} />
                      <Area type="monotone" dataKey="opens" name="Opens" stroke="#701CC0" strokeWidth={2} fill="url(#clientGOpens)" />
                      <Area type="monotone" dataKey="clicks" name="Clicks" stroke="#8B3BEE" strokeWidth={2} fill="url(#clientGClicks)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-xl bg-[#FBFAFD] p-4">
                <h3 className="mb-3 text-[13px] font-semibold text-[#2A2540]">Campaigns</h3>
                <div className="flex items-baseline justify-between text-sm">
                  <dt className="text-[#847FA0]">Total campaigns</dt>
                  <dd className="font-semibold tabular-nums text-[#1E1B2E]">{numberFmt.format(data?.campaigns.total ?? 0)}</dd>
                </div>
                <div className="mt-2 flex items-baseline justify-between text-sm">
                  <dt className="text-[#847FA0]">Active now</dt>
                  <dd className="font-semibold tabular-nums text-[#1E1B2E]">{numberFmt.format(data?.campaigns.active ?? 0)}</dd>
                </div>
              </div>
              <div className="rounded-xl bg-[#FBFAFD] p-4">
                <h3 className="mb-3 text-[13px] font-semibold text-[#2A2540]">Contacts reached</h3>
                <div className="flex items-baseline justify-between text-sm">
                  <dt className="text-[#847FA0]">Total contacts</dt>
                  <dd className="font-semibold tabular-nums text-[#1E1B2E]">{numberFmt.format(data?.contacts.total ?? 0)}</dd>
                </div>
                <div className="mt-2 flex items-baseline justify-between text-sm">
                  <dt className="text-[#847FA0]">Reply rate</dt>
                  <dd className="font-semibold tabular-nums text-[#1E1B2E]">{pctFmt(data?.contacts.replyRate ?? 0)}</dd>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
