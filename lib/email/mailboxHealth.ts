import { prisma } from "@/lib/prisma";

/** Free consumer domains are never verifiable in Postmaster Tools — skip rather than show an error. */
const CONSUMER_DOMAINS = new Set(["gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "yahoo.com", "icloud.com", "aol.com"]);
export function isConsumerDomain(domain: string): boolean {
  return CONSUMER_DOMAINS.has(domain.trim().toLowerCase());
}

export type BounceStats = { sent: number; bounces: number; rate: number | null };

/** Bounce-rate rollup across every campaign a mailbox has sent through — no per-account table; summed from CampaignDailyStat via Campaign.account_id. */
export async function computeBounceStats(accountId: string): Promise<BounceStats> {
  const agg = await prisma.campaignDailyStat.aggregate({
    where: { campaigns: { account_id: accountId } },
    _sum: { emails_sent: true, bounces: true },
  });
  const sent = agg._sum.emails_sent ?? 0;
  const bounces = agg._sum.bounces ?? 0;
  return { sent, bounces, rate: sent > 0 ? bounces / sent : null };
}
