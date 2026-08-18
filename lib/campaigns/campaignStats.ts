import { prisma } from "@/lib/prisma";

/**
 * Increment a campaign's engagement counter for today. Shared by the open- and click-tracking
 * endpoints so the day bucketing + upsert shape live in one place (callers decide when a bump is a
 * unique first open/click). Best-effort at the call site — tracking must never break the response.
 */
export async function bumpCampaignStat(campaignId: string, field: "opens" | "clicks"): Promise<void> {
  const day = new Date(new Date().setHours(0, 0, 0, 0));
  await prisma.campaignDailyStat.upsert({
    where: { campaign_id_date: { campaign_id: campaignId, date: day } },
    create: { campaign_id: campaignId, date: day, ...(field === "opens" ? { opens: 1 } : { clicks: 1 }) },
    update: field === "opens" ? { opens: { increment: 1 } } : { clicks: { increment: 1 } },
  });
}
