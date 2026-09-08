import type { NextApiRequest } from "next";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { syncCampaignAudience } from "@/lib/campaigns/audienceSync";
import { isUuid } from "@/lib/api/parsing";

function getCampaignId(req: NextApiRequest) {
  const raw = req.query.id;
  return Array.isArray(raw) ? raw[0] : raw || "";
}

export default withAuth(async (req, res) => {
  const campaignId = getCampaignId(req);
  if (!campaignId) {
    res.status(400).json({ message: "Campaign id is required." });
    return;
  }

  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId },
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

  // contact_tags.id is a @db.Uuid column — a malformed entry would otherwise make the
  // `{ tag_id: { in: tagIds } }` lookup in syncCampaignAudience throw (P2007) instead of just not
  // matching, and it would sit in audience_filter as garbage even though it can never match a tag.
  const tagIds = Array.isArray(req.body?.tagIds)
    ? req.body.tagIds.filter((v: unknown): v is string => typeof v === "string" && isUuid(v))
    : [];

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { audience_filter: { tagIds } },
  });

  const { enrolledCount } = await syncCampaignAudience(campaignId);
  const contactCount = await prisma.campaignContact.count({ where: { campaign_id: campaignId } });

  res.status(200).json({ enrolledCount, contactCount });
}, { methods: ["PUT", "POST"] });
