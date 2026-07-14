import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { asToken, hashIp, isLikelySelfPreview, trackingClientIp } from "@/lib/api/emailTracking";

function normalizeOpenToken(value: string) {
  return value.trim().replace(/\.gif$/i, "");
}

const ONE_PIXEL_GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==", "base64");
const DUPLICATE_OPEN_WINDOW_MS = 2_000;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = normalizeOpenToken(asToken(req.query.token));
  if (token) {
    const outbound = await prisma.emailOutboundMessage.findFirst({
      where: { open_token: token, tracking_enabled: true },
      select: { id: true },
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

      const ipHash = hashIp(trackingClientIp(req));
      const recentDuplicate = await prisma.emailTrackingEvent.findFirst({
        where: {
          outbound_message_id: outbound.id,
          event_type: "OPEN",
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
            event_type: "OPEN",
            recipient_email: typeof req.query.email === "string" ? req.query.email : null,
            ip_hash: ipHash,
            user_agent: userAgent,
          },
        });
      }
    }
  }

  res.setHeader("Content-Type", "image/gif");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.status(200).send(ONE_PIXEL_GIF);
}
