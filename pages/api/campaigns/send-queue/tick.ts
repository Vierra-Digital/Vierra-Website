import { withAuth } from "@/lib/api/withAuth";
import { runCampaignSendQueueTick } from "@/lib/campaigns/sendQueueTick";

/**
 * Manual stand-in for the send-queue cron job — an admin triggers a batch of
 * due sends. Real, live email goes out from here, so this is admin-only.
 */
export default withAuth(
  async (req, res, session) => {
    const result = await runCampaignSendQueueTick(session.companyId);
    res.status(200).json(result);
  },
  { methods: ["POST"], roles: ["admin"] }
);
