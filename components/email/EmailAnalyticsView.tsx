"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FiClock, FiEye, FiMousePointer, FiSend, FiShield } from "react-icons/fi";
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

type Deliverability = {
  attempted: number;
  failed: number;
  bounces: number;
  unsubscribes: number;
  replies: number;
  topFailReasons: { reason: string; count: number }[];
};

type StatsResponse = {
  /** Real aggregates over every matching message — not derived from the capped `messages` rows. */
  totals: {
    sent: number;
    trackedMessages: number;
    opens: number;
    clicks: number;
    openedMessages: number;
    clickedMessages: number;
    filteredOpens: number;
  };
  deliverability: Deliverability;
  behaviour: {
    medianTimeToOpenMs: number | null;
    sampleSize: number;
    sendTimes: { day: number; hour: number; sent: number; opened: number }[];
  };
  messages: StatMessage[];
  truncated: boolean;
};

type RecordStatus = "pass" | "warn" | "fail";
type DomainAuth = {
  domain: string;
  accounts: string[];
  spf: { status: RecordStatus; detail: string };
  dkim: { status: RecordStatus; detail: string };
  dmarc: { status: RecordStatus; detail: string; policy: string | null };
};

/** Compact human duration for time-to-open (e.g. "42m", "3.4h", "2.1d"). */
const humanDuration = (ms: number): string => {
  const mins = ms / 60000;
  if (mins < 1) return `${Math.round(ms / 1000)}s`;
  if (mins < 60) return `${Math.round(mins)}m`;
  const hours = mins / 60;
  if (hours < 48) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const STATUS_STYLES: Record<RecordStatus, string> = {
  pass: "bg-[#ECFDF5] text-[#047857]",
  warn: "bg-[#FFFBEB] text-[#B45309]",
  fail: "bg-[#FEF2F2] text-[#B91C1C]",
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
  // Analytics window in days (0 = all time). The stats API supports a `from` filter; expose it.
  const [rangeDays, setRangeDays] = useState(30);
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
  const [domainAuth, setDomainAuth] = useState<DomainAuth[] | null>(null);
  const accountsKey = accounts.join(",");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (rangeDays > 0) {
      const from = new Date();
      from.setDate(from.getDate() - rangeDays);
      params.set("from", from.toISOString());
    }
    // Scope to the mailboxes selected in the panel. This was previously ignored, so the report
    // always covered every account regardless of the selection.
    if (accountsKey) params.set("accounts", accountsKey);
    const qs = params.toString();
    fetch(`/api/gmail/tracking/stats${qs ? `?${qs}` : ""}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((payload) => {
        if (cancelled) return;
        const n = (v: unknown) => Number(v || 0);
        setData({
          totals: {
            sent: n(payload?.totals?.sent),
            trackedMessages: n(payload?.totals?.trackedMessages),
            opens: n(payload?.totals?.opens),
            clicks: n(payload?.totals?.clicks),
            openedMessages: n(payload?.totals?.openedMessages),
            clickedMessages: n(payload?.totals?.clickedMessages),
            filteredOpens: n(payload?.totals?.filteredOpens),
          },
          deliverability: {
            attempted: n(payload?.deliverability?.attempted),
            failed: n(payload?.deliverability?.failed),
            bounces: n(payload?.deliverability?.bounces),
            unsubscribes: n(payload?.deliverability?.unsubscribes),
            replies: n(payload?.deliverability?.replies),
            topFailReasons: Array.isArray(payload?.deliverability?.topFailReasons)
              ? payload.deliverability.topFailReasons
              : [],
          },
          behaviour: {
            medianTimeToOpenMs:
              payload?.behaviour?.medianTimeToOpenMs == null ? null : n(payload.behaviour.medianTimeToOpenMs),
            sampleSize: n(payload?.behaviour?.sampleSize),
            sendTimes: Array.isArray(payload?.behaviour?.sendTimes) ? payload.behaviour.sendTimes : [],
          },
          messages: Array.isArray(payload?.messages) ? payload.messages : [],
          truncated: Boolean(payload?.truncated),
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
  }, [accountsKey, rangeDays]);

  // Domain authentication is DNS-derived and independent of the date range, so it loads once.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/email/domain-auth", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && Array.isArray(d?.domains)) setDomainAuth(d.domains);
      })
      .catch(() => {
        /* posture check is supplementary */
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
    // Headline counts come from the server's aggregates (every matching message). The `messages`
    // array is only the most recent page, used for the charts and breakdown tables.
    const sent = data?.totals.sent ?? 0;
    const trackedCount = data?.totals.trackedMessages ?? 0;
    const openedMessages = data?.totals.openedMessages ?? 0;
    const clickedMessages = data?.totals.clickedMessages ?? 0;

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
      sent,
      tracked: trackedCount,
      opens: data?.totals.opens ?? 0,
      clicks: data?.totals.clicks ?? 0,
      filteredOpens: data?.totals.filteredOpens ?? 0,
      openedMessages,
      clickedMessages,
      openRate: pct(openedMessages, trackedCount),
      clickRate: pct(clickedMessages, trackedCount),
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

  const deliverability = data?.deliverability;
  const behaviour = data?.behaviour;
  // Peak send windows, ranked by open rate. Only buckets with enough sends to mean anything —
  // a single send that happened to be opened is not a "best time".
  const bestSendTimes = [...(behaviour?.sendTimes ?? [])]
    .filter((b) => b.sent >= 3)
    .map((b) => ({ ...b, rate: pct(b.opened, b.sent) }))
    .sort((a, b) => b.rate - a.rate || b.sent - a.sent)
    .slice(0, 5);
  const maxBucketSent = Math.max(1, ...(behaviour?.sendTimes ?? []).map((b) => b.sent));
  const deliveryRate = deliverability && deliverability.attempted > 0
    ? pct(deliverability.attempted - deliverability.failed, deliverability.attempted)
    : null;

  const kpis = [
    { label: "Sent", value: derived.sent.toLocaleString(), icon: <FiSend className="w-4 h-4" /> },
    { label: "Open rate", value: `${derived.openRate}%`, sub: `${derived.opens.toLocaleString()} opens`, icon: <FiEye className="w-4 h-4" /> },
    { label: "Click rate", value: `${derived.clickRate}%`, sub: `${derived.clicks.toLocaleString()} clicks`, icon: <FiMousePointer className="w-4 h-4" /> },
    {
      label: "Time to open",
      value: behaviour?.medianTimeToOpenMs == null ? "—" : humanDuration(behaviour.medianTimeToOpenMs),
      sub: behaviour?.medianTimeToOpenMs == null ? "no opens yet" : "median, send → first open",
      icon: <FiClock className="w-4 h-4" />,
    },
  ];

  const hasOutreach = Boolean(report && (report.campaigns > 0 || report.totalContacts > 0 || report.bookings > 0));

  return (
    <div className="h-full overflow-y-auto">
      {/* Sticky header so the range selector stays reachable while scrolling the report. */}
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[#EBEAF0] bg-white/85 px-5 py-3.5 backdrop-blur-md">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight text-[#1E1B2E]">Email Analytics</h1>
          <p className="truncate text-xs text-[#847FA0]">Outbound performance — mail you send, not mail you receive.</p>
        </div>
        <div className="flex shrink-0 items-center gap-1 rounded-lg border border-[#EBEAF0] bg-white p-0.5">
          {[
            { label: "30d", days: 30 },
            { label: "90d", days: 90 },
            { label: "All", days: 0 },
          ].map((opt) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => setRangeDays(opt.days)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                rangeDays === opt.days ? "bg-[#701CC0] text-white" : "text-[#6B7280] hover:bg-[#F4F1FA]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-6 p-5">
        {/* An all-zero report is indistinguishable from a broken one, so say which it is. */}
        {derived.sent === 0 ? (
          <div className="rounded-xl border border-[#EBEAF0] bg-[#FAFAFB] px-4 py-3 text-sm text-[#6B7280]">
            No sent mail in this range{accountsKey ? " for the selected inbox(es)" : ""}. Try a wider range —
            analytics only covers mail sent from the panel, and open/click rates need tracking enabled at send time.
          </div>
        ) : null}

        {/* ── Headline metrics ─────────────────────────────────────────────── */}
        <section>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {kpis.map((k) => (
              <div key={k.label} className={CARD}>
                <div className="flex items-center gap-2 text-[#847FA0]">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#701CC0]/10 text-[#701CC0]">{k.icon}</span>
                  <span className="text-[11px] font-semibold uppercase tracking-wide">{k.label}</span>
                </div>
                <div className="mt-3 text-3xl font-bold tabular-nums tracking-tight text-[#1E1B2E]">{k.value}</div>
                <div className="mt-1 min-h-[1rem] text-xs tabular-nums text-[#847FA0]">{k.sub ?? ""}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Engagement: the trend chart leads, funnel sits beside it ──────── */}
        <section>
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[#847FA0]">Engagement</h2>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div className={`${CARD} xl:col-span-2`}>
              <h3 className="text-sm font-semibold text-[#1E1B2E]">Opens &amp; clicks over time</h3>
              <p className="mb-3 text-xs text-[#847FA0]">
                By send date · most recent {derived.series.length} days with activity
              </p>
              {derived.series.length === 0 ? (
                <div className="flex h-[240px] items-center justify-center text-sm text-[#847FA0]">No tracking activity yet.</div>
              ) : (
                <div className="h-[240px] w-full">
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

            <div className={CARD}>
              <h3 className="text-sm font-semibold text-[#1E1B2E]">Funnel</h3>
              <p className="mb-4 text-xs text-[#847FA0]">Of {derived.tracked.toLocaleString()} tracked messages</p>
              <div className="space-y-3">
                {[
                  { label: "Sent", value: derived.tracked, w: 100, color: "#701CC0" },
                  { label: "Opened", value: derived.openedMessages, w: derived.openRate, color: "#9333EA" },
                  { label: "Clicked", value: derived.clickedMessages, w: derived.clickRate, color: "#C42B9F" },
                ].map((s) => (
                  <div key={s.label}>
                    <div className="mb-1 flex items-baseline justify-between text-xs">
                      <span className="font-medium text-[#4A465C]">{s.label}</span>
                      <span className="tabular-nums text-[#847FA0]">
                        <b className="font-semibold text-[#1E1B2E]">{s.value.toLocaleString()}</b> · {s.w}%
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-[#F3EEFB]">
                      <div className="h-full rounded-full" style={{ width: `${Math.max(s.w, 2)}%`, background: s.color }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 border-t border-[#EEE6F7] pt-3 text-xs text-[#847FA0]">
                Click-to-open rate <b className="tabular-nums text-[#1E1B2E]">{derived.ctor}%</b>
              </div>
            </div>
          </div>
        </section>

        {/* ── Deliverability ───────────────────────────────────────────────── */}
        {deliverability ? (
          <section>
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[#847FA0]">Deliverability</h2>
            <div className={CARD}>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
                {[
                  {
                    label: "Delivered",
                    value: deliveryRate === null ? "—" : `${deliveryRate}%`,
                    sub: `${(deliverability.attempted - deliverability.failed).toLocaleString()} of ${deliverability.attempted.toLocaleString()}`,
                  },
                  { label: "Failed", value: deliverability.failed.toLocaleString(), sub: "send errors" },
                  { label: "Bounces", value: deliverability.bounces.toLocaleString(), sub: "provider-reported" },
                  { label: "Replies", value: deliverability.replies.toLocaleString(), sub: "on campaigns" },
                  { label: "Unsubscribes", value: deliverability.unsubscribes.toLocaleString(), sub: "opted out" },
                ].map((k) => (
                  <div key={k.label}>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-[#847FA0]">{k.label}</div>
                    <div className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-[#1E1B2E]">{k.value}</div>
                    <div className="text-xs tabular-nums text-[#847FA0]">{k.sub}</div>
                  </div>
                ))}
              </div>
              {deliverability.topFailReasons.length > 0 ? (
                <div className="mt-4 border-t border-[#EEE6F7] pt-3">
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#847FA0]">Top failure reasons</div>
                  <div className="flex flex-wrap gap-2">
                    {deliverability.topFailReasons.map((r) => (
                      <span key={r.reason} className="rounded-full bg-[#FEF2F2] px-2.5 py-1 text-xs font-medium text-[#B91C1C]">
                        {r.reason}: {r.count}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              {derived.filteredOpens > 0 ? (
                <p className="mt-3 text-xs text-[#847FA0]">
                  {derived.filteredOpens.toLocaleString()} machine pre-fetches (Apple Mail Privacy, security scanners)
                  were excluded from opens.
                </p>
              ) : null}
            </div>
          </section>
        ) : null}

        {/* ── Send timing ──────────────────────────────────────────────────── */}
        {behaviour && behaviour.sendTimes.length > 0 ? (
          <section>
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[#847FA0]">Send timing</h2>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <div className={`${CARD} xl:col-span-2`}>
                <h3 className="text-sm font-semibold text-[#1E1B2E]">When you send, and what gets opened</h3>
                <p className="mb-3 text-xs text-[#847FA0]">
                  Cell shade = send volume · number = open rate. Based on the last{" "}
                  {behaviour.sampleSize.toLocaleString()} tracked messages, in your local timezone.
                </p>
                <div className="overflow-x-auto">
                  <table className="border-separate border-spacing-[2px]">
                    <tbody>
                      {DAY_LABELS.map((label, day) => (
                        <tr key={label}>
                          <td className="pr-2 text-right text-[10px] font-medium text-[#847FA0]">{label}</td>
                          {Array.from({ length: 24 }, (_, hour) => {
                            const bucket = behaviour.sendTimes.find((b) => b.day === day && b.hour === hour);
                            const sent = bucket?.sent ?? 0;
                            const rate = bucket ? pct(bucket.opened, bucket.sent) : 0;
                            return (
                              <td
                                key={hour}
                                title={
                                  sent
                                    ? `${label} ${hour}:00 — ${sent} sent, ${rate}% opened`
                                    : `${label} ${hour}:00 — no sends`
                                }
                                className="h-5 w-5 rounded-[3px] text-center text-[8px] font-semibold leading-5"
                                style={{
                                  background: sent
                                    ? `rgba(112,28,192,${0.12 + (sent / maxBucketSent) * 0.75})`
                                    : "#F4F2F8",
                                  color: sent && sent / maxBucketSent > 0.5 ? "#fff" : "#5B5670",
                                }}
                              >
                                {sent && rate > 0 ? rate : ""}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                      <tr>
                        <td />
                        {Array.from({ length: 24 }, (_, hour) => (
                          <td key={hour} className="pt-1 text-center text-[8px] text-[#B0AAC4]">
                            {hour % 6 === 0 ? hour : ""}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className={CARD}>
                <h3 className="text-sm font-semibold text-[#1E1B2E]">Best windows</h3>
                <p className="mb-3 text-xs text-[#847FA0]">Highest open rate (min. 3 sends)</p>
                {bestSendTimes.length === 0 ? (
                  <p className="text-sm text-[#847FA0]">Not enough sends yet to call a best time.</p>
                ) : (
                  <ol className="space-y-2">
                    {bestSendTimes.map((b) => (
                      <li key={`${b.day}-${b.hour}`} className="flex items-center justify-between gap-2 text-sm">
                        <span className="text-[#4A465C]">
                          {DAY_LABELS[b.day]} {String(b.hour).padStart(2, "0")}:00
                        </span>
                        <span className="tabular-nums text-[#847FA0]">
                          <b className="font-semibold text-[#1E1B2E]">{b.rate}%</b> · {b.sent} sent
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          </section>
        ) : null}

        {/* ── Domain authentication ────────────────────────────────────────── */}
        {domainAuth && domainAuth.length > 0 ? (
          <section>
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[#847FA0]">
              Domain authentication
            </h2>
            <div className={CARD}>
              <div className="mb-3 flex items-center gap-2">
                <FiShield className="h-4 w-4 text-[#701CC0]" />
                <p className="text-xs text-[#847FA0]">
                  SPF, DKIM and DMARC are the biggest controllable factor in inbox placement — checked live over DNS.
                </p>
              </div>
              <div className="space-y-3">
                {domainAuth.map((d) => (
                  <div key={d.domain} className="rounded-xl border border-[#EEE6F7] p-3">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-[#1E1B2E]">{d.domain}</span>
                      <span className="text-xs text-[#847FA0]">{d.accounts.length} mailbox{d.accounts.length === 1 ? "" : "es"}</span>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      {([
                        ["SPF", d.spf],
                        ["DKIM", d.dkim],
                        ["DMARC", d.dmarc],
                      ] as const).map(([name, rec]) => (
                        <div key={name} className="flex items-start gap-2">
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_STYLES[rec.status]}`}>
                            {name}
                          </span>
                          <span className="text-xs leading-snug text-[#6B7280]">{rec.detail}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {/* ── Breakdowns ───────────────────────────────────────────────────── */}
        <section>
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[#847FA0]">Breakdown</h2>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className={CARD}>
              <h3 className="mb-3 text-sm font-semibold text-[#1E1B2E]">Top messages by opens</h3>
              {derived.topMessages.length === 0 ? (
                <p className="text-sm text-[#847FA0]">No opened messages yet.</p>
              ) : (
                <table className="w-full table-fixed text-sm">
                  <thead>
                    <tr className="text-[10.5px] uppercase tracking-wide text-[#847FA0]">
                      <th className="pb-2 text-left font-semibold">Subject</th>
                      <th className="w-16 pb-2 text-right font-semibold">Opens</th>
                      <th className="w-16 pb-2 text-right font-semibold">Clicks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {derived.topMessages.map((m, i) => (
                      <tr key={m.messageId || i} className="border-t border-[#EEE6F7]/70">
                        <td className="max-w-0 truncate py-2 pr-2 text-[#4A465C]">{m.subject || "(No subject)"}</td>
                        <td className="py-2 text-right font-semibold tabular-nums text-[#1E1B2E]">{m.openCount}</td>
                        <td className="py-2 text-right tabular-nums text-[#4A465C]">{m.clickCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className={CARD}>
              <h3 className="mb-3 text-sm font-semibold text-[#1E1B2E]">Per-account performance</h3>
              {derived.perAccount.length === 0 ? (
                <p className="text-sm text-[#847FA0]">No sent mail yet.</p>
              ) : (
                <table className="w-full table-fixed text-sm">
                  <thead>
                    <tr className="text-[10.5px] uppercase tracking-wide text-[#847FA0]">
                      <th className="pb-2 text-left font-semibold">Account</th>
                      <th className="w-14 pb-2 text-right font-semibold">Sent</th>
                      <th className="w-16 pb-2 text-right font-semibold">Opens</th>
                      <th className="w-16 pb-2 text-right font-semibold">Clicks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {derived.perAccount.map((a) => (
                      <tr key={a.email} className="border-t border-[#EEE6F7]/70">
                        <td className="max-w-0 truncate py-2 pr-2 text-[#4A465C]">{a.email}</td>
                        <td className="py-2 text-right tabular-nums text-[#1E1B2E]">{a.sent}</td>
                        <td className="py-2 text-right tabular-nums text-[#1E1B2E]">{a.opens}</td>
                        <td className="py-2 text-right tabular-nums text-[#4A465C]">{a.clicks}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </section>

        {/* ── Outreach (campaigns/meetings) — supplementary, so it sits last ── */}
        {hasOutreach && report ? (
          <section>
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[#847FA0]">Outreach</h2>
            <div className={CARD}>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {[
                  { label: "Campaigns", value: String(report.campaigns), sub: `${report.activeCampaigns} active` },
                  { label: "Contacts", value: report.totalContacts.toLocaleString(), sub: "enrolled" },
                  { label: "Reply rate", value: `${Math.round(report.replyRate * 100)}%`, sub: "of enrolled" },
                  { label: "Meetings booked", value: String(report.bookings), sub: `${report.upcomingBookings} upcoming` },
                ].map((k) => (
                  <div key={k.label}>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-[#847FA0]">{k.label}</div>
                    <div className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-[#1E1B2E]">{k.value}</div>
                    <div className="text-xs tabular-nums text-[#847FA0]">{k.sub}</div>
                  </div>
                ))}
              </div>
              {Object.keys(report.statusMap).length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-[#EEE6F7] pt-4">
                  {Object.entries(report.statusMap).map(([status, count]) => (
                    <span key={status} className="rounded-full bg-[#F5EFFF] px-2.5 py-1 text-xs font-medium capitalize text-[#701CC0]">
                      {status.replace(/_/g, " ")}: {count}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
};

export default EmailAnalyticsView;
