import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { asStr } from "@/lib/api/parsing";
import { getValidGmailAccessToken } from "@/lib/gmail/tokens";
import { getBusy } from "@/lib/calendar/googleCalendar";
import { computeSlots, DEFAULT_AVAILABILITY, type Availability } from "@/lib/booking/slots";

/** Public: available slots for a booking link over the next N days. No auth (invitee-facing). */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.status(405).json({ message: "Method not allowed." });
    return;
  }
  const slug = asStr(req.query.slug).trim();
  const link = await prisma.bookingLink.findUnique({ where: { slug } });
  if (!link || !link.active) {
    res.status(404).json({ message: "Booking link not found." });
    return;
  }

  const daysAhead = Math.min(Math.max(Number(asStr(req.query.days)) || 14, 1), 60);
  const now = new Date();
  const rangeStart = now;
  const rangeEnd = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

  const token = await getValidGmailAccessToken(link.user_id, link.account_email);
  const busy = token.ok ? await getBusy(token.accessToken, rangeStart.toISOString(), rangeEnd.toISOString()) : [];

  const availability = (link.availability as unknown as Availability) || DEFAULT_AVAILABILITY;
  const slots = computeSlots({
    availability,
    durationMinutes: link.duration_minutes,
    bufferMinutes: link.buffer_minutes,
    busy,
    rangeStart,
    rangeEnd,
    nowMs: now.getTime(),
    timeZone: link.timezone || "UTC",
  });

  res.status(200).json({
    title: link.title,
    description: link.description,
    durationMinutes: link.duration_minutes,
    slots,
  });
}
