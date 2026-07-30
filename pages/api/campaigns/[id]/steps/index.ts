import type { NextApiRequest } from "next";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { asStr } from "@/lib/api/parsing";
import { serializeCampaignStep } from "@/lib/api/campaigns";

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

  if (req.method === "GET") {
    const steps = await prisma.campaignStep.findMany({
      where: { campaign_id: campaignId },
      orderBy: { step_order: "asc" },
    });
    res.status(200).json({ steps: steps.map(serializeCampaignStep) });
    return;
  }

  if (req.method === "POST") {
    if (campaign.status !== "draft") {
      res.status(400).json({ message: "Sequence steps can only be edited while the campaign is a draft." });
      return;
    }

    const templateId = asStr(req.body?.templateId) || null;
    const subjectOverride = asStr(req.body?.subjectOverride) || null;
    const bodyHtmlOverride = asStr(req.body?.bodyHtmlOverride) || null;
    if (!templateId && !subjectOverride && !bodyHtmlOverride) {
      res.status(400).json({ message: "Provide a templateId or a subject/body override for this step." });
      return;
    }

    const delayDaysRaw = Number(req.body?.delayDays);
    const delayDays = Number.isFinite(delayDaysRaw) && delayDaysRaw >= 0 ? Math.floor(delayDaysRaw) : 0;

    const last = await prisma.campaignStep.findFirst({
      where: { campaign_id: campaignId },
      orderBy: { step_order: "desc" },
      select: { step_order: true },
    });

    const created = await prisma.campaignStep.create({
      data: {
        campaign_id: campaignId,
        step_order: (last?.step_order ?? 0) + 1,
        name: asStr(req.body?.name) || null,
        template_id: templateId,
        subject_override: subjectOverride,
        body_html_override: bodyHtmlOverride,
        body_text_override: asStr(req.body?.bodyTextOverride) || null,
        delay_days: delayDays,
      },
    });
    res.status(201).json({ step: serializeCampaignStep(created) });
    return;
  }
}, { methods: ["GET", "POST"] });
