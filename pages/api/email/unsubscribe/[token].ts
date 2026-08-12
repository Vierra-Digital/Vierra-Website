import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { asToken } from "@/lib/api/emailTracking";
import { addToDnc } from "@/lib/campaigns/dnc";
import { REMOVE_CONTACT_STATUS } from "@/lib/api/campaigns";

/**
 * One-click unsubscribe landing page — linked from every campaign email's CAN-SPAM footer and
 * List-Unsubscribe header (see lib/campaigns/sendQueueTick.ts). GET serves a human clicking the
 * link a confirmation page; POST handles RFC 8058 one-click requests (List-Unsubscribe-Post) that
 * some mail clients send automatically with no user interaction. Both have the same DNC effect.
 */
async function unsubscribe(token: string): Promise<boolean> {
  const contact = await prisma.campaignContact.findUnique({
    where: { unsubscribe_token: token },
    select: { id: true, campaign_id: true, contact_email: true, lead_status: true },
  });
  if (!contact) return false;

  await addToDnc(contact.campaign_id, contact.contact_email, "categorization");
  await prisma.campaignContact.update({
    where: { id: contact.id },
    data: { lead_status: REMOVE_CONTACT_STATUS, queue_status: "skipped", skip_reason: "unsubscribed" },
  });
  await prisma.leadStatusEvent.create({
    data: {
      campaign_contact_id: contact.id,
      from_status: contact.lead_status,
      to_status: REMOVE_CONTACT_STATUS,
      changed_by_rule: "recipient_unsubscribe",
    },
  });
  return true;
}

const CONFIRM_PAGE = `<!doctype html><html><body style="font-family:Arial,sans-serif;text-align:center;padding:48px;color:#111827;"><h1>You're unsubscribed</h1><p>You won't receive any more emails from this campaign.</p></body></html>`;
const NOT_FOUND_PAGE = `<!doctype html><html><body style="font-family:Arial,sans-serif;text-align:center;padding:48px;color:#111827;"><h1>Link not recognized</h1><p>This unsubscribe link is invalid or has expired.</p></body></html>`;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = asToken(req.query.token).trim();
  if (!token) {
    res.status(400).send("Missing token");
    return;
  }

  if (req.method === "POST") {
    // RFC 8058 one-click: a mail client's automatic request expects a bare 200, no confirmation UI.
    await unsubscribe(token).catch(() => {});
    res.status(200).end();
    return;
  }

  const ok = await unsubscribe(token).catch(() => false);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(ok ? CONFIRM_PAGE : NOT_FOUND_PAGE);
}
