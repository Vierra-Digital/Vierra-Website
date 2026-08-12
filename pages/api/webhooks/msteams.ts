import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { asStr } from "@/lib/api/parsing";
import { safeCompare } from "@/lib/crypto";
import { syncBookingAttendance } from "@/lib/booking/syncAttendance";

/**
 * Microsoft Graph change-notification receiver for Teams call records — push path for the
 * attendance sync the hourly poll already covers as a backstop.
 *
 * NOTE: this only handles incoming notifications; it does NOT create or renew the Graph
 * subscription that would make Microsoft actually send them (POST /subscriptions on
 * callRecords, with renewal before the 1-3 day expiry). That's real additional scope not
 * built yet — until it exists, this endpoint sits idle and the hourly poll is what's actually
 * relied on for Teams attendance, same as it is for Zoom before a Marketplace webhook is wired up.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Graph's one-time validation handshake when a subscription is created against this URL.
  const validationToken = asStr(req.query.validationToken);
  if (validationToken) {
    res.setHeader("Content-Type", "text/plain");
    res.status(200).send(validationToken);
    return;
  }

  if (req.method !== "POST") {
    res.status(405).end();
    return;
  }

  const body = req.body as { value?: Array<{ clientState?: string; resourceData?: { id?: string } }> };
  const expectedClientState = (process.env.MSTEAMS_WEBHOOK_CLIENT_STATE || "").trim();

  for (const notification of body?.value || []) {
    if (expectedClientState && !safeCompare(notification.clientState || "", expectedClientState)) continue;
    const meetingId = notification.resourceData?.id;
    if (!meetingId) continue;
    const booking = await prisma.booking.findFirst({
      where: { provider: "microsoft_teams", provider_meeting_id: meetingId, attendance_status: "booked" },
      select: { id: true },
    });
    if (booking) await syncBookingAttendance(booking.id).catch(() => null);
  }

  res.status(202).json({ ok: true });
}
