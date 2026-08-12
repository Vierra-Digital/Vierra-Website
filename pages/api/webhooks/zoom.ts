import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { syncBookingAttendance } from "@/lib/booking/syncAttendance";

export const config = { api: { bodyParser: false } };

async function readRawBody(req: NextApiRequest): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * Zoom webhook receiver — push notification path for the attendance sync that Phase 1's
 * hourly poll (pages/api/booking/sync-attendance/dispatch.ts) already covers as a backstop.
 * Configure this URL in the Zoom Marketplace app's Event Subscriptions with ZOOM_WEBHOOK_SECRET_TOKEN.
 * Doesn't parse the participant payload itself — on meeting.ended it just re-runs the same
 * syncBookingAttendance the poll uses, so there's exactly one place the attendance rule lives.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.status(405).end();
    return;
  }

  const rawBody = await readRawBody(req);
  let payload: { event?: string; payload?: { plainToken?: string; object?: { id?: number | string } } };
  try {
    payload = JSON.parse(rawBody || "{}");
  } catch {
    res.status(400).end();
    return;
  }

  const secret = (process.env.ZOOM_WEBHOOK_SECRET_TOKEN || "").trim();

  // One-time URL validation handshake Zoom performs when the endpoint is saved.
  if (payload.event === "endpoint.url_validation") {
    const plainToken = payload.payload?.plainToken;
    if (!plainToken || !secret) {
      res.status(400).end();
      return;
    }
    const encryptedToken = crypto.createHmac("sha256", secret).update(plainToken).digest("hex");
    res.status(200).json({ plainToken, encryptedToken });
    return;
  }

  // Signature verification for real events: v0:{timestamp}:{rawBody}, HMAC-SHA256 with the secret.
  const timestamp = req.headers["x-zm-request-timestamp"];
  const signature = req.headers["x-zm-signature"];
  if (secret && typeof timestamp === "string" && typeof signature === "string") {
    const expected = "v0=" + crypto.createHmac("sha256", secret).update(`v0:${timestamp}:${rawBody}`).digest("hex");
    if (expected !== signature) {
      res.status(401).end();
      return;
    }
  }

  if (payload.event === "meeting.ended") {
    const meetingId = payload.payload?.object?.id;
    if (meetingId != null) {
      const booking = await prisma.booking.findFirst({
        where: { provider: "zoom", provider_meeting_id: String(meetingId), attendance_status: "booked" },
        select: { id: true },
      });
      if (booking) await syncBookingAttendance(booking.id).catch(() => null);
    }
  }

  res.status(200).json({ ok: true });
}
