import { prisma } from "@/lib/prisma";

/** Daily counters on CampaignDailyStat that callers can increment. */
export type CampaignStatField = "opens" | "clicks" | "replies" | "bounces" | "unsubscribes";

/**
 * Increment a campaign's engagement counter for today. Shared by the open- and click-tracking
 * endpoints, the inbound bounce handler, and the provider webhooks, so the day bucketing + upsert
 * shape live in one place (callers decide when a bump is a unique first open/click/bounce).
 * Best-effort at the call site — stats must never break the caller's response.
 */
export async function bumpCampaignStat(campaignId: string, field: CampaignStatField): Promise<void> {
  const day = new Date(new Date().setHours(0, 0, 0, 0));
  await prisma.campaignDailyStat.upsert({
    where: { campaign_id_date: { campaign_id: campaignId, date: day } },
    create: { campaign_id: campaignId, date: day, [field]: 1 },
    update: { [field]: { increment: 1 } },
  });
}
