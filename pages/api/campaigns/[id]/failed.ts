import type { NextApiRequest } from "next";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";

function getCampaignId(req: NextApiRequest) {
  const raw = req.query.id;
  return Array.isArray(raw) ? raw[0] : raw || "";
}

/** Failed sends for a campaign — surfaces the silent SMTP failures the send queue gives up on. */
export default withAuth(async (req, res, session) => {
  const campaignId = getCampaignId(req);
  if (!campaignId) {
    res.status(400).json({ message: "Campaign id is required." });
    return;
  }

  // Company-scope: a campaign id from another company must 404, not leak its failures.
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, company_id: session.companyId },
    select: { id: true },
  });
  if (!campaign) {
    res.status(404).json({ message: "Campaign not found." });
    return;
  }

  const rows = await prisma.campaignStepSend.findMany({
    where: { status: "failed", campaign_contacts: { campaign_id: campaignId } },
    orderBy: { failed_at: "desc" },
    take: 100,
    select: {
      id: true,
      fail_reason: true,
      failed_at: true,
      retry_count: true,
      campaign_contacts: { select: { contact_email: true, queue_status: true } },
    },
  });

  res.status(200).json({
    failed: rows.map((r) => ({
      id: r.id,
      email: r.campaign_contacts?.contact_email ?? "",
      reason: r.fail_reason ?? "",
      failedAt: r.failed_at,
      attempts: r.retry_count,
      // queue_status "failed" means the queue exhausted retries and gave up on this contact.
      gaveUp: r.campaign_contacts?.queue_status === "failed",
    })),
  });
}, { methods: ["GET"] });
