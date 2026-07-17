import type { NextApiRequest } from "next";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { asStr } from "@/lib/api/parsing";
import {
  serializeCampaignContact,
  serializeLeadStatusEvent,
  LEAD_STATUSES,
  REMOVE_CONTACT_STATUS,
} from "@/lib/api/campaigns";

function getIds(req: NextApiRequest) {
  const campaignRaw = req.query.id;
  const contactRaw = req.query.contactId;
  return {
    campaignId: Array.isArray(campaignRaw) ? campaignRaw[0] : campaignRaw || "",
    contactId: Array.isArray(contactRaw) ? contactRaw[0] : contactRaw || "",
  };
}

/** Adds the contact's email to the sending mailbox owner's DNC list (soft-deleted, 30-day hard-delete window). */
async function addToDnc(campaignId: string, contactEmail: string) {
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
    update: { is_dnc: true, soft_deleted_at: now, scheduled_hard_delete_at: scheduledHardDeleteAt, reason: "categorization" },
    create: {
      user_id: campaign.email_provider_accounts.user_id,
      account_id: campaign.email_provider_accounts.id,
      email: contactEmail,
      is_dnc: true,
      reason: "categorization",
      soft_deleted_at: now,
      scheduled_hard_delete_at: scheduledHardDeleteAt,
    },
  });
}

export default withAuth(async (req, res, session) => {
  const { campaignId, contactId } = getIds(req);
  if (!campaignId || !contactId) {
    res.status(400).json({ message: "Campaign id and contact id are required." });
    return;
  }

  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, company_id: session.companyId },
    select: { id: true },
  });
  if (!campaign) {
    res.status(404).json({ message: "Campaign not found." });
    return;
  }

  const existing = await prisma.campaignContact.findFirst({ where: { id: contactId, campaign_id: campaignId } });
  if (!existing) {
    res.status(404).json({ message: "Campaign contact not found." });
    return;
  }

  if (req.method === "GET") {
    const [leadStatusEvents, assignmentEvents] = await Promise.all([
      prisma.leadStatusEvent.findMany({
        where: { campaign_contact_id: contactId },
        include: { users: { select: { name: true, email: true } } },
        orderBy: { created_at: "desc" },
      }),
      prisma.assignmentEvent.findMany({
        where: { campaign_contact_id: contactId },
        orderBy: { created_at: "desc" },
      }),
    ]);
    res.status(200).json({
      contact: serializeCampaignContact(existing),
      leadStatusEvents: leadStatusEvents.map(serializeLeadStatusEvent),
      assignmentEvents,
    });
    return;
  }

  if (req.method === "PATCH") {
    if (req.body?.claim === true) {
      const claimed = await prisma.campaignContact.updateMany({
        where: { id: contactId, assigned_to: null },
        data: { assigned_to: session.user.id },
      });
      if (claimed.count === 0) {
        res.status(409).json({ message: "This lead has already been claimed." });
        return;
      }
      await prisma.assignmentEvent.create({
        data: {
          campaign_contact_id: contactId,
          from_user_id: null,
          to_user_id: session.user.id,
          changed_by_user_id: session.user.id,
        },
      });
      const updated = await prisma.campaignContact.findUniqueOrThrow({ where: { id: contactId } });
      res.status(200).json({ contact: serializeCampaignContact(updated) });
      return;
    }

    if (req.body?.assignedTo !== undefined) {
      const nextAssignee = asStr(req.body.assignedTo) || null;
      const updated = await prisma.campaignContact.update({
        where: { id: contactId },
        data: { assigned_to: nextAssignee },
      });
      await prisma.assignmentEvent.create({
        data: {
          campaign_contact_id: contactId,
          from_user_id: existing.assigned_to,
          to_user_id: nextAssignee ?? session.user.id,
          changed_by_user_id: session.user.id,
        },
      });
      res.status(200).json({ contact: serializeCampaignContact(updated) });
      return;
    }

    const leadStatus = asStr(req.body?.leadStatus);
    if (!leadStatus || !(LEAD_STATUSES as readonly string[]).includes(leadStatus)) {
      res.status(400).json({ message: `leadStatus must be one of: ${LEAD_STATUSES.join(", ")}` });
      return;
    }

    const updated = await prisma.campaignContact.update({
      where: { id: contactId },
      data: { lead_status: leadStatus },
    });
    await prisma.leadStatusEvent.create({
      data: {
        campaign_contact_id: contactId,
        from_status: existing.lead_status,
        to_status: leadStatus,
        changed_by_user_id: session.user.id,
        note: asStr(req.body?.note) || null,
      },
    });

    if (leadStatus === REMOVE_CONTACT_STATUS) {
      await addToDnc(campaignId, existing.contact_email);
      await prisma.campaignContact.update({ where: { id: contactId }, data: { queue_status: "skipped", skip_reason: "removed_by_categorization" } });
    }

    res.status(200).json({ contact: serializeCampaignContact(updated) });
    return;
  }
}, { methods: ["GET", "PATCH"] });
