import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";

import { asQueryStr } from "@/lib/api/parsing";

/** Rows returned for the display tables. Totals are aggregated separately, over ALL matches. */
const TABLE_ROW_LIMIT = 200;
/** Wider sample used only for the behavioural cuts (time-to-open, send-time performance). */
const ANALYSIS_SAMPLE_LIMIT = 2000;

export default withAuth(async (req, res, session) => {
  const userId = session.user.id;
  // `accounts` (comma-separated) is the panel's inbox selection; `accountEmail` kept for callers
  // that filter to a single mailbox.
  const accountsParam = asQueryStr(req.query.accounts).trim().toLowerCase();
  const accountEmail = asQueryStr(req.query.accountEmail).trim().toLowerCase();
  const requestedEmails = [
    ...new Set(
      [...accountsParam.split(","), accountEmail]
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean)
    ),
  ];
  const from = asQueryStr(req.query.from).trim();
  const to = asQueryStr(req.query.to).trim();

  let accountIds: string[] = [];
  if (requestedEmails.length > 0) {
    const accounts = await prisma.emailProviderAccount.findMany({
      where: { user_id: userId, account_email: { in: requestedEmails } },
      select: { id: true },
    });
    accountIds = accounts.map((a) => a.id);
    // Asked for specific mailboxes but none resolved → no data rather than "everything".
    if (accountIds.length === 0) {
      res.status(200).json({
        totals: { sent: 0, trackedMessages: 0, opens: 0, clicks: 0, openedMessages: 0, clickedMessages: 0, filteredOpens: 0 },
        deliverability: { attempted: 0, failed: 0, bounces: 0, unsubscribes: 0, replies: 0, topFailReasons: [] },
        messages: [],
      });
      return;
    }
  }

  const createdAtFilter =
    from || to
      ? {
          created_at: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          },
        }
      : {};

  const where: Prisma.EmailOutboundMessageWhereInput = {
    user_id: userId,
    ...(accountIds.length > 0 ? { account_id: { in: accountIds } } : {}),
    ...createdAtFilter,
  };
  const trackedWhere: Prisma.EmailOutboundMessageWhereInput = { ...where, tracking_enabled: true };
  const eventWhere = (eventType: string): Prisma.EmailTrackingEventWhereInput => ({
    event_type: eventType,
    email_outbound_messages: where,
  });

  // Totals are real aggregates over every matching message. (They used to be summed from the
  // most recent 200 rows, so any account past 200 sends reported numbers that were simply wrong
  // — and the date-range selector had no effect beyond that window.)
  const [
    sent,
    trackedMessages,
    openedMessages,
    clickedMessages,
    opens,
    clicks,
    filteredOpens,
    messages,
  ] = await Promise.all([
    prisma.emailOutboundMessage.count({ where }),
    prisma.emailOutboundMessage.count({ where: trackedWhere }),
    prisma.emailOutboundMessage.count({
      where: { ...trackedWhere, email_tracking_events: { some: { event_type: "OPEN" } } },
    }),
    prisma.emailOutboundMessage.count({
      where: { ...trackedWhere, email_tracking_events: { some: { event_type: "CLICK" } } },
    }),
    prisma.emailTrackingEvent.count({ where: eventWhere("OPEN") }),
    prisma.emailTrackingEvent.count({ where: eventWhere("CLICK") }),
    // Machine pre-fetches (Apple MPP, scanners) we deliberately exclude from opens — surfaced so
    // the number is auditable rather than silently dropped.
    prisma.emailTrackingEvent.count({ where: eventWhere("OPEN_PREFETCH") }),
    prisma.emailOutboundMessage.findMany({
      where,
      select: {
        id: true,
        gmail_message_id: true,
        account_id: true,
        subject: true,
        tracking_enabled: true,
        created_at: true,
        email_tracking_events: { select: { event_type: true, occurred_at: true } },
      },
      orderBy: { created_at: "desc" },
      take: TABLE_ROW_LIMIT,
    }),
  ]);

  // Deliverability: campaign sends carry real per-attempt outcomes (failures + reasons), and the
  // daily rollup carries provider-reported bounces/unsubscribes/replies (written by the Brevo
  // webhook). Scoped to the caller's company campaigns.
  const campaignSendWhere: Prisma.CampaignStepSendWhereInput = {
    campaign_contacts: { campaigns: { company_id: session.companyId } },
    ...(from || to
      ? { created_at: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } }
      : {}),
  };
  const [attempted, failed, failReasonGroups, dailyTotals] = await Promise.all([
    prisma.campaignStepSend.count({ where: campaignSendWhere }),
    prisma.campaignStepSend.count({ where: { ...campaignSendWhere, status: "failed" } }),
    prisma.campaignStepSend.groupBy({
      by: ["fail_reason"],
      where: { ...campaignSendWhere, status: "failed", fail_reason: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { fail_reason: "desc" } },
      take: 5,
    }),
    prisma.campaignDailyStat.aggregate({
      where: {
        campaigns: { company_id: session.companyId },
        ...(from ? { date: { gte: new Date(from) } } : {}),
      },
      _sum: { bounces: true, unsubscribes: true, replies: true },
    }),
  ]);

  // Wider, leaner sample for the behavioural cuts (time-to-open, send-time performance). Kept
  // separate from the display rows so those stay small while these stay statistically useful.
  const analysisRows = await prisma.emailOutboundMessage.findMany({
    where: trackedWhere,
    select: {
      created_at: true,
      subject: true,
      email_tracking_events: {
        where: { event_type: "OPEN" },
        select: { occurred_at: true },
        orderBy: { occurred_at: "asc" },
        take: 1,
      },
      email_outbound_recipients: { where: { recipient_type: "to" }, select: { email: true }, take: 1 },
    },
    orderBy: { created_at: "desc" },
    take: ANALYSIS_SAMPLE_LIMIT,
  });

  // Which link actually earns the clicks. Aggregated in JS so one query covers every event.
  const clickEvents = await prisma.emailTrackingEvent.findMany({
    where: { event_type: "CLICK", email_outbound_messages: where },
    select: { email_tracking_links: { select: { original_url: true } } },
    take: ANALYSIS_SAMPLE_LIMIT,
  });
  const linkCounts = new Map<string, number>();
  for (const e of clickEvents) {
    const url = e.email_tracking_links?.original_url;
    if (!url) continue;
    linkCounts.set(url, (linkCounts.get(url) ?? 0) + 1);
  }
  const topLinks = [...linkCounts.entries()]
    .map(([url, clicks]) => ({ url, clicks }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 6);

  // Open rate by recipient mail provider — Gmail/Outlook/etc. filter very differently, so this
  // is where a deliverability problem usually shows up first.
  const domainBuckets = new Map<string, { domain: string; sent: number; opened: number }>();
  for (const r of analysisRows) {
    const email = r.email_outbound_recipients[0]?.email || "";
    const domain = (email.split("@")[1] || "").toLowerCase();
    if (!domain) continue;
    const bucket = domainBuckets.get(domain) || { domain, sent: 0, opened: 0 };
    bucket.sent += 1;
    if (r.email_tracking_events.length > 0) bucket.opened += 1;
    domainBuckets.set(domain, bucket);
  }
  const recipientDomains = [...domainBuckets.values()].sort((a, b) => b.sent - a.sent).slice(0, 8);

  // When recipients actually open (their first open, by hour) — distinct from when we send, and
  // the number you'd schedule against.
  const openHourCounts = new Array<number>(24).fill(0);
  for (const r of analysisRows) {
    const first = r.email_tracking_events[0];
    if (first) openHourCounts[first.occurred_at.getHours()] += 1;
  }
  const openHours = openHourCounts.map((count, hour) => ({ hour, count }));

  // Subject length vs open rate — the cheapest lever on open rate there is.
  const SUBJECT_BUCKETS = [
    { label: "≤ 30 chars", max: 30 },
    { label: "31–50", max: 50 },
    { label: "51–70", max: 70 },
    { label: "70+", max: Number.POSITIVE_INFINITY },
  ];
  const subjectStats = SUBJECT_BUCKETS.map((b) => ({ label: b.label, sent: 0, opened: 0 }));
  for (const r of analysisRows) {
    const len = (r.subject || "").length;
    if (!len) continue;
    const idx = SUBJECT_BUCKETS.findIndex((b) => len <= b.max);
    if (idx < 0) continue;
    subjectStats[idx].sent += 1;
    if (r.email_tracking_events.length > 0) subjectStats[idx].opened += 1;
  }

  // Engagement depth: how many opened messages were opened more than once.
  const openGroups = await prisma.emailTrackingEvent.groupBy({
    by: ["outbound_message_id"],
    where: { event_type: "OPEN", email_outbound_messages: where },
    _count: { _all: true },
  });
  const repeatOpened = openGroups.filter((g) => g._count._all > 1).length;

  // Time-to-open: median is the honest summary here — a handful of messages opened weeks later
  // would drag a mean far past what "typical" means.
  const openDelaysMs = analysisRows
    .map((r) => {
      const first = r.email_tracking_events[0];
      return first ? first.occurred_at.getTime() - r.created_at.getTime() : null;
    })
    .filter((v): v is number => v !== null && v >= 0)
    .sort((a, b) => a - b);
  const medianTimeToOpenMs = openDelaysMs.length
    ? openDelaysMs[Math.floor(openDelaysMs.length / 2)]
    : null;

  // Send-time performance: for each (weekday, hour) bucket, how many were sent and how many got
  // opened — i.e. when is it actually worth sending, not just when do we happen to send.
  const sendBuckets = new Map<string, { day: number; hour: number; sent: number; opened: number }>();
  for (const r of analysisRows) {
    const day = r.created_at.getDay();
    const hour = r.created_at.getHours();
    const key = `${day}-${hour}`;
    const bucket = sendBuckets.get(key) || { day, hour, sent: 0, opened: 0 };
    bucket.sent += 1;
    if (r.email_tracking_events.length > 0) bucket.opened += 1;
    sendBuckets.set(key, bucket);
  }

  const uniqueAccountIds = [...new Set(messages.map((m) => m.account_id).filter((id): id is string => !!id))];
  const accountMap = new Map<string, string>();
  if (uniqueAccountIds.length > 0) {
    const accounts = await prisma.emailProviderAccount.findMany({
      where: { id: { in: uniqueAccountIds } },
      select: { id: true, account_email: true },
    });
    for (const a of accounts) accountMap.set(a.id, a.account_email);
  }

  const rows = messages.map((message) => {
    const openCount = message.email_tracking_events.filter((e) => e.event_type === "OPEN").length;
    const clickCount = message.email_tracking_events.filter((e) => e.event_type === "CLICK").length;
    return {
      messageId: message.gmail_message_id,
      accountEmail: message.account_id ? (accountMap.get(message.account_id) ?? null) : null,
      subject: message.subject,
      trackingEnabled: message.tracking_enabled,
      createdAt: message.created_at,
      openCount,
      clickCount,
    };
  });

  res.status(200).json({
    totals: { sent, trackedMessages, opens, clicks, openedMessages, clickedMessages, filteredOpens },
    deliverability: {
      attempted,
      failed,
      bounces: dailyTotals._sum.bounces ?? 0,
      unsubscribes: dailyTotals._sum.unsubscribes ?? 0,
      replies: dailyTotals._sum.replies ?? 0,
      topFailReasons: failReasonGroups.map((g) => ({ reason: g.fail_reason ?? "unknown", count: g._count._all })),
    },
    behaviour: {
      medianTimeToOpenMs,
      sampleSize: analysisRows.length,
      sendTimes: [...sendBuckets.values()],
      topLinks,
      recipientDomains,
      openHours,
      subjectStats: subjectStats.filter((b) => b.sent > 0),
      repeatOpened,
      openedTotal: openGroups.length,
    },
    /** Most recent messages, for the display tables only — totals above cover every match. */
    messages: rows,
    truncated: rows.length >= TABLE_ROW_LIMIT,
  });
}, { methods: ["GET"] });
