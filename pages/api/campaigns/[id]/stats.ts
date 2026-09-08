import type { NextApiRequest } from "next";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { asQueryStr } from "@/lib/api/parsing";

function getCampaignId(req: NextApiRequest) {
  const raw = req.query.id;
  return Array.isArray(raw) ? raw[0] : raw || "";
}

function dateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default withAuth(async (req, res) => {
  const campaignId = getCampaignId(req);
  if (!campaignId) {
    res.status(400).json({ message: "Campaign id is required." });
    return;
  }

  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId },
    select: { id: true },
  });
  if (!campaign) {
    res.status(404).json({ message: "Campaign not found." });
    return;
  }

  const daysRaw = Number(asQueryStr(req.query.days));
  const days = Number.isFinite(daysRaw) && daysRaw > 0 ? Math.min(Math.floor(daysRaw), 90) : 7;

  const rangeStart = new Date();
  rangeStart.setHours(0, 0, 0, 0);
  rangeStart.setDate(rangeStart.getDate() - (days - 1));

  const [dailyRows, leadStatusGroups, contactTotal, bookedContacts, steps, sentByStep, openedByStep, clickedByStep] =
    await Promise.all([
      prisma.campaignDailyStat.findMany({
        where: { campaign_id: campaignId, date: { gte: rangeStart } },
        orderBy: { date: "asc" },
      }),
      prisma.campaignContact.groupBy({ by: ["lead_status"], where: { campaign_id: campaignId }, _count: true }),
      prisma.campaignContact.count({ where: { campaign_id: campaignId } }),
      // Distinct contacts with a booking, not a booking count — a rebooked/rescheduled contact
      // should still only count once toward "did this campaign land a meeting with them".
      prisma.campaignContact.count({ where: { campaign_id: campaignId, bookings: { some: {} } } }),
      prisma.campaignStep.findMany({
        where: { campaign_id: campaignId },
        orderBy: { step_order: "asc" },
        select: { id: true, step_order: true, name: true },
      }),
      prisma.emailOutboundMessage.groupBy({
        by: ["step_id"],
        where: { campaign_id: campaignId, step_id: { not: null } },
        _count: true,
      }),
      // No groupBy for "distinct messages with an OPEN event, by step" — count distinct messages,
      // not events (a message opened three times still counts once), so this fetches the message
      // rows themselves and reduces to per-step counts below rather than grouping event rows.
      prisma.emailOutboundMessage.findMany({
        where: { campaign_id: campaignId, step_id: { not: null }, email_tracking_events: { some: { event_type: "OPEN" } } },
        select: { step_id: true },
      }),
      prisma.emailOutboundMessage.findMany({
        where: { campaign_id: campaignId, step_id: { not: null }, email_tracking_events: { some: { event_type: "CLICK" } } },
        select: { step_id: true },
      }),
    ]);

  const byDate = new Map(dailyRows.map((row) => [dateKey(row.date), row]));
  const daily = Array.from({ length: days }, (_, i) => {
    const d = new Date(rangeStart);
    d.setDate(d.getDate() + i);
    const key = dateKey(d);
    const row = byDate.get(key);
    return {
      date: key,
      emailsSent: row?.emails_sent ?? 0,
      opens: row?.opens ?? 0,
      clicks: row?.clicks ?? 0,
      replies: row?.replies ?? 0,
      bounces: row?.bounces ?? 0,
      unsubscribes: row?.unsubscribes ?? 0,
    };
  });

  const totalSent = daily.reduce((sum, d) => sum + d.emailsSent, 0);
  const totalOpens = daily.reduce((sum, d) => sum + d.opens, 0);
  const totalClicks = daily.reduce((sum, d) => sum + d.clicks, 0);
  const totalBounces = daily.reduce((sum, d) => sum + d.bounces, 0);
  const totalUnsubscribes = daily.reduce((sum, d) => sum + d.unsubscribes, 0);
  // Previously `contactTotal - no_response count` — not "how many contacts replied", but "how
  // many aren't currently no_response", which also counts contacts who exited via
  // sendQueueTick.ts's sequence-exhaustion auto-not_interested or a bounce/unsubscribe/DNC
  // removal, neither of which involved a reply. The daily counter is the actual reply signal
  // (bumped by both the Smartlead webhook and, as of this fix, the internal-provider inbound-reply
  // path in lib/gmail/inboundActions.ts) — same source as opens/clicks/bounces/unsubscribes above,
  // so it's summed and rated the same way as those instead of derived from lead_status.
  const totalReplies = daily.reduce((sum, d) => sum + d.replies, 0);
  const leadStatusCounts = Object.fromEntries(leadStatusGroups.map((g) => [g.lead_status, g._count]));

  // Per-step engagement — where the sequence loses people. Sent/opened/clicked only: attributing
  // a reply to one specific step would mean inferring it from timing (nothing records which step
  // a reply was "to"), which is a real design call rather than a straightforward count, so it's
  // deliberately left out here rather than guessed at.
  const sentCountByStep = new Map(sentByStep.map((row) => [row.step_id as string, row._count]));
  const countByStep = (rows: { step_id: string | null }[]) => {
    const counts = new Map<string, number>();
    for (const row of rows) {
      if (!row.step_id) continue;
      counts.set(row.step_id, (counts.get(row.step_id) ?? 0) + 1);
    }
    return counts;
  };
  const openedCountByStep = countByStep(openedByStep);
  const clickedCountByStep = countByStep(clickedByStep);
  const stepBreakdown = steps.map((step) => {
    const sent = sentCountByStep.get(step.id) ?? 0;
    const opened = openedCountByStep.get(step.id) ?? 0;
    const clicked = clickedCountByStep.get(step.id) ?? 0;
    return {
      stepId: step.id,
      stepOrder: step.step_order,
      name: step.name,
      sent,
      opened,
      clicked,
      openRate: sent > 0 ? opened / sent : 0,
      clickRate: sent > 0 ? clicked / sent : 0,
    };
  });

  res.setHeader("Cache-Control", "private, max-age=30");
  res.status(200).json({
    daily,
    totals: {
      emailsSent: totalSent,
      opens: totalOpens,
      clicks: totalClicks,
      bounces: totalBounces,
      unsubscribes: totalUnsubscribes,
      contacts: contactTotal,
      replied: totalReplies,
      booked: bookedContacts,
    },
    rates: {
      openRate: totalSent > 0 ? totalOpens / totalSent : 0,
      clickRate: totalSent > 0 ? totalClicks / totalSent : 0,
      replyRate: totalSent > 0 ? totalReplies / totalSent : 0,
      bounceRate: totalSent > 0 ? totalBounces / totalSent : 0,
      unsubscribeRate: totalSent > 0 ? totalUnsubscribes / totalSent : 0,
      bookingRate: contactTotal > 0 ? bookedContacts / contactTotal : 0,
    },
    leadStatusCounts,
    stepBreakdown,
  });
}, { methods: ["GET"] });
