import type { NextApiRequest } from "next";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { asQueryStr } from "@/lib/api/parsing";
import { serializeCampaignContact, LEAD_STATUSES } from "@/lib/api/campaigns";

function getCampaignId(req: NextApiRequest) {
  const raw = req.query.id;
  return Array.isArray(raw) ? raw[0] : raw || "";
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

  const leadStatus = asQueryStr(req.query.leadStatus);
  const search = asQueryStr(req.query.search);
  const pageRaw = Number(asQueryStr(req.query.page));
  const limitRaw = Number(asQueryStr(req.query.limit));
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.floor(limitRaw), 100) : 25;

  const where: any = { campaign_id: campaignId };
  if (leadStatus && (LEAD_STATUSES as readonly string[]).includes(leadStatus)) where.lead_status = leadStatus;
  if (search) {
    where.OR = [
      { contact_email: { contains: search, mode: "insensitive" } },
      { contact_first_name: { contains: search, mode: "insensitive" } },
      { contact_last_name: { contains: search, mode: "insensitive" } },
      { contact_business: { contains: search, mode: "insensitive" } },
    ];
  }

  const [total, statusCounts, contacts] = await Promise.all([
    prisma.campaignContact.count({ where }),
    prisma.campaignContact.groupBy({ by: ["lead_status"], where: { campaign_id: campaignId }, _count: true }),
    prisma.campaignContact.findMany({
      where,
      orderBy: [{ updated_at: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  res.status(200).json({
    contacts: contacts.map(serializeCampaignContact),
    statusCounts: Object.fromEntries(statusCounts.map((row) => [row.lead_status, row._count])),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}, { methods: ["GET"] });
