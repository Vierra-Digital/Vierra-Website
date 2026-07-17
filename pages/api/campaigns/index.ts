import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { asStr, asQueryStr } from "@/lib/api/parsing";
import { serializeCampaign, CAMPAIGN_STATUSES } from "@/lib/api/campaigns";

export default withAuth(async (req, res, session) => {
  if (req.method === "GET") {
    const status = asQueryStr(req.query.status);
    const where: any = { company_id: session.companyId };
    if (status && (CAMPAIGN_STATUSES as readonly string[]).includes(status)) where.status = status;

    const campaigns = await prisma.campaign.findMany({
      where,
      include: {
        email_provider_accounts: { select: { account_email: true } },
        _count: { select: { campaign_steps: true, campaign_contacts: true } },
      },
      orderBy: { created_at: "desc" },
    });
    res.status(200).json({ campaigns: campaigns.map(serializeCampaign) });
    return;
  }

  if (req.method === "POST") {
    const name = asStr(req.body?.name);
    const accountId = asStr(req.body?.accountId);
    if (!name || !accountId) {
      res.status(400).json({ message: "name and accountId are required." });
      return;
    }

    const account = await prisma.emailProviderAccount.findFirst({
      where: { id: accountId, user_id: session.user.id, company_id: session.companyId },
      select: { id: true },
    });
    if (!account) {
      res.status(400).json({ message: "accountId must reference one of your connected mailboxes." });
      return;
    }

    const sendDelaySeconds = Number(req.body?.sendDelaySeconds);
    const sendJitterSeconds = Number(req.body?.sendJitterSeconds);
    const dailySendLimit = Number(req.body?.dailySendLimit);
    const scheduledStartAtRaw = asStr(req.body?.scheduledStartAt);

    const created = await prisma.campaign.create({
      data: {
        company_id: session.companyId,
        account_id: accountId,
        created_by: session.user.id,
        name,
        status: "draft",
        send_delay_seconds: Number.isFinite(sendDelaySeconds) && sendDelaySeconds >= 30 ? Math.floor(sendDelaySeconds) : 60,
        send_jitter_seconds: Number.isFinite(sendJitterSeconds) && sendJitterSeconds >= 0 ? Math.floor(sendJitterSeconds) : 30,
        daily_send_limit: Number.isFinite(dailySendLimit) && dailySendLimit > 0 ? Math.floor(dailySendLimit) : 50,
        scheduled_start_at: scheduledStartAtRaw ? new Date(scheduledStartAtRaw) : null,
      },
      include: {
        email_provider_accounts: { select: { account_email: true } },
        _count: { select: { campaign_steps: true, campaign_contacts: true } },
      },
    });
    res.status(201).json({ campaign: serializeCampaign(created) });
    return;
  }
}, { methods: ["GET", "POST"] });
