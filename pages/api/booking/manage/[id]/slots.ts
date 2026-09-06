import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { asStr, isUuid } from "@/lib/api/parsing";
import { getValidGmailAccessToken } from "@/lib/gmail/tokens";
import { getBusy, type BusyInterval } from "@/lib/calendar/googleCalendar";
import { getTeamBusyIntersection } from "@/lib/booking/teamAvailability";
import { computeSlots, DEFAULT_AVAILABILITY, type Availability } from "@/lib/booking/slots";

/** Public: available reschedule times for an existing booking (same logic as [slug]/slots.ts, minus this booking's own hold on the calendar). */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.status(405).json({ message: "Method not allowed." });
    return;
  }
  const id = asStr(req.query.id).trim();
  if (id && !isUuid(id)) {
    res.status(404).json({ message: "Not found." });
    return;
  }
  const booking = await prisma.booking.findUnique({ where: { id }, include: { booking_links: true } });
  if (!booking) {
    res.status(404).json({ message: "Not found." });
    return;
  }
  const link = booking.booking_links;

  const daysAhead = 14;
  const now = new Date();
  const rangeEnd = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

  const localBookings = await prisma.booking.findMany({
    where: { booking_link_id: link.id, id: { not: booking.id }, status: { in: ["confirmed", "slot_claimed"] }, end_at: { gt: now } },
    select: { start_at: true, end_at: true },
  });
  let busy: BusyInterval[];
  if (link.company_id) {
    busy = await getTeamBusyIntersection(link.company_id, now.toISOString(), rangeEnd.toISOString());
  } else {
    const token = await getValidGmailAccessToken(link.user_id, link.account_email);
    busy = token.ok ? await getBusy(token.accessToken, now.toISOString(), rangeEnd.toISOString()) : [];
  }
  busy = [...busy, ...localBookings.map((b) => ({ start: b.start_at.toISOString(), end: b.end_at.toISOString() }))];

  const availability = (link.availability as unknown as Availability) || DEFAULT_AVAILABILITY;
  const slots = computeSlots({
    availability,
    durationMinutes: link.duration_minutes,
    bufferMinutes: link.buffer_minutes,
    busy,
    rangeStart: now,
    rangeEnd,
    nowMs: now.getTime(),
    timeZone: link.timezone || "UTC",
  });

  res.status(200).json({ slots });
}
