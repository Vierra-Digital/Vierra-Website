"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FiEye, FiMousePointer, FiSend, FiTrendingUp } from "react-icons/fi";
import { GLASS_SURFACE, SHADOW_SM } from "@/components/email/emailTheme";

type StatMessage = {
  messageId: string | null;
  accountEmail: string | null;
  subject: string | null;
  trackingEnabled: boolean;
  createdAt: string;
  openCount: number;
  clickCount: number;
};

type StatsResponse = {
  totals: { trackedMessages: number; opens: number; clicks: number };
  messages: StatMessage[];
};

const CARD = `rounded-2xl ${GLASS_SURFACE} ${SHADOW_SM} p-5`;

const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 100) : 0);

const dayKey = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const EmailAnalyticsView: React.FC<{ accounts: string[] }> = ({ accounts }) => {
  const [data, setData] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  type ReportingSummary = {
    campaigns: number;
    activeCampaigns: number;
    totalContacts: number;
    statusMap: Record<string, number>;
    replyRate: number;
    bookings: number;
    upcomingBookings: number;
  };
  const [report, setReport] = useState<ReportingSummary | null>(null);
  const accountsKey = accounts.join(",");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetch("/api/gmail/tracking/stats", { cache: "no-store" })
      .then((r) => r.json())
      .then((payload) => {
        if (cancelled) return;
        setData({
          totals: {
            trackedMessages: Number(payload?.totals?.trackedMessages || 0),
            opens: Number(payload?.totals?.opens || 0),
            clicks: Number(payload?.totals?.clicks || 0),
          },
          messages: Array.isArray(payload?.messages) ? payload.messages : [],
        });
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load analytics. Try again.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accountsKey]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/reporting/summary", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d) setReport(d);
      })
      .catch(() => {
        /* reporting is supplementary */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const derived = useMemo(() => {
    const messages = data?.messages ?? [];
    const tracked = messages.filter((m) => m.trackingEnabled);
    const openedMessages = tracked.filter((m) => m.openCount > 0).length;
    const clickedMessages = tracked.filter((m) => m.clickCount > 0).length;

    // Daily buckets by send date, preserving chronological order.
    const buckets = new Map<string, { label: string; opens: number; clicks: number; ts: number }>();
    for (const m of messages) {
      const d = new Date(m.createdAt);
      if (Number.isNaN(d.getTime())) continue;
      const key = d.toISOString().slice(0, 10);
      const existing = buckets.get(key) || { label: dayKey(m.createdAt), opens: 0, clicks: 0, ts: d.getTime() };
      existing.opens += m.openCount;
      existing.clicks += m.clickCount;
      buckets.set(key, existing);
    }
    const series = [...buckets.values()].sort((a, b) => a.ts - b.ts).slice(-21);

    const topMessages = [...messages]
      .filter((m) => m.openCount > 0 || m.clickCount > 0)
      .sort((a, b) => b.openCount - a.openCount || b.clickCount - a.clickCount)
      .slice(0, 6);

    const perAccountMap = new Map<string, { sent: number; opens: number; clicks: number }>();
    for (const m of messages) {
      const key = m.accountEmail || "—";
      const row = perAccountMap.get(key) || { sent: 0, opens: 0, clicks: 0 };
      row.sent += 1;
      row.opens += m.openCount;
      row.clicks += m.clickCount;
      perAccountMap.set(key, row);
    }
    const perAccount = [...perAccountMap.entries()]
      .map(([email, v]) => ({ email, ...v }))
      .sort((a, b) => b.sent - a.sent)
      .slice(0, 6);

    return {
      sent: messages.length,
      tracked: tracked.length,
      opens: data?.totals.opens ?? 0,
      clicks: data?.totals.clicks ?? 0,
      openedMessages,
      clickedMessages,
      openRate: pct(openedMessages, tracked.length),
      clickRate: pct(clickedMessages, tracked.length),
      ctor: pct(clickedMessages, openedMessages),
      series,
      topMessages,
      perAccount,
    };
  }, [data]);

  if (loading) {
    return (
      <div className="h-full min-h-[320px] flex items-center justify-center">
        <div className="mx-auto w-10 h-10 rounded-full border-4 border-[#E9D4FB] border-t-[#701CC0] motion-safe:animate-spin" />
      </div>
    );
  }

  if (error) {
    return <div className="m-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>;
  }

  const kpis = [
    { label: "Sent (recent)", value: derived.sent.toLocaleString(), icon: <FiSend className="w-4 h-4" /> },
    { label: "Open rate", value: `${derived.openRate}%`, sub: `${derived.opens.toLocaleString()} opens`, icon: <FiEye className="w-4 h-4" /> },
    { label: "Click rate", value: `${derived.clickRate}%`, sub: `${derived.clicks.toLocaleString()} clicks`, icon: <FiMousePointer className="w-4 h-4" /> },
    { label: "Tracked", value: derived.tracked.toLocaleString(), sub: "with tracking on", icon: <FiTrendingUp className="w-4 h-4" /> },
  ];

  return (
    <div className="h-full overflow-y-auto p-5">
      <div className="flex items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-[#1E1B2E]">Email Analytics</h1>
          <p className="text-xs text-[#847FA0] mt-0.5">Outbound performance — measures mail you send, not mail you receive.</p>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {kpis.map((k) => (
          <div key={k.label} className={CARD}>
            <div className="flex items-center gap-2 text-[#847FA0]">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-[#701CC0]/10 text-[#701CC0]">{k.icon}</span>
              <span className="text-[11px] font-semibold uppercase tracking-wide">{k.label}</span>
            </div>
            <div className="mt-3 text-3xl font-bold tracking-tight text-[#1E1B2E] tabular-nums">{k.value}</div>
            {k.sub ? <div className="text-xs text-[#847FA0] mt-1 tabular-nums">{k.sub}</div> : null}
          </div>
        ))}
      </div>

      {/* Outreach reporting — campaigns + meetings (supplementary to open/click tracking) */}
      {report && (report.campaigns > 0 || report.totalContacts > 0 || report.bookings > 0) ? (
        <div className={`${CARD} mb-4`}>
          <h3 className="text-sm font-semibold text-[#1E1B2E] mb-3">Outreach reporting</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Campaigns", value: String(report.campaigns), sub: `${report.activeCampaigns} active` },
              { label: "Contacts", value: report.totalContacts.toLocaleString(), sub: "enrolled" },
              { label: "Reply rate", value: `${Math.round(report.replyRate * 100)}%`, sub: "of enrolled" },
              { label: "Meetings booked", value: String(report.bookings), sub: `${report.upcomingBookings} upcoming` },
            ].map((k) => (
              <div key={k.label}>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-[#847FA0]">{k.label}</div>
                <div className="mt-1 text-2xl font-bold tracking-tight text-[#1E1B2E] tabular-nums">{k.value}</div>
                <div className="text-xs text-[#847FA0] tabular-nums">{k.sub}</div>
              </div>
            ))}
          </div>
          {Object.keys(report.statusMap).length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {Object.entries(report.statusMap).map(([status, count]) => (
                <span key={status} className="rounded-full bg-[#F5EFFF] px-2.5 py-1 text-xs font-medium text-[#701CC0]">
                  {status.replace(/_/g, " ")}: {count}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Engagement funnel */}
      <div className={`${CARD} mb-4`}>
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-semibold text-[#1E1B2E]">Engagement funnel</h3>
          <span className="text-xs text-[#847FA0]">Click-to-open rate <b className="text-[#1E1B2E] tabular-nums">{derived.ctor}%</b></span>
        </div>
        <p className="text-xs text-[#847FA0] mb-4">Of {derived.tracked.toLocaleString()} tracked messages</p>
        <div className="space-y-3">
          {[
            { label: "Sent", value: derived.tracked, w: 100, color: "#701CC0" },
            { label: "Opened", value: derived.openedMessages, w: derived.openRate, color: "#9333EA" },
            { label: "Clicked", value: derived.clickedMessages, w: derived.clickRate, color: "#C42B9F" },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-3">
              <span className="w-16 text-xs font-medium text-[#4A465C]">{s.label}</span>
              <div className="flex-1 h-6 rounded-lg bg-[#F3EEFB] overflow-hidden">
                <div
                  className="h-full rounded-lg flex items-center justify-end pr-2 text-[11px] font-semibold text-white tabular-nums"
                  style={{ width: `${Math.max(s.w, 6)}%`, background: s.color }}
                >
                  {s.value.toLocaleString()}
                </div>
              </div>
              <span className="w-10 text-right text-xs font-semibold text-[#4A465C] tabular-nums">{s.w}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Trend */}
      <div className={`${CARD} mb-4`}>
        <h3 className="text-sm font-semibold text-[#1E1B2E]">Opens &amp; clicks over time</h3>
        <p className="text-xs text-[#847FA0] mb-3">By send date · most recent {derived.series.length} days with activity</p>
        {derived.series.length === 0 ? (
          <div className="h-[200px] flex items-center justify-center text-sm text-[#847FA0]">No tracking activity yet.</div>
        ) : (
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={derived.series} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                <defs>
                  <linearGradient id="gOpens" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#701CC0" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#701CC0" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gClicks" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#C42B9F" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#C42B9F" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#EFEBF7" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#847FA0" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#847FA0" }} tickLine={false} axisLine={false} allowDecimals={false} width={32} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid #EAE5F4", fontSize: 12, boxShadow: "0 8px 24px -10px rgba(46,16,80,0.3)" }}
                />
                <Area type="monotone" dataKey="opens" name="Opens" stroke="#701CC0" strokeWidth={2} fill="url(#gOpens)" />
                <Area type="monotone" dataKey="clicks" name="Clicks" stroke="#C42B9F" strokeWidth={2} fill="url(#gClicks)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top messages */}
        <div className={CARD}>
          <h3 className="text-sm font-semibold text-[#1E1B2E] mb-3">Top messages by opens</h3>
          {derived.topMessages.length === 0 ? (
            <p className="text-sm text-[#847FA0]">No opened messages yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10.5px] uppercase tracking-wide text-[#847FA0]">
                  <th className="text-left font-semibold pb-2">Subject</th>
                  <th className="text-right font-semibold pb-2">Opens</th>
                  <th className="text-right font-semibold pb-2">Clicks</th>
                </tr>
              </thead>
              <tbody>
                {derived.topMessages.map((m, i) => (
                  <tr key={m.messageId || i} className="border-t border-[#EEE6F7]/70">
                    <td className="py-2 pr-2 text-[#4A465C] truncate max-w-[220px]">{m.subject || "(No subject)"}</td>
                    <td className="py-2 text-right font-semibold text-[#1E1B2E] tabular-nums">{m.openCount}</td>
                    <td className="py-2 text-right text-[#4A465C] tabular-nums">{m.clickCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Per-account */}
        <div className={CARD}>
          <h3 className="text-sm font-semibold text-[#1E1B2E] mb-3">Per-account performance</h3>
          {derived.perAccount.length === 0 ? (
            <p className="text-sm text-[#847FA0]">No sent mail yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10.5px] uppercase tracking-wide text-[#847FA0]">
                  <th className="text-left font-semibold pb-2">Account</th>
                  <th className="text-right font-semibold pb-2">Sent</th>
                  <th className="text-right font-semibold pb-2">Opens</th>
                  <th className="text-right font-semibold pb-2">Clicks</th>
                </tr>
              </thead>
              <tbody>
                {derived.perAccount.map((a) => (
                  <tr key={a.email} className="border-t border-[#EEE6F7]/70">
                    <td className="py-2 pr-2 text-[#4A465C] truncate max-w-[180px]">{a.email}</td>
                    <td className="py-2 text-right text-[#1E1B2E] tabular-nums">{a.sent}</td>
                    <td className="py-2 text-right text-[#1E1B2E] tabular-nums">{a.opens}</td>
                    <td className="py-2 text-right text-[#4A465C] tabular-nums">{a.clicks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmailAnalyticsView;
