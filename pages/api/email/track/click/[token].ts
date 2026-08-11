import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { asToken, hashIp, isLikelySelfPreview, isPrefetchOpen, trackingClientIp } from "@/lib/api/emailTracking";

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
      email_outbound_messages: { select: { id: true, tracking_enabled: true, created_at: true, campaign_id: true } },
    },
  });

  if (!link?.email_outbound_messages?.id) {
    res.status(404).send("Tracking link not found");
    return;
  }

  if (link.email_outbound_messages.tracking_enabled && !isLikelySelfPreview(req)) {
    // Best-effort: recording the click must never break the user's redirect.
    try {
      const userAgent = String(req.headers["user-agent"] || "").slice(0, 512) || null;
      // Security gateways / link-preview bots follow tracked URLs on delivery. Record those as
      // CLICK_PREFETCH so they never fabricate a high-intent signal (processSignals) or inflate
      // click stats — mirroring the open-pixel prefetch guard (stats count only "CLICK").
      const msSinceSend = Date.now() - link.email_outbound_messages.created_at.getTime();
      const eventType = isPrefetchOpen(userAgent, msSinceSend) ? "CLICK_PREFETCH" : "CLICK";
      const campaignId = link.email_outbound_messages.campaign_id;
      // Detect the first real click of this message BEFORE inserting the current event, so a
      // campaign's click stat counts unique messages clicked (not every link/reload).
      const priorClick =
        eventType === "CLICK" && campaignId
          ? await prisma.emailTrackingEvent.findFirst({
              where: { outbound_message_id: link.email_outbound_messages.id, event_type: "CLICK" },
              select: { id: true },
            })
          : null;
      await prisma.emailTrackingEvent.create({
        data: {
          outbound_message_id: link.email_outbound_messages.id,
          tracking_link_id: link.id,
          event_type: eventType,
          recipient_email: typeof req.query.email === "string" ? req.query.email : null,
          ip_hash: hashIp(trackingClientIp(req)),
          user_agent: userAgent,
        },
      });
      // Roll the first unique click of a campaign message up into its daily stats.
      if (eventType === "CLICK" && campaignId && !priorClick) {
        const day = new Date(new Date().setHours(0, 0, 0, 0));
        await prisma.campaignDailyStat.upsert({
          where: { campaign_id_date: { campaign_id: campaignId, date: day } },
          create: { campaign_id: campaignId, date: day, clicks: 1 },
          update: { clicks: { increment: 1 } },
        });
      }
    } catch {
      /* swallow — still redirect below */
    }
  }

  res.redirect(302, normalizeTarget(link.original_url));
}
