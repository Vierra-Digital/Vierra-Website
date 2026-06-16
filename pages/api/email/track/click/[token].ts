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

function getRequestOrigin(req: NextApiRequest) {
  const proto = String(req.headers["x-forwarded-proto"] || "http");
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "");
  return host ? `${proto}://${host}` : "";
}

/** True when the click originates from inside our own portal (staff previewing a sent email),
 *  so we don't record it as recipient engagement. Mirrors the open-pixel logic. */
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

  if (link.outboundMessage.trackingEnabled && !isLikelySelfPreview(req)) {
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
