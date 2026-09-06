import React, { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

type DailyStat = {
  date: string;
  emailsSent: number;
  opens: number;
  clicks: number;
  replies: number;
  bounces: number;
  unsubscribes: number;
};
type StepStat = {
  stepId: string;
  stepOrder: number;
  name: string | null;
  sent: number;
  opened: number;
  clicked: number;
  openRate: number;
  clickRate: number;
};
type Stats = {
  daily: DailyStat[];
  totals: {
    emailsSent: number;
    opens: number;
    clicks: number;
    bounces: number;
    unsubscribes: number;
    contacts: number;
    replied: number;
    booked: number;
  };
  rates: {
    openRate: number;
    clickRate: number;
    replyRate: number;
    bounceRate: number;
    unsubscribeRate: number;
    bookingRate: number;
  };
  stepBreakdown: StepStat[];
};

const pct = (n: number) => `${Math.round(n * 100)}%`;

const STATS_CACHE_TTL_MS = 60_000;
const statsCache = new Map<string, { data: Stats; ts: number }>();

const RateCard: React.FC<{ label: string; value: string; sub?: string }> = ({ label, value, sub }) => (
  <div className="bg-white rounded-lg border border-[#E5E7EB] p-4">
    <p className="text-xs font-medium text-[#6B7280] uppercase tracking-wider mb-1">{label}</p>
    <p className="text-2xl font-semibold text-[#111827]">{value}</p>
    {sub && <p className="text-xs text-[#9CA3AF] mt-1">{sub}</p>}
  </div>
);

const AnalyticsTab: React.FC<{ campaignId: string }> = ({ campaignId }) => {
  const [days, setDays] = useState(7);
  const cacheKey = `${campaignId}:${days}`;

  // Both seeded from the cache once, in initialisers rather than in the render body. Reading the
  // clock during render is impure — the same render would produce a different result a minute
  // later — and these only ever needed to be evaluated for the first render anyway; the effect
  // below owns every change after that. Behaviour is unchanged: a stale entry still seeds stats
  // while leaving loading true, so the spinner shows until the refetch lands.
  const [stats, setStats] = useState<Stats | null>(() => statsCache.get(cacheKey)?.data ?? null);
  const [loading, setLoading] = useState(() => {
    const entry = statsCache.get(cacheKey);
    return !(entry && Date.now() - entry.ts < STATS_CACHE_TTL_MS);
  });

  useEffect(() => {
    const key = `${campaignId}:${days}`;
    const entry = statsCache.get(key);
    if (entry && Date.now() - entry.ts < STATS_CACHE_TTL_MS) {
      // Fast path when the day range changes and we already hold fresh numbers: adopt them and
      // skip the round trip. This is a synchronous state write inside an effect, which the rule
      // objects to, and the idiomatic alternative — remounting this component under a key of
      // campaignId:days so the initialisers above re-run — would also keep the range picker
      // mounted during the load, where today the spinner replaces it. Preserving what is on
      // screen matters more here than the warning.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStats(entry.data);
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/campaigns/${campaignId}/stats?days=${days}`);
        if (res.ok) {
          const data: Stats = await res.json();
          if (!cancelled) {
            setStats(data);
            statsCache.set(key, { data, ts: Date.now() });
          }
        }
      } catch (e) {
        console.error("Error loading campaign stats:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [campaignId, days]);

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner label="Loading analytics..." />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-end gap-2 mb-4">
        {[7, 30, 90].map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium ${
              days === d ? "bg-[#701CC0] text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {d}d
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <RateCard label="Emails Sent" value={String(stats.totals.emailsSent)} sub={`last ${days}d`} />
        <RateCard label="Open Rate" value={pct(stats.rates.openRate)} sub={`${stats.totals.opens} opens`} />
        <RateCard label="Click Rate" value={pct(stats.rates.clickRate)} sub={`${stats.totals.clicks} clicks`} />
        <RateCard label="Reply Rate" value={pct(stats.rates.replyRate)} sub={`${stats.totals.replied}/${stats.totals.contacts} contacts`} />
        <RateCard label="Booking Rate" value={pct(stats.rates.bookingRate)} sub={`${stats.totals.booked}/${stats.totals.contacts} contacts`} />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <RateCard label="Bounce Rate" value={pct(stats.rates.bounceRate)} sub={`${stats.totals.bounces} bounced`} />
        <RateCard label="Unsubscribe Rate" value={pct(stats.rates.unsubscribeRate)} sub={`${stats.totals.unsubscribes} opted out`} />
      </div>

      <div className="bg-white rounded-lg border border-[#E5E7EB] p-4 mb-6">
        <h3 className="text-sm font-semibold text-[#111827] mb-4">Emails Sent Per Day</h3>
        <div style={{ width: "100%", height: 260 }}>
          <ResponsiveContainer>
            <BarChart data={stats.daily}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
              <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5)} fontSize={12} stroke="#9CA3AF" />
              <YAxis allowDecimals={false} fontSize={12} stroke="#9CA3AF" />
              <Tooltip />
              <Bar dataKey="emailsSent" fill="#701CC0" radius={[4, 4, 0, 0]} name="Emails Sent" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {stats.stepBreakdown.length > 0 ? (
        <div className="bg-white rounded-lg border border-[#E5E7EB] p-4">
          <h3 className="text-sm font-semibold text-[#111827] mb-1">Sequence Drop-off</h3>
          <p className="text-xs text-[#9CA3AF] mb-4">
            Sent, opened and clicked per step, lifetime — where the sequence loses people. Reply
            rate isn&rsquo;t attributed to a specific step, since nothing records which step a
            reply answered.
          </p>
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <BarChart
                data={stats.stepBreakdown.map((s) => ({
                  label: s.name || `Step ${s.stepOrder}`,
                  Sent: s.sent,
                  Opened: s.opened,
                  Clicked: s.clicked,
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                <XAxis dataKey="label" fontSize={12} stroke="#9CA3AF" />
                <YAxis allowDecimals={false} fontSize={12} stroke="#9CA3AF" />
                <Tooltip />
                <Bar dataKey="Sent" fill="#C4B5FD" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Opened" fill="#8B3BEE" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Clicked" fill="#701CC0" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wider text-[#9CA3AF]">
                  <th className="pb-2 text-left font-medium">Step</th>
                  <th className="pb-2 text-right font-medium">Sent</th>
                  <th className="pb-2 text-right font-medium">Open Rate</th>
                  <th className="pb-2 text-right font-medium">Click Rate</th>
                </tr>
              </thead>
              <tbody>
                {stats.stepBreakdown.map((s) => (
                  <tr key={s.stepId} className="border-t border-[#F3F4F6]">
                    <td className="py-2 text-[#374151]">{s.name || `Step ${s.stepOrder}`}</td>
                    <td className="py-2 text-right tabular-nums text-[#374151]">{s.sent}</td>
                    <td className="py-2 text-right tabular-nums text-[#374151]">{pct(s.openRate)}</td>
                    <td className="py-2 text-right tabular-nums text-[#374151]">{pct(s.clickRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AnalyticsTab;
