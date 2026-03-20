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
const MIN_OPEN_EVENT_DELAY_MS = 15_000;

function getRequestOrigin(req: NextApiRequest) {
  const proto = String(req.headers["x-forwarded-proto"] || "http");
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "");
  return host ? `${proto}://${host}` : "";
}

function isLikelySelfPreview(req: NextApiRequest) {
  const fetchSite = String(req.headers["sec-fetch-site"] || "").toLowerCase();
  if (fetchSite === "same-origin") return true;

  const referer = String(req.headers.referer || "");
  if (!referer) return false;
  const requestOrigin = getRequestOrigin(req);
  if (!requestOrigin) return false;

  try {
    const refererUrl = new URL(referer);
    return refererUrl.origin === requestOrigin && refererUrl.pathname.startsWith("/panel");
  } catch {
    return false;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = normalizeOpenToken(asToken(req.query.token));
  if (token) {
    const outbound = await prisma.emailOutboundMessage.findFirst({
      where: { openToken: token, trackingEnabled: true },
      select: { id: true, createdAt: true },
    });
    if (outbound) {
      const sentAgeMs = Date.now() - outbound.createdAt.getTime();
      const shouldIgnoreOpen =
        isLikelySelfPreview(req) || (sentAgeMs >= 0 && sentAgeMs < MIN_OPEN_EVENT_DELAY_MS);
      if (shouldIgnoreOpen) {
        res.setHeader("Content-Type", "image/gif");
        res.setHeader("Cache-Control", "no-store, max-age=0");
        res.status(200).send(ONE_PIXEL_GIF);
        return;
      }

      const ip =
        String(req.headers["x-forwarded-for"] || "")
          .split(",")[0]
          .trim() || req.socket.remoteAddress || "";
      const ipHash = hashIp(ip);
      const userAgent = String(req.headers["user-agent"] || "").slice(0, 512) || null;
      const recentDuplicate = await prisma.emailTrackingEvent.findFirst({
        where: {
          outboundMessageId: outbound.id,
          eventType: "OPEN",
          ipHash,
          userAgent,
          occurredAt: {
            gte: new Date(Date.now() - 30_000),
          },
        },
        select: { id: true },
      });
      if (!recentDuplicate) {
      await prisma.emailTrackingEvent.create({
        data: {
          outboundMessageId: outbound.id,
          eventType: "OPEN",
          recipientEmail: typeof req.query.email === "string" ? req.query.email : null,
          ipHash,
          userAgent,
        },
      });
      }
    }
  }

  res.setHeader("Content-Type", "image/gif");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.status(200).send(ONE_PIXEL_GIF);
}
