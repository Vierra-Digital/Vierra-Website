import type { NextApiRequest } from "next";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { syncCampaignAudience } from "@/lib/campaigns/audienceSync";

function getCampaignId(req: NextApiRequest) {
  const raw = req.query.id;
  return Array.isArray(raw) ? raw[0] : raw || "";
}

/**
 * Manual re-sync trigger (stand-in for the "audience sync" background job — there's
 * no cron infra yet, so a teammate clicks "Sync Audience" to pull in newly-tagged
 * contacts against the campaign's already-saved audience_filter).
 */
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
  if (campaign.status === "completed" || campaign.status === "cancelled") {
    res.status(400).json({ message: "This campaign is no longer active." });
    return;
  }

  const { enrolledCount } = await syncCampaignAudience(campaignId);
  const contactCount = await prisma.campaignContact.count({ where: { campaign_id: campaignId } });
  res.status(200).json({ enrolledCount, contactCount });
}, { methods: ["POST"] });
