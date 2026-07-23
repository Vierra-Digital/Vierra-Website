import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { asToken, hashIp, isLikelySelfPreview, isPrefetchOpen, trackingClientIp } from "@/lib/api/emailTracking";

function normalizeOpenToken(value: string) {
  return value.trim().replace(/\.gif$/i, "");
}

const ONE_PIXEL_GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==", "base64");
const DUPLICATE_OPEN_WINDOW_MS = 2_000;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = normalizeOpenToken(asToken(req.query.token));
  // Tracking is best-effort: a DB error must never fail the 1×1 pixel, so the whole
  // lookup/record path is wrapped and always falls through to the gif below.
  try {
   if (token) {
    const outbound = await prisma.emailOutboundMessage.findFirst({
      where: { open_token: token, tracking_enabled: true },
      select: { id: true, created_at: true },
    });
    if (outbound) {
      const userAgent = String(req.headers["user-agent"] || "").slice(0, 512) || null;
      const shouldIgnoreOpen = isLikelySelfPreview(req);
      if (shouldIgnoreOpen) {
        res.setHeader("Content-Type", "image/gif");
        res.setHeader("Cache-Control", "no-store, max-age=0");
        res.status(200).send(ONE_PIXEL_GIF);
        return;
      }

      // Machine pre-fetches (Apple MPP, scanners, sub-10s auto-loads) are logged as
      // OPEN_PREFETCH so they never inflate real open counts (stats count only "OPEN").
      const msSinceSend = Date.now() - outbound.created_at.getTime();
      const eventType = isPrefetchOpen(userAgent, msSinceSend) ? "OPEN_PREFETCH" : "OPEN";
      const ipHash = hashIp(trackingClientIp(req));
      const recentDuplicate = await prisma.emailTrackingEvent.findFirst({
        where: {
          outbound_message_id: outbound.id,
          event_type: eventType,
          ip_hash: ipHash,
          user_agent: userAgent,
          occurred_at: {
            gte: new Date(Date.now() - DUPLICATE_OPEN_WINDOW_MS),
          },
        },
        select: { id: true },
      });
      if (!recentDuplicate) {
        await prisma.emailTrackingEvent.create({
          data: {
            outbound_message_id: outbound.id,
            event_type: eventType,
            recipient_email: typeof req.query.email === "string" ? req.query.email : null,
            ip_hash: ipHash,
            user_agent: userAgent,
          },
        });
      }
    }
   }
  } catch {
    /* swallow — always return the pixel */
  }

  res.setHeader("Content-Type", "image/gif");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.status(200).send(ONE_PIXEL_GIF);
}
