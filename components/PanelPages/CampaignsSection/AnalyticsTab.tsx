import React, { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

type DailyStat = { date: string; emailsSent: number; opens: number; clicks: number; replies: number };
type Stats = {
  daily: DailyStat[];
  totals: { emailsSent: number; opens: number; clicks: number; contacts: number; replied: number };
  rates: { openRate: number; clickRate: number; replyRate: number };
};

const pct = (n: number) => `${Math.round(n * 100)}%`;

const RateCard: React.FC<{ label: string; value: string; sub?: string }> = ({ label, value, sub }) => (
  <div className="bg-white rounded-lg border border-[#E5E7EB] p-4">
    <p className="text-xs font-medium text-[#6B7280] uppercase tracking-wider mb-1">{label}</p>
    <p className="text-2xl font-semibold text-[#111827]">{value}</p>
    {sub && <p className="text-xs text-[#9CA3AF] mt-1">{sub}</p>}
  </div>
);

const AnalyticsTab: React.FC<{ campaignId: string }> = ({ campaignId }) => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/campaigns/${campaignId}/stats?days=${days}`);
        if (res.ok) setStats(await res.json());
      } catch (e) {
        console.error("Error loading campaign stats:", e);
      } finally {
        setLoading(false);
      }
    })();
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <RateCard label="Emails Sent" value={String(stats.totals.emailsSent)} sub={`last ${days}d`} />
        <RateCard label="Open Rate" value={pct(stats.rates.openRate)} sub="pixel tracking not yet wired for campaigns" />
        <RateCard label="Click Rate" value={pct(stats.rates.clickRate)} sub="pixel tracking not yet wired for campaigns" />
        <RateCard label="Reply Rate" value={pct(stats.rates.replyRate)} sub={`${stats.totals.replied}/${stats.totals.contacts} contacts`} />
      </div>

      <div className="bg-white rounded-lg border border-[#E5E7EB] p-4">
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
    </div>
  );
};

export default AnalyticsTab;
