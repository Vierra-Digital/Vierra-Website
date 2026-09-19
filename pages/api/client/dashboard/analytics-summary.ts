import { prisma } from "@/lib/prisma";
import { withSession } from "@/lib/api/withSession";
import { asQueryStr } from "@/lib/api/parsing";

const MAX_DAYS = 180;
const DEFAULT_DAYS = 30;

/**
 * Simplified, client-safe analytics summary — the client-dashboard counterpart to the
 * staff-only EmailAnalyticsView. Deliberately built from CampaignDailyStat (already scoped by
 * Campaign.company_id) rather than reusing /api/gmail/tracking/stats: that endpoint scopes by
 * the STAFF sender's own user_id first and company only as a secondary filter, which is right
 * for "one staff member's sent mail" but wrong for "this client's campaign performance across
 * every staff member who has sent for them."
 */
export default withSession(
  async (req, res, session) => {
    if (session.kind !== "client") {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    const companyId = session.companyId;
    const daysRaw = Number(asQueryStr(req.query.days));
    const days = Number.isFinite(daysRaw) && daysRaw > 0 ? Math.min(Math.floor(daysRaw), MAX_DAYS) : DEFAULT_DAYS;
    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    const campaignWhere = { company_id: companyId };

    const [dailyStats, campaignsTotal, campaignsActive, totalContacts, byStatus] = await Promise.all([
      prisma.campaignDailyStat.findMany({
        where: { campaigns: campaignWhere, date: { gte: since } },
        orderBy: { date: "asc" },
        select: { date: true, emails_sent: true, opens: true, clicks: true, replies: true, bounces: true, unsubscribes: true },
      }),
      prisma.campaign.count({ where: campaignWhere }),
      prisma.campaign.count({ where: { ...campaignWhere, status: "active" } }),
      prisma.campaignContact.count({ where: { campaigns: campaignWhere } }),
      prisma.campaignContact.groupBy({ by: ["lead_status"], where: { campaigns: campaignWhere }, _count: true }),
    ]);

    const totals = dailyStats.reduce(
      (acc, row) => {
        acc.sent += row.emails_sent;
        acc.opens += row.opens;
        acc.clicks += row.clicks;
        acc.replies += row.replies;
        acc.bounces += row.bounces;
        acc.unsubscribes += row.unsubscribes;
        return acc;
      },
      { sent: 0, opens: 0, clicks: 0, replies: 0, bounces: 0, unsubscribes: 0 }
    );

    const statusMap: Record<string, number> = {};
    for (const row of byStatus) statusMap[row.lead_status] = row._count;
    const repliedCount = (statusMap.replied || 0) + (statusMap.interested || 0) + (statusMap.booked || 0);

    const trend = dailyStats.map((row) => ({
      date: row.date.toISOString().slice(0, 10),
      sent: row.emails_sent,
      opens: row.opens,
      clicks: row.clicks,
    }));

    res.status(200).json({
      days,
      totals,
      trend,
      campaigns: { total: campaignsTotal, active: campaignsActive },
      contacts: { total: totalContacts, replyRate: totalContacts > 0 ? repliedCount / totalContacts : 0 },
    });
  },
  { methods: ["GET"] }
);
