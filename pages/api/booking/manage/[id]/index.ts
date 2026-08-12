import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { asStr } from "@/lib/api/parsing";

/**
 * Public booking lookup for the self-service manage page (pages/manage/[id].tsx). The booking
 * id (a 122-bit random UUID) is the capability token — same trust model as e.g. Stripe checkout
 * session URLs. Only returns fields already visible to the prospect from their confirmation
 * email; reschedule/cancel additionally require the invitee's own email as a second factor.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.status(405).json({ message: "Method not allowed." });
    return;
  }
  const id = asStr(req.query.id).trim();
  const booking = await prisma.booking.findUnique({
    where: { id },
    select: {
      id: true,
      invitee_name: true,
      start_at: true,
      end_at: true,
      status: true,
      meeting_join_url: true,
      booking_links: { select: { title: true, timezone: true, duration_minutes: true } },
    },
  });
  if (!booking) {
    res.status(404).json({ message: "Not found." });
    return;
  }
  res.status(200).json({
    id: booking.id,
    inviteeName: booking.invitee_name,
    startAt: booking.start_at.toISOString(),
    endAt: booking.end_at.toISOString(),
    status: booking.status,
    meetingJoinUrl: booking.meeting_join_url,
    title: booking.booking_links.title,
    timezone: booking.booking_links.timezone,
    durationMinutes: booking.booking_links.duration_minutes,
  });
}
