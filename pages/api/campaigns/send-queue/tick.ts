import { withAuth } from "@/lib/api/withAuth";
import { runCampaignSendQueueTick } from "@/lib/campaigns/sendQueueTick";
import { resolveTargetCompanyId } from "@/lib/api/targetCompany";

/**
 * Manual stand-in for the send-queue cron job — a Vierra staff member triggers a batch of due
 * sends. Real, live email goes out from here; any company member (admin or staff) can launch and
 * run a campaign the same way they can already PATCH its status to "active" (pages/api/campaigns/
 * [id].ts has no role restriction of its own) — restricting this one step of the same flow to
 * admins only just blocked staff partway through, and the automatic cron dispatcher runs it
 * unrestricted anyway (pages/api/campaigns/send-queue/dispatch.ts), so this manual trigger was
 * never the actual safety boundary.
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
  { methods: ["POST"], roles: ["admin", "staff"] }
);
