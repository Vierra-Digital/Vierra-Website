import type { NextApiRequest } from "next";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { syncCampaignAudience } from "@/lib/campaigns/audienceSync";

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
    select: { id: true, status: true },
  });
  if (!campaign) {
    res.status(404).json({ message: "Campaign not found." });
    return;
  }
  if (campaign.status !== "draft") {
    res.status(400).json({ message: "Audience targeting can only be edited while the campaign is a draft." });
    return;
  }

  const tagIds = Array.isArray(req.body?.tagIds)
    ? req.body.tagIds.filter((v: unknown): v is string => typeof v === "string")
    : [];

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { audience_filter: { tagIds } },
  });

  const { enrolledCount } = await syncCampaignAudience(campaignId);
  const contactCount = await prisma.campaignContact.count({ where: { campaign_id: campaignId } });

  res.status(200).json({ enrolledCount, contactCount });
}, { methods: ["PUT", "POST"] });
