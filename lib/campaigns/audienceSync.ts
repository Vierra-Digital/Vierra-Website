import { prisma } from "@/lib/prisma";
import { addLeadsToCampaign, type SmartleadLead } from "@/lib/campaigns/smartlead/client";
import { mapInBatches } from "@/lib/batch";

type AudienceFilter = {
  tagIds?: string[];
};

/**
 * Pushes every not-yet-pushed contact (smartlead_lead_id IS NULL, still queued) for a
 * smartlead-provider campaign to Smartlead, DNC-filtering first since Smartlead has no
 * visibility into email_blocked_senders. Best-effort/idempotent: safe to call repeatedly —
 * already-pushed contacts are skipped, and a partial failure just leaves the remainder for the
 * next sync to retry. See .claude/schema_v2_campaigns_smartlead_integration.md Flow 2.
 */
async function pushPendingLeadsToSmartlead(campaignId: string): Promise<void> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { smartlead_campaign_id: true, email_provider_accounts: { select: { user_id: true } } },
  });
  if (!campaign?.smartlead_campaign_id) return; // not launched into Smartlead yet (Flow 1 hasn't run)

  const pending = await prisma.campaignContact.findMany({
    where: { campaign_id: campaignId, smartlead_lead_id: null, queue_status: "queued" },
    select: { id: true, contact_email: true, contact_first_name: true, contact_last_name: true, contact_business: true },
  });
  if (pending.length === 0) return;

  const dncEmails = new Set(
    (
      await prisma.emailBlockedSender.findMany({
        where: {
          user_id: campaign.email_provider_accounts.user_id,
          email: { in: pending.map((p) => p.contact_email) },
          soft_deleted_at: null,
        },
        select: { email: true },
      })
    ).map((r) => r.email.toLowerCase())
  );

  const blocked = pending.filter((p) => dncEmails.has(p.contact_email.toLowerCase()));
  if (blocked.length > 0) {
    await prisma.campaignContact.updateMany({
      where: { id: { in: blocked.map((b) => b.id) } },
      data: { queue_status: "skipped", skip_reason: "dnc" },
    });
  }

  const toPush = pending.filter((p) => !dncEmails.has(p.contact_email.toLowerCase()));
  if (toPush.length === 0) return;

  const leads: SmartleadLead[] = toPush.map((p) => ({
    email: p.contact_email,
    first_name: p.contact_first_name || undefined,
    last_name: p.contact_last_name || undefined,
    company_name: p.contact_business || undefined,
  }));

  const result = await addLeadsToCampaign(campaign.smartlead_campaign_id, leads);
  // Process result.data regardless of result.ok — on a partial failure (one batch of 400 fails
  // after an earlier batch succeeded), the succeeded batch's leads still need their
  // smartlead_lead_id recorded here, or the next sync would re-push (and likely duplicate) them.
  // Any contact NOT present in result.data.leads simply stays unpushed and is retried next sync.

  // Correlate Smartlead's returned lead ids back by email (order isn't guaranteed to match).
  const byEmail = new Map((result.data.leads ?? []).map((l) => [l.email.toLowerCase(), String(l.id)]));
  // Each contact gets a distinct smartlead_lead_id, so these can't collapse to one updateMany.
  // They're independent writes though — run them with bounded concurrency instead of serially.
  // Contacts Smartlead didn't echo back are left null (retried next sync).
  const toRecord = toPush.filter((p) => byEmail.has(p.contact_email.toLowerCase()));
  await mapInBatches(toRecord, (p) =>
    prisma.campaignContact.update({
      where: { id: p.id },
      data: { smartlead_lead_id: byEmail.get(p.contact_email.toLowerCase())! },
    })
  );
}

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

  // Repair contacts that enrolled before any step existed: they were inserted with
  // next_send_at=null, which the send queue's due filter (next_send_at <= now) never matches, so
  // they'd stay stranded even after steps are added (createMany above skips existing rows). Now
  // that a first step exists, schedule them — scoped to not-yet-started, still-queued rows so any
  // in-flight sequence is left untouched.
  if (firstStep) {
    await prisma.campaignContact.updateMany({
      where: { campaign_id: campaignId, queue_status: "queued", current_step_id: null, next_send_at: null },
      data: { next_send_at: nextSendAt },
    });
  }

  await prisma.campaign.update({ where: { id: campaignId }, data: { audience_synced_at: new Date() } });

  // No-ops for "internal"-provider campaigns (smartlead_campaign_id is null until Flow 1 launches
  // a smartlead campaign), so safe to always call rather than branching on send_provider here.
  await pushPendingLeadsToSmartlead(campaignId).catch(() => {});

  return { enrolledCount: result.count };
}
