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

export default withAuth(async (req, res, session) => {
  const campaignId = getCampaignId(req);
  if (!campaignId) {
    res.status(400).json({ message: "Campaign id is required." });
    return;
  }

  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, company_id: session.companyId },
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

  const [dailyRows, leadStatusGroups, contactTotal] = await Promise.all([
    prisma.campaignDailyStat.findMany({
      where: { campaign_id: campaignId, date: { gte: rangeStart } },
      orderBy: { date: "asc" },
    }),
    prisma.campaignContact.groupBy({ by: ["lead_status"], where: { campaign_id: campaignId }, _count: true }),
    prisma.campaignContact.count({ where: { campaign_id: campaignId } }),
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
    };
  });

  const totalSent = daily.reduce((sum, d) => sum + d.emailsSent, 0);
  const totalOpens = daily.reduce((sum, d) => sum + d.opens, 0);
  const totalClicks = daily.reduce((sum, d) => sum + d.clicks, 0);
  const leadStatusCounts = Object.fromEntries(leadStatusGroups.map((g) => [g.lead_status, g._count]));
  const repliedCount = contactTotal - (leadStatusCounts["no_response"] ?? 0);

  res.status(200).json({
    daily,
    totals: { emailsSent: totalSent, opens: totalOpens, clicks: totalClicks, contacts: contactTotal, replied: repliedCount },
    rates: {
      openRate: totalSent > 0 ? totalOpens / totalSent : 0,
      clickRate: totalSent > 0 ? totalClicks / totalSent : 0,
      replyRate: contactTotal > 0 ? repliedCount / contactTotal : 0,
    },
    leadStatusCounts,
  });
}, { methods: ["GET"] });
