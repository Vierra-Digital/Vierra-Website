import { prisma } from "@/lib/prisma";

export type ClientUpcomingMeeting = {
  id: string;
  title: string;
  startIso: string;
  endIso: string | null;
  timeZone: string;
  meetingLink: string | null;
  provider: string;
};

const MEETINGS_LIMIT = 5;

/**
 * Upcoming meetings for a client's own dashboard.
 *
 * `Booking` has no `company_id` column — every meeting is attributed only to the BookingLink's
 * owner (the staff member) and the invitee's raw name/email (see lib/dashboard/upcomingMeetings.ts,
 * which reads the equivalent admin-side data straight from each staff member's own Google
 * Calendar). The client side has no calendar to read, so this scopes instead by matching the
 * booking's invitee email against every representative on the client's company — the same set
 * `pages/api/client/team` already treats as "this company's people".
 */
export async function getUpcomingMeetingsForCompany(companyId: string): Promise<ClientUpcomingMeeting[]> {
  const representatives = await prisma.client.findMany({
    where: { company_id: companyId },
    select: { email: true },
  });
  const emails = [...new Set(representatives.map((r) => r.email.trim().toLowerCase()).filter(Boolean))];
  if (emails.length === 0) return [];

  const bookings = await prisma.booking.findMany({
    where: {
      invitee_email: { in: emails, mode: "insensitive" },
      status: "confirmed",
      start_at: { gte: new Date() },
    },
    orderBy: { start_at: "asc" },
    take: MEETINGS_LIMIT,
    select: {
      id: true,
      start_at: true,
      end_at: true,
      meeting_join_url: true,
      provider: true,
      booking_links: { select: { title: true, timezone: true } },
    },
  });

  return bookings.map((b) => ({
    id: b.id,
    title: b.booking_links?.title || "Meeting with Vierra",
    startIso: b.start_at.toISOString(),
    endIso: b.end_at ? b.end_at.toISOString() : null,
    timeZone: b.booking_links?.timezone || "UTC",
    meetingLink: b.meeting_join_url || null,
    provider: b.provider,
  }));
}
