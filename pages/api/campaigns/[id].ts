import type { NextApiRequest } from "next";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { asStr } from "@/lib/api/parsing";
import { serializeCampaign } from "@/lib/api/campaigns";

function getId(req: NextApiRequest) {
  const raw = req.query.id;
  return Array.isArray(raw) ? raw[0] : raw || "";
}

/** Which statuses a campaign may move to from its current status. Terminal states have no outgoing edges. */
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  draft: ["active", "cancelled"],
  active: ["paused", "completed", "cancelled"],
  paused: ["active", "cancelled"],
  completed: [],
  cancelled: [],
};

export default withAuth(async (req, res, session) => {
  const id = getId(req);
  if (!id) {
    res.status(400).json({ message: "Campaign id is required." });
    return;
  }

  const existing = await prisma.campaign.findFirst({
    where: { id, company_id: session.companyId },
    include: {
      email_provider_accounts: { select: { account_email: true } },
      _count: { select: { campaign_steps: true, campaign_contacts: true } },
    },
  });
  if (!existing) {
    res.status(404).json({ message: "Campaign not found." });
    return;
  }

  if (req.method === "GET") {
    res.status(200).json({ campaign: serializeCampaign(existing) });
    return;
  }

  if (req.method === "PATCH") {
    const nextStatus = asStr(req.body?.status);

    if (nextStatus) {
      const allowed = ALLOWED_TRANSITIONS[existing.status] ?? [];
      if (!allowed.includes(nextStatus)) {
        res.status(400).json({ message: `Cannot move campaign from '${existing.status}' to '${nextStatus}'.` });
        return;
      }
      if (nextStatus === "active" && existing.status === "draft") {
        const stepCount = await prisma.campaignStep.count({ where: { campaign_id: id } });
        if (stepCount === 0) {
          res.status(400).json({ message: "Add at least one sequence step before launching." });
          return;
        }
      }

      const data: any = { status: nextStatus };
      if (nextStatus === "active" && existing.status === "draft") data.started_at = new Date();
      if (nextStatus === "active" && existing.status === "paused") data.paused_at = null;
      if (nextStatus === "paused") data.paused_at = new Date();
      if (nextStatus === "completed" || nextStatus === "cancelled") data.completed_at = new Date();

      const updated = await prisma.campaign.update({
        where: { id },
        data,
        include: {
          email_provider_accounts: { select: { account_email: true } },
          _count: { select: { campaign_steps: true, campaign_contacts: true } },
        },
      });
      res.status(200).json({ campaign: serializeCampaign(updated) });
      return;
    }

    if (existing.status !== "draft") {
      res.status(400).json({ message: "Send settings can only be edited while the campaign is a draft." });
      return;
    }

    const sendDelaySeconds = Number(req.body?.sendDelaySeconds);
    const sendJitterSeconds = Number(req.body?.sendJitterSeconds);
    const dailySendLimit = Number(req.body?.dailySendLimit);
    const scheduledStartAtRaw = req.body?.scheduledStartAt;

    const updated = await prisma.campaign.update({
      where: { id },
      data: {
        name: req.body?.name !== undefined ? asStr(req.body?.name) || existing.name : existing.name,
        send_delay_seconds:
          req.body?.sendDelaySeconds !== undefined && Number.isFinite(sendDelaySeconds) && sendDelaySeconds >= 30
            ? Math.floor(sendDelaySeconds)
            : existing.send_delay_seconds,
        send_jitter_seconds:
          req.body?.sendJitterSeconds !== undefined && Number.isFinite(sendJitterSeconds) && sendJitterSeconds >= 0
            ? Math.floor(sendJitterSeconds)
            : existing.send_jitter_seconds,
        daily_send_limit:
          req.body?.dailySendLimit !== undefined && Number.isFinite(dailySendLimit) && dailySendLimit > 0
            ? Math.floor(dailySendLimit)
            : existing.daily_send_limit,
        scheduled_start_at:
          req.body?.scheduledStartAt !== undefined
            ? (asStr(scheduledStartAtRaw) ? new Date(asStr(scheduledStartAtRaw)) : null)
            : existing.scheduled_start_at,
      },
      include: {
        email_provider_accounts: { select: { account_email: true } },
        _count: { select: { campaign_steps: true, campaign_contacts: true } },
      },
    });
    res.status(200).json({ campaign: serializeCampaign(updated) });
    return;
  }

  if (req.method === "DELETE") {
    if (existing.status !== "draft") {
      res.status(400).json({ message: "Only draft campaigns can be deleted." });
      return;
    }
    await prisma.campaign.delete({ where: { id } });
    res.status(200).json({ ok: true });
    return;
  }
}, { methods: ["GET", "PATCH", "DELETE"] });
