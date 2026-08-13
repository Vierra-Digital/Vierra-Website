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
import { addToDnc } from "@/lib/campaigns/dnc";
import { notifyDiscord, discordConfigured } from "@/lib/notify/discord";

function getIds(req: NextApiRequest) {
  const campaignRaw = req.query.id;
  const contactRaw = req.query.contactId;
  return {
    campaignId: Array.isArray(campaignRaw) ? campaignRaw[0] : campaignRaw || "",
    contactId: Array.isArray(contactRaw) ? contactRaw[0] : contactRaw || "",
  };
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
      // Only allow assigning to a member of this company (null unassigns) — otherwise a lead
      // could be assigned to an arbitrary/outside user id.
      if (nextAssignee) {
        const member = await prisma.companyMembership.findFirst({
          where: { company_id: session.companyId, user_id: nextAssignee },
          select: { id: true },
        });
        if (!member) {
          res.status(400).json({ message: "Assignee must be a member of your company." });
          return;
        }
      }
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

    // Guard on the transition, not just the new value — a no-op PATCH (re-saving the same status,
    // e.g. a stale form re-submit) must not re-notify. See
    // .claude/schema_v2_campaigns_discord_notifications.md §4.
    if (leadStatus === "meeting_booked" && existing.lead_status !== "meeting_booked" && discordConfigured()) {
      const campaignRow = await prisma.campaign.findUnique({ where: { id: campaignId }, select: { name: true } });
      const base = (process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || "").replace(/\/$/, "");
      const contactName = [existing.contact_first_name, existing.contact_last_name].filter(Boolean).join(" ");
      await notifyDiscord(
        `📅 **Meeting booked** — ${contactName || existing.contact_email} (${existing.contact_email})\n` +
          `**Campaign:** ${campaignRow?.name ?? "(unknown)"}` +
          (base ? `\n${base}/panel/email?campaign=${campaignId}&contact=${contactId}` : "")
      );
    }

    res.status(200).json({ contact: serializeCampaignContact(updated) });
    return;
  }
}, { methods: ["GET", "PATCH"] });
