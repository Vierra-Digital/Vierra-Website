import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { asStr } from "@/lib/api/parsing";
import { getValidGmailAccessToken } from "@/lib/gmail/tokens";
import { cancelCalendarEvent } from "@/lib/calendar/googleCalendar";
import { getValidZoomAccessTokenForUser } from "@/lib/zoom/tokens";
import { getValidMsTeamsAccessTokenForUser } from "@/lib/msteams/tokens";
import { cancelZoomMeeting } from "@/lib/calendar/zoomMeetings";
import { cancelTeamsMeeting } from "@/lib/calendar/msTeamsMeetings";
import { provisionBookingMeeting } from "@/lib/booking/provisionMeeting";
import { findFirstGmailAccountForUser } from "@/lib/booking/teamAvailability";
import { sendEmailCore, escapeHtml } from "@/lib/gmail/sendCore";

const REASSIGN_CUTOFF_MS = 5 * 60 * 1000;

/**
 * Reassign a confirmed team-link booking to a different company member.
 * MEETING_TRACKING_QUESTIONS.md §32/§35: either the current host or a company admin can
 * approve; blocked within 5 minutes of the scheduled start; always audit-logged, but treated
 * as a fresh claim for round-robin fairness (claimBookingSlot's provisioning path, reused here,
 * doesn't touch any fairness counter — auto-assign just counts total claims, so a reassignment
 * counts once for whoever ends up holding it, same as any other claim).
 */
export default withAuth(
  async (req, res, session) => {
    const id = asStr(req.query.id).trim();
    const toUserId = asStr(req.body?.toUserId).trim();
    if (!toUserId) {
      res.status(400).json({ message: "toUserId is required." });
      return;
    }

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { booking_links: true },
    });
    if (!booking || !booking.booking_links.company_id) {
      res.status(404).json({ message: "Booking not found." });
      return;
    }
    if (booking.status !== "confirmed") {
      res.status(409).json({ message: "This booking isn't confirmed yet." });
      return;
    }

    const companyId = booking.booking_links.company_id;
    const [callerMembership, targetMembership] = await Promise.all([
      prisma.companyMembership.findUnique({ where: { user_id: session.user.id }, select: { company_id: true, role: true } }),
      prisma.companyMembership.findUnique({ where: { user_id: toUserId }, select: { company_id: true } }),
    ]);
    if (!targetMembership || targetMembership.company_id !== companyId) {
      res.status(400).json({ message: "toUserId isn't a member of this team." });
      return;
    }
    const isCurrentHost = booking.claimed_by_user_id === session.user.id;
    const isAdmin = callerMembership?.company_id === companyId && callerMembership.role === "admin";
    if (!isCurrentHost && !isAdmin) {
      res.status(403).json({ message: "Only the current host or a team admin can reassign this meeting." });
      return;
    }
    if (booking.start_at.getTime() - Date.now() < REASSIGN_CUTOFF_MS) {
      res.status(409).json({ message: "Too close to the meeting start to reassign — under 5 minutes left." });
      return;
    }

    const fromUserId = booking.claimed_by_user_id;

    // Cancel the old meeting under the outgoing host's own tokens — best-effort, never blocks.
    if (fromUserId) {
      const oldGmailEmail = await findFirstGmailAccountForUser(fromUserId);
      if (oldGmailEmail && booking.google_event_id) {
        const oldToken = await getValidGmailAccessToken(fromUserId, oldGmailEmail);
        if (oldToken.ok) await cancelCalendarEvent(oldToken.accessToken, booking.google_event_id).catch(() => false);
      }
      if (booking.provider === "zoom" && booking.provider_meeting_id) {
        const oldZoom = await getValidZoomAccessTokenForUser(fromUserId);
        if (oldZoom.ok) await cancelZoomMeeting(oldZoom.accessToken, booking.provider_meeting_id).catch(() => false);
      } else if (booking.provider === "microsoft_teams" && booking.provider_meeting_id) {
        const oldTeams = await getValidMsTeamsAccessTokenForUser(fromUserId);
        if (oldTeams.ok) await cancelTeamsMeeting(oldTeams.accessToken, booking.provider_meeting_id).catch(() => false);
      }
    }

    const newGmailEmail = await findFirstGmailAccountForUser(toUserId);
    if (!newGmailEmail) {
      res.status(409).json({ message: "That teammate hasn't connected a Google Calendar account." });
      return;
    }

    const link = booking.booking_links;
    const summary = `${link.title} — ${booking.invitee_name}`;
    const description = booking.invitee_notes ? `Booked via Vierra.\n\nNotes: ${booking.invitee_notes}` : "Booked via Vierra.";
    const provisioned = await provisionBookingMeeting({
      hostUserId: toUserId,
      hostGmailAccountEmail: newGmailEmail,
      provider: booking.provider,
      summary,
      description,
      startIso: booking.start_at.toISOString(),
      endIso: booking.end_at.toISOString(),
      timezone: link.timezone || "UTC",
      durationMinutes: link.duration_minutes,
      attendeeEmails: [booking.invitee_email],
    });

    await prisma.$transaction([
      prisma.booking.update({
        where: { id },
        data: {
          claimed_by_user_id: toUserId,
          google_event_id: provisioned.googleEventId,
          provider_meeting_id: provisioned.providerMeetingId,
          meeting_join_url: provisioned.joinUrl,
        },
      }),
      prisma.bookingReassignmentEvent.create({
        data: { booking_id: id, from_user_id: fromUserId, to_user_id: toUserId, approved_by_user_id: session.user.id },
      }),
    ]);

    const when = booking.start_at.toLocaleString("en-US", { dateStyle: "full", timeStyle: "short", timeZone: link.timezone || "UTC" });
    const joinLinkHtml = provisioned.joinUrl ? `<p>New join link: <a href="${escapeHtml(provisioned.joinUrl)}">${escapeHtml(provisioned.joinUrl)}</a></p>` : "";
    await sendEmailCore(
      toUserId,
      {
        accountEmail: newGmailEmail,
        to: booking.invitee_email,
        subject: `Updated: ${link.title}`,
        bodyHtml: `<p>Hi ${escapeHtml(booking.invitee_name)},</p><p>Your meeting <strong>${escapeHtml(link.title)}</strong> at <strong>${when}</strong> has been rebooked with a new person from our team.</p>${joinLinkHtml}`,
        body: `Your meeting "${link.title}" at ${when} has been rebooked with a new person from our team.`,
      },
      (process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || "").replace(/\/$/, "")
    ).catch(() => null);

    res.status(200).json({ ok: true });
  },
  { methods: ["POST"] }
);
