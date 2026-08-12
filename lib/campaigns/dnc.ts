import { prisma } from "@/lib/prisma";

/**
 * Adds a contact's email to the sending mailbox owner's DNC list (soft-deleted, 30-day
 * hard-delete window). Shared by the manual "remove_contact" categorization path
 * (pages/api/campaigns/[id]/contacts/[contactId].ts), the Smartlead webhook's hard-bounce/
 * unsubscribe handling (pages/api/campaigns/webhooks/smartlead.ts), and the Brevo webhook's
 * bounce/spam/unsubscribe handling (pages/api/campaigns/webhooks/brevo.ts).
 */
export async function addToDnc(
  campaignId: string,
  contactEmail: string,
  reason: "categorization" | "bounce" | "spam_complaint" = "categorization"
) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { email_provider_accounts: { select: { user_id: true, id: true } } },
  });
  if (!campaign) return;
  const now = new Date();
  const scheduledHardDeleteAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  await prisma.emailBlockedSender.upsert({
    where: {
      user_id_account_id_email: {
        user_id: campaign.email_provider_accounts.user_id,
        account_id: campaign.email_provider_accounts.id,
        email: contactEmail,
      },
    },
    update: { is_dnc: true, soft_deleted_at: now, scheduled_hard_delete_at: scheduledHardDeleteAt, reason },
    create: {
      user_id: campaign.email_provider_accounts.user_id,
      account_id: campaign.email_provider_accounts.id,
      email: contactEmail,
      is_dnc: true,
      reason,
      soft_deleted_at: now,
      scheduled_hard_delete_at: scheduledHardDeleteAt,
    },
  });
}
