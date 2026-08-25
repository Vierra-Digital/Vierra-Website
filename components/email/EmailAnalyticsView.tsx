"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FiClock, FiEye, FiMousePointer, FiSend, FiShield } from "react-icons/fi";

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
    topLinks: { url: string; clicks: number }[];
    recipientDomains: { domain: string; sent: number; opened: number }[];
    openHours: { hour: number; count: number }[];
    subjectStats: { label: string; sent: number; opened: number }[];
    repeatOpened: number;
    openedTotal: number;
  };
  messages: StatMessage[];
  truncated: boolean;
};

type PostmasterEntry =
  | { ok: true; stats: { domain: string; date: string; userReportedSpamRatio: number | null; domainReputation: string | null; spfSuccessRatio: number | null; dkimSuccessRatio: number | null; dmarcSuccessRatio: number | null } }
  | { ok: false; domain: string; reason: string; message: string };

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

const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 100) : 0);

const dayKey = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

/**
 * Layout primitives for this report. The page is deliberately NOT a grid of cards — nesting
 * bordered boxes inside bordered boxes is what made it read as cluttered. Hierarchy comes from
 * a hairline band per section, a small-caps label, and whitespace.
 */
const Section: React.FC<{ title: string; note?: string; children: React.ReactNode }> = ({ title, note, children }) => (
  <section className="border-b border-[#E7E3EF] px-7 py-8">
    <header className="mb-5">
      <h2 className="text-[15px] font-semibold tracking-tight text-[#1E1B2E]">{title}</h2>
      {note ? <p className="mt-0.5 text-[13px] text-[#7B7691]">{note}</p> : null}
    </header>
    {children}
  </section>
);

/**
 * Light containment for a block of data. A faint tinted ground + generous padding groups the
 * content and gives the eye an edge to follow — without the border+shadow "card" chrome that
 * made the earlier version feel cluttered when repeated a dozen times.
 */
const Panel: React.FC<{ title?: string; note?: string; className?: string; children: React.ReactNode }> = ({
  title,
  note,
  className = "",
  children,
}) => (
  <div className={`rounded-xl bg-[#FBFAFD] p-4 ${className}`}>
    {title ? (
      <div className="mb-3">
        <h3 className="text-[13px] font-semibold text-[#2A2540]">{title}</h3>
        {note ? <p className="mt-0.5 text-xs text-[#7B7691]">{note}</p> : null}
      </div>
    ) : null}
    {children}
  </div>
);

const EmptyNote: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-[13px] text-[#7B7691]">{children}</p>
);

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-baseline justify-between gap-2">
    <dt className="text-[#847FA0]">{label}</dt>
    <dd className="font-semibold tabular-nums text-[#1E1B2E]">{value}</dd>
  </div>
);

/** Borderless table: hairline row rules only, first column truncates, rest are right-aligned. */
const FlatTable: React.FC<{ head: string[]; rows: { key: string; cells: (string | number)[] }[] }> = ({ head, rows }) => (
  <table className="w-full table-fixed text-[13px]">
    <thead>
      <tr className="text-[11px] uppercase tracking-wide text-[#7B7691]">
        {head.map((h, i) => (
          <th key={h} className={i === 0 ? "pb-2.5 text-left font-semibold" : "w-[84px] pb-2.5 text-right font-semibold"}>
            {h}
          </th>
        ))}
      </tr>
    </thead>
    <tbody>
      {rows.map((row) => (
        <tr key={row.key} className="border-t border-[#EDEAF3] transition-colors hover:bg-white">
          {row.cells.map((cell, i) => (
            <td
              key={i}
              title={i === 0 ? String(cell) : undefined}
              className={
                i === 0
                  ? "max-w-0 truncate py-2.5 pr-3 text-[#3C3752]"
                  : "py-2.5 text-right font-semibold tabular-nums text-[#1E1B2E]"
              }
            >
              {cell}
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  </table>
);

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
  const [postmaster, setPostmaster] = useState<PostmasterEntry[] | null>(null);
  const accountsKey = accounts.join(",");

  useEffect(() => {
    let cancelled = false;
    // Entering the loading state for a fetch that the effect itself performs. The flag has to be set
    // when the request starts, which is here — it is not derivable from the props that triggered it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (rangeDays > 0) {
      const from = new Date();
      from.setDate(from.getDate() - rangeDays);
      params.set("from", from.toISOString());
    }
    // NOTE: deliberately NOT scoping to the panel's selected inboxes. outbound.account_id is
    // nullable, so filtering by it silently drops every message that isn't attributed to an
    // account row — which reads as "analytics is broken". Report on all of the user's sent mail.
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
            topLinks: Array.isArray(payload?.behaviour?.topLinks) ? payload.behaviour.topLinks : [],
            recipientDomains: Array.isArray(payload?.behaviour?.recipientDomains)
              ? payload.behaviour.recipientDomains
              : [],
            openHours: Array.isArray(payload?.behaviour?.openHours) ? payload.behaviour.openHours : [],
            subjectStats: Array.isArray(payload?.behaviour?.subjectStats) ? payload.behaviour.subjectStats : [],
            repeatOpened: n(payload?.behaviour?.repeatOpened),
            openedTotal: n(payload?.behaviour?.openedTotal),
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

  // Postmaster reputation is Google-published and independent of the date range, so it loads once.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/email/postmaster", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && Array.isArray(d?.domains)) setPostmaster(d.domains);
      })
      .catch(() => {
        /* reputation data is supplementary */
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
    <div className="h-full overflow-y-auto bg-white">
      {/* Sticky header — the only chrome on the page. */}
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[#EDEAF3] bg-white/90 px-6 py-3.5 backdrop-blur-md">
        <div className="min-w-0">
          <h1 className="text-base font-semibold tracking-tight text-[#1E1B2E]">Email Analytics</h1>
          <p className="truncate text-[13px] text-[#7B7691]">Outbound performance — mail you send, not mail you receive.</p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5 rounded-lg bg-[#F4F2F8] p-0.5">
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
                rangeDays === opt.days ? "bg-white text-[#1E1B2E] shadow-sm" : "text-[#6B7280] hover:text-[#1E1B2E]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {derived.sent === 0 ? (
        <p className="border-b border-[#EDEAF3] px-6 py-3 text-sm text-[#6B7280]">
          No sent mail in this range. Try a wider range — analytics covers mail sent from the panel, and
          open/click rates need tracking enabled at send time.
        </p>
      ) : null}

      {/* ── Headline metrics: one flat strip, divided by hairlines, no boxes ───────── */}
      <div className="grid grid-cols-2 gap-px border-b border-[#E7E3EF] bg-[#E7E3EF] lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="bg-white px-7 py-6">
            <div className="flex items-center gap-1.5 text-[#7B7691]">
              {k.icon}
              <span className="text-[11px] font-semibold uppercase tracking-wide">{k.label}</span>
            </div>
            <div className="mt-2.5 text-[32px] font-bold leading-none tabular-nums tracking-tight text-[#1E1B2E]">
              {k.value}
            </div>
            <div className="mt-2 min-h-[1rem] text-[13px] tabular-nums text-[#7B7691]">{k.sub ?? ""}</div>
          </div>
        ))}
      </div>

      {/* Each Section is a hairline-separated band — hierarchy from type + space, not borders. */}
      <Section title="Engagement" note={`${derived.tracked.toLocaleString()} tracked messages`}>
        <div className="grid grid-cols-1 gap-8 xl:grid-cols-[1.7fr_1fr]">
          <Panel title="Opens &amp; clicks over time">
            {derived.series.length === 0 ? (
              <EmptyNote>No tracking activity yet.</EmptyNote>
            ) : (
              <div className="h-[230px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={derived.series} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                    <defs>
                      <linearGradient id="gOpens" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#701CC0" stopOpacity={0.24} />
                        <stop offset="100%" stopColor="#701CC0" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gClicks" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#8B3BEE" stopOpacity={0.18} />
                        <stop offset="100%" stopColor="#8B3BEE" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F2EFF8" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#847FA0" }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#847FA0" }} tickLine={false} axisLine={false} allowDecimals={false} width={32} />
                    <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #EAE5F4", fontSize: 12 }} />
                    <Area type="monotone" dataKey="opens" name="Opens" stroke="#701CC0" strokeWidth={2} fill="url(#gOpens)" />
                    <Area type="monotone" dataKey="clicks" name="Clicks" stroke="#8B3BEE" strokeWidth={2} fill="url(#gClicks)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </Panel>

          <Panel title="Funnel">
            <div className="space-y-4">
              {[
                { label: "Sent", value: derived.tracked, w: 100, color: "#5E17A8" },
                { label: "Opened", value: derived.openedMessages, w: derived.openRate, color: "#701CC0" },
                { label: "Clicked", value: derived.clickedMessages, w: derived.clickRate, color: "#8B3BEE" },
              ].map((s) => (
                <div key={s.label}>
                  <div className="mb-1.5 flex items-baseline justify-between text-xs">
                    <span className="font-medium text-[#4A465C]">{s.label}</span>
                    <span className="tabular-nums text-[#847FA0]">
                      <b className="font-semibold text-[#1E1B2E]">{s.value.toLocaleString()}</b> · {s.w}%
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-[#EAE4F4]">
                    <div className="h-full rounded-full" style={{ width: `${Math.max(s.w, 2)}%`, background: s.color }} />
                  </div>
                </div>
              ))}
            </div>
            <dl className="mt-5 space-y-2.5 text-[13px]">
              <Stat label="Click-to-open rate" value={`${derived.ctor}%`} />
              <Stat
                label="Opened more than once"
                value={
                  behaviour && behaviour.openedTotal > 0
                    ? `${pct(behaviour.repeatOpened, behaviour.openedTotal)}%`
                    : "—"
                }
              />
              <Stat label="Total opens / clicks" value={`${derived.opens.toLocaleString()} / ${derived.clicks.toLocaleString()}`} />
            </dl>
          </Panel>
        </div>
      </Section>

      {/* ── Deliverability ─────────────────────────────────────────────────────────── */}
      {deliverability ? (
        <Section title="Deliverability" note="Delivery outcomes and sender reputation">
          <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-5">
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
                <div className="mt-1 text-xl font-bold tabular-nums tracking-tight text-[#1E1B2E]">{k.value}</div>
                <div className="text-xs tabular-nums text-[#847FA0]">{k.sub}</div>
              </div>
            ))}
          </div>
          {deliverability.topFailReasons.length > 0 ? (
            <div className="mt-5">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#847FA0]">Top failure reasons</div>
              <div className="flex flex-wrap gap-2">
                {deliverability.topFailReasons.map((r) => (
                  <span key={r.reason} className="rounded-md bg-[#FEF2F2] px-2 py-1 text-xs font-medium text-[#B91C1C]">
                    {r.reason}: {r.count}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          {derived.filteredOpens > 0 ? (
            <p className="mt-4 text-[13px] text-[#7B7691]">
              {derived.filteredOpens.toLocaleString()} machine pre-fetches (Apple Mail Privacy, security scanners) excluded from opens.
            </p>
          ) : null}
        </Section>
      ) : null}

      {/* ── Domain authentication ──────────────────────────────────────────────────── */}
      {domainAuth && domainAuth.length > 0 ? (
        <Section title="Domain authentication" note="SPF, DKIM and DMARC — checked live over DNS">
          {/* Google's own view of the domain: spam-complaint rate and the auth pass rates Gmail
              actually observed. Strictly better evidence than "the DNS record exists", so it sits
              above the record check. Unavailable states explain what to fix rather than hiding. */}
          {postmaster && postmaster.length > 0 ? (
            <Panel title="Gmail reputation (Postmaster Tools)" className="mb-4">
              <div className="space-y-3">
                {postmaster.map((entry) => {
                  if (!entry.ok) {
                    return (
                      <div key={entry.domain} className="text-[13px]">
                        <span className="font-semibold text-[#1E1B2E]">{entry.domain}</span>
                        <span className="ml-2 text-[#7B7691]">{entry.message}</span>
                      </div>
                    );
                  }
                  const spamPct = entry.stats.userReportedSpamRatio === null ? null : entry.stats.userReportedSpamRatio * 100;
                  const tone =
                    spamPct === null ? "neutral" : spamPct < 0.1 ? "good" : spamPct < 0.3 ? "warn" : "bad";
                  const toneStyle = {
                    good: "bg-[#ECFDF5] text-[#047857]",
                    warn: "bg-[#FFFBEB] text-[#B45309]",
                    bad: "bg-[#FEF2F2] text-[#B91C1C]",
                    neutral: "bg-[#F4F2F8] text-[#5B5670]",
                  }[tone];
                  const ratio = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);
                  return (
                    <div key={entry.stats.domain} className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[13px]">
                      <span className="font-semibold text-[#1E1B2E]">{entry.stats.domain}</span>
                      <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${toneStyle}`}>
                        spam {spamPct === null ? "—" : `${spamPct.toFixed(3)}%`}
                      </span>
                      <span className="text-[#7B7691]">
                        reputation <b className="text-[#1E1B2E]">{entry.stats.domainReputation ?? "—"}</b>
                      </span>
                      <span className="text-[#7B7691]">
                        SPF {ratio(entry.stats.spfSuccessRatio)} · DKIM {ratio(entry.stats.dkimSuccessRatio)} · DMARC{" "}
                        {ratio(entry.stats.dmarcSuccessRatio)}
                      </span>
                      <span className="text-xs text-[#9A94AF]">as of {entry.stats.date}</span>
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 text-xs text-[#7B7691]">
                Google flags delivery problems above 0.10% spam complaints, and throttles at 0.30%.
              </p>
            </Panel>
          ) : null}
          <div className="divide-y divide-[#F2EFF8]">
            {domainAuth.map((d) => (
              <div key={d.domain} className="py-3 first:pt-0 last:pb-0">
                <div className="mb-2 flex flex-wrap items-baseline gap-2">
                  <FiShield className="h-3.5 w-3.5 text-[#701CC0]" />
                  <span className="text-sm font-semibold text-[#1E1B2E]">{d.domain}</span>
                  <span className="text-[13px] text-[#7B7691]">
                    {d.accounts.length} mailbox{d.accounts.length === 1 ? "" : "es"}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {([["SPF", d.spf], ["DKIM", d.dkim], ["DMARC", d.dmarc]] as const).map(([name, rec]) => (
                    <div key={name} className="flex items-start gap-2">
                      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${STATUS_STYLES[rec.status]}`}>
                        {name}
                      </span>
                      <span className="text-xs leading-snug text-[#6B7280]">{rec.detail}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      {/* ── Timing ─────────────────────────────────────────────────────────────────── */}
      {behaviour && behaviour.sendTimes.length > 0 ? (
        <Section title="Timing" note={`Based on the last ${behaviour.sampleSize.toLocaleString()} tracked messages, local time`}>
          <div className="grid grid-cols-1 gap-8 xl:grid-cols-[1.7fr_1fr]">
            <Panel title="Send volume &amp; open rate by hour" note="Shade = volume sent · number = % opened">
              <div className="overflow-x-auto">
                <table className="border-separate border-spacing-[2px]">
                  <tbody>
                    {DAY_LABELS.map((label, day) => (
                      <tr key={label}>
                        <td className="pr-2.5 text-right text-[11px] font-medium text-[#5B5670]">{label}</td>
                        {Array.from({ length: 24 }, (_, hour) => {
                          const bucket = behaviour.sendTimes.find((b) => b.day === day && b.hour === hour);
                          const sent = bucket?.sent ?? 0;
                          const rate = bucket ? pct(bucket.opened, bucket.sent) : 0;
                          return (
                            <td
                              key={hour}
                              title={sent ? `${label} ${hour}:00 — ${sent} sent, ${rate}% opened` : `${label} ${hour}:00 — no sends`}
                              className="h-6 w-6 rounded text-center text-[10px] font-semibold leading-6"
                              style={{
                                background: sent ? `rgba(112,28,192,${0.1 + (sent / maxBucketSent) * 0.75})` : "#F6F4FA",
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
                        <td key={hour} className="pt-1.5 text-center text-[10px] text-[#9A94AF]">
                          {hour % 6 === 0 ? hour : ""}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </Panel>

            <div className="space-y-4">
              <Panel title="Best windows to send">
                {bestSendTimes.length === 0 ? (
                  <EmptyNote>Not enough sends yet to call a best time.</EmptyNote>
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
              </Panel>
              <Panel title="When recipients open">
                {!behaviour.openHours.some((h) => h.count > 0) ? (
                  <EmptyNote>No opens recorded yet.</EmptyNote>
                ) : (
                  <div className="flex h-16 items-end gap-[2px]">
                    {behaviour.openHours.map((h) => {
                      const peak = Math.max(1, ...behaviour.openHours.map((x) => x.count));
                      return (
                        <div
                          key={h.hour}
                          title={`${h.hour}:00 — ${h.count} opens`}
                          className="flex-1 rounded-t-sm bg-[#701CC0]"
                          style={{ height: `${Math.max(2, (h.count / peak) * 100)}%`, opacity: h.count ? 1 : 0.15 }}
                        />
                      );
                    })}
                  </div>
                )}
                <div className="mt-1.5 flex justify-between text-[10px] text-[#9A94AF]">
                  <span>00</span><span>06</span><span>12</span><span>18</span><span>23</span>
                </div>
              </Panel>
            </div>
          </div>
        </Section>
      ) : null}

      {/* ── Content ────────────────────────────────────────────────────────────────── */}
      <Section title="Content" note="What you sent, and what it earned">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <Panel title="Top messages by opens">
            {derived.topMessages.length === 0 ? (
              <EmptyNote>No opened messages yet.</EmptyNote>
            ) : (
              <FlatTable
                head={["Subject", "Opens", "Clicks"]}
                rows={derived.topMessages.map((m, i) => ({
                  key: m.messageId || String(i),
                  cells: [m.subject || "(No subject)", m.openCount, m.clickCount],
                }))}
              />
            )}
          </Panel>
          <Panel title="Subject length vs open rate">
            {!behaviour || behaviour.subjectStats.length === 0 ? (
              <EmptyNote>Not enough data yet.</EmptyNote>
            ) : (
              <FlatTable
                head={["Length", "Sent", "Open rate"]}
                rows={behaviour.subjectStats.map((b) => ({
                  key: b.label,
                  cells: [b.label, b.sent, `${pct(b.opened, b.sent)}%`],
                }))}
              />
            )}
          </Panel>
          <Panel title="Most clicked links">
            {!behaviour || behaviour.topLinks.length === 0 ? (
              <EmptyNote>No link clicks recorded yet.</EmptyNote>
            ) : (
              <FlatTable
                head={["URL", "Clicks"]}
                rows={behaviour.topLinks.map((l) => ({ key: l.url, cells: [l.url, l.clicks] }))}
              />
            )}
          </Panel>
          <Panel title="Open rate by recipient provider">
            {!behaviour || behaviour.recipientDomains.length === 0 ? (
              <EmptyNote>No recipient data yet.</EmptyNote>
            ) : (
              <FlatTable
                head={["Provider", "Sent", "Open rate"]}
                rows={behaviour.recipientDomains.map((d) => ({
                  key: d.domain,
                  cells: [d.domain, d.sent, `${pct(d.opened, d.sent)}%`],
                }))}
              />
            )}
          </Panel>
          <Panel title="Per-account performance">
            {derived.perAccount.length === 0 ? (
              <EmptyNote>No sent mail yet.</EmptyNote>
            ) : (
              <FlatTable
                head={["Account", "Sent", "Opens", "Clicks"]}
                rows={derived.perAccount.map((a) => ({
                  key: a.email,
                  cells: [a.email, a.sent, a.opens, a.clicks],
                }))}
              />
            )}
          </Panel>
        </div>
      </Section>

      {/* ── Outreach ───────────────────────────────────────────────────────────────── */}
      {hasOutreach && report ? (
        <Section title="Outreach" note="Campaigns and meetings">
          <div className="grid grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-4">
            {[
              { label: "Campaigns", value: String(report.campaigns), sub: `${report.activeCampaigns} active` },
              { label: "Contacts", value: report.totalContacts.toLocaleString(), sub: "enrolled" },
              { label: "Reply rate", value: `${Math.round(report.replyRate * 100)}%`, sub: "of enrolled" },
              { label: "Meetings booked", value: String(report.bookings), sub: `${report.upcomingBookings} upcoming` },
            ].map((k) => (
              <div key={k.label}>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-[#847FA0]">{k.label}</div>
                <div className="mt-1 text-xl font-bold tabular-nums tracking-tight text-[#1E1B2E]">{k.value}</div>
                <div className="text-xs tabular-nums text-[#847FA0]">{k.sub}</div>
              </div>
            ))}
          </div>
          {Object.keys(report.statusMap).length > 0 ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {Object.entries(report.statusMap).map(([status, count]) => (
                <span key={status} className="rounded-md bg-[#F5EFFF] px-2 py-1 text-xs font-medium capitalize text-[#701CC0]">
                  {status.replace(/_/g, " ")}: {count}
                </span>
              ))}
            </div>
          ) : null}
        </Section>
      ) : null}

      <div className="h-8" />
    </div>
  );
};

export default EmailAnalyticsView;
