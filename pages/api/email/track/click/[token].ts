import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { asToken, hashIp, isLikelySelfPreview, trackingClientIp } from "@/lib/api/emailTracking";

function normalizeTarget(url: string) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = asToken(req.query.token).trim();
  if (!token) {
    res.status(400).send("Missing token");
    return;
  }

  const link = await prisma.emailTrackingLink.findUnique({
    where: { token },
    select: {
      id: true,
      original_url: true,
      email_outbound_messages: { select: { id: true, tracking_enabled: true } },
    },
  });

  if (!link?.email_outbound_messages?.id) {
    res.status(404).send("Tracking link not found");
    return;
  }

  if (link.email_outbound_messages.tracking_enabled && !isLikelySelfPreview(req)) {
    await prisma.emailTrackingEvent.create({
      data: {
        outbound_message_id: link.email_outbound_messages.id,
        tracking_link_id: link.id,
        event_type: "CLICK",
        recipient_email: typeof req.query.email === "string" ? req.query.email : null,
        ip_hash: hashIp(trackingClientIp(req)),
        user_agent: String(req.headers["user-agent"] || "").slice(0, 512) || null,
      },
    });
  }

  res.redirect(302, normalizeTarget(link.original_url));
}
