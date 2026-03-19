import { createHash } from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

function asToken(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v || "";
}

function normalizeOpenToken(value: string) {
  return value.trim().replace(/\.gif$/i, "");
}

function hashIp(ip: string) {
  if (!ip) return null;
  return createHash("sha256").update(ip).digest("hex");
}

const ONE_PIXEL_GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==", "base64");

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = normalizeOpenToken(asToken(req.query.token));
  if (token) {
    const outbound = await prisma.emailOutboundMessage.findFirst({
      where: { openToken: token, trackingEnabled: true },
      select: { id: true },
    });
    if (outbound) {
      const ip =
        String(req.headers["x-forwarded-for"] || "")
          .split(",")[0]
          .trim() || req.socket.remoteAddress || "";
      await prisma.emailTrackingEvent.create({
        data: {
          outboundMessageId: outbound.id,
          eventType: "OPEN",
          recipientEmail: typeof req.query.email === "string" ? req.query.email : null,
          ipHash: hashIp(ip),
          userAgent: String(req.headers["user-agent"] || "").slice(0, 512) || null,
        },
      });
    }
  }

  res.setHeader("Content-Type", "image/gif");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.status(200).send(ONE_PIXEL_GIF);
}
