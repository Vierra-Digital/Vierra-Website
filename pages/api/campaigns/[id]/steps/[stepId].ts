import type { NextApiRequest } from "next";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { asStr } from "@/lib/api/parsing";
import { serializeCampaignStep } from "@/lib/api/campaigns";

function getIds(req: NextApiRequest) {
  const campaignRaw = req.query.id;
  const stepRaw = req.query.stepId;
  return {
    campaignId: Array.isArray(campaignRaw) ? campaignRaw[0] : campaignRaw || "",
    stepId: Array.isArray(stepRaw) ? stepRaw[0] : stepRaw || "",
  };
}

export default withAuth(async (req, res, session) => {
  const { campaignId, stepId } = getIds(req);
  if (!campaignId || !stepId) {
    res.status(400).json({ message: "Campaign id and step id are required." });
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

  const existing = await prisma.campaignStep.findFirst({ where: { id: stepId, campaign_id: campaignId } });
  if (!existing) {
    res.status(404).json({ message: "Step not found." });
    return;
  }

  if (campaign.status !== "draft") {
    res.status(400).json({ message: "Sequence steps can only be edited while the campaign is a draft." });
    return;
  }

  if (req.method === "PATCH") {
    const delayDaysRaw = Number(req.body?.delayDays);
    const updated = await prisma.campaignStep.update({
      where: { id: stepId },
      data: {
        name: req.body?.name !== undefined ? asStr(req.body?.name) || null : existing.name,
        template_id: req.body?.templateId !== undefined ? asStr(req.body?.templateId) || null : existing.template_id,
        subject_override: req.body?.subjectOverride !== undefined ? asStr(req.body?.subjectOverride) || null : existing.subject_override,
        body_html_override: req.body?.bodyHtmlOverride !== undefined ? asStr(req.body?.bodyHtmlOverride) || null : existing.body_html_override,
        body_text_override: req.body?.bodyTextOverride !== undefined ? asStr(req.body?.bodyTextOverride) || null : existing.body_text_override,
        delay_days:
          req.body?.delayDays !== undefined && Number.isFinite(delayDaysRaw) && delayDaysRaw >= 0
            ? Math.floor(delayDaysRaw)
            : existing.delay_days,
      },
    });
    res.status(200).json({ step: serializeCampaignStep(updated) });
    return;
  }

  if (req.method === "DELETE") {
    await prisma.campaignStep.delete({ where: { id: stepId } });
    res.status(200).json({ ok: true });
    return;
  }
}, { methods: ["PATCH", "DELETE"] });
