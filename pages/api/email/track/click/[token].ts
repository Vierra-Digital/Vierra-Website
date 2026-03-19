import { createHash } from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

function asToken(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v || "";
}

function hashIp(ip: string) {
  if (!ip) return null;
  return createHash("sha256").update(ip).digest("hex");
}

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
      originalUrl: true,
      outboundMessage: { select: { id: true, trackingEnabled: true } },
    },
  });

  if (!link?.outboundMessage?.id) {
    res.status(404).send("Tracking link not found");
    return;
  }

  if (link.outboundMessage.trackingEnabled) {
    const ip =
      String(req.headers["x-forwarded-for"] || "")
        .split(",")[0]
        .trim() || req.socket.remoteAddress || "";
    await prisma.emailTrackingEvent.create({
      data: {
        outboundMessageId: link.outboundMessage.id,
        trackingLinkId: link.id,
        eventType: "CLICK",
        recipientEmail: typeof req.query.email === "string" ? req.query.email : null,
        ipHash: hashIp(ip),
        userAgent: String(req.headers["user-agent"] || "").slice(0, 512) || null,
      },
    });
  }

  res.redirect(302, normalizeTarget(link.originalUrl));
}
