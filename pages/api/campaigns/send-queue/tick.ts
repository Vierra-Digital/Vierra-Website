import { withAuth } from "@/lib/api/withAuth";
import { runCampaignSendQueueTick } from "@/lib/campaigns/sendQueueTick";
import { resolveTargetCompanyId } from "@/lib/api/targetCompany";

/**
 * Manual stand-in for the send-queue cron job — an admin triggers a batch of
 * due sends. Real, live email goes out from here, so this is admin-only.
 */
export default withAuth(
  async (req, res, session) => {
    const companyId = resolveTargetCompanyId(session, req);
    if (!companyId) {
      res.status(400).json({ message: "companyId is required" });
      return;
    }
    const result = await runCampaignSendQueueTick(companyId);
    res.status(200).json(result);
  },
  { methods: ["POST"], roles: ["admin"] }
);
