import { prisma } from "@/lib/prisma";

type AudienceFilter = {
  tagIds?: string[];
};

/**
 * Enrolls newly-matching contacts into a campaign. Campaigns are company-shared but
 * `contacts` is owned per-user, so this walks company_memberships to find every
 * teammate's contacts rather than just the caller's own — this is the one place
 * campaigns read across reps. Never removes a previously-enrolled row; re-running
 * only adds new matches (idempotent via the campaign_id/contact_id unique constraint).
 */
export async function syncCampaignAudience(campaignId: string): Promise<{ enrolledCount: number }> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true, company_id: true, audience_filter: true },
  });
  if (!campaign) throw new Error("Campaign not found");

  const firstStep = await prisma.campaignStep.findFirst({
    where: { campaign_id: campaignId },
    orderBy: { step_order: "asc" },
    select: { delay_days: true },
  });

  const members = await prisma.companyMembership.findMany({
    where: { company_id: campaign.company_id },
    select: { user_id: true },
  });
  const memberUserIds = members.map((m) => m.user_id);
  if (memberUserIds.length === 0) return { enrolledCount: 0 };

  const filter = (campaign.audience_filter as AudienceFilter | null) ?? {};
  const tagIds = Array.isArray(filter.tagIds) ? filter.tagIds.filter((v): v is string => typeof v === "string") : [];

  const where: any = { user_id: { in: memberUserIds } };
  if (tagIds.length > 0) {
    where.contact_tag_assignments = { some: { tag_id: { in: tagIds } } };
  }

  const matches = await prisma.contact.findMany({
    where,
    select: { id: true, email: true, first_name: true, last_name: true, business: true },
  });
  if (matches.length === 0) {
    await prisma.campaign.update({ where: { id: campaignId }, data: { audience_synced_at: new Date() } });
    return { enrolledCount: 0 };
  }

  const enrolledAt = new Date();
  const nextSendAt = firstStep ? new Date(enrolledAt.getTime() + firstStep.delay_days * 24 * 60 * 60 * 1000) : null;

  const result = await prisma.campaignContact.createMany({
    data: matches.map((contact) => ({
      campaign_id: campaignId,
      contact_id: contact.id,
      contact_email: contact.email,
      contact_first_name: contact.first_name,
      contact_last_name: contact.last_name,
      contact_business: contact.business,
      enrolled_at: enrolledAt,
      next_send_at: nextSendAt,
    })),
    skipDuplicates: true,
  });

  await prisma.campaign.update({ where: { id: campaignId }, data: { audience_synced_at: new Date() } });
  return { enrolledCount: result.count };
}
