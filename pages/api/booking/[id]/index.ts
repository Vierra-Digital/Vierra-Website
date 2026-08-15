import type { NextApiRequest, NextApiResponse } from "next";
import { EMAIL_REGEX } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import { asStr } from "@/lib/api/parsing";
import { getValidGmailAccessToken } from "@/lib/gmail/tokens";
import { getBusy, createCalendarEvent, buildIcs, type BusyInterval, type CreatedCalendarEvent } from "@/lib/calendar/googleCalendar";
import { computeSlots, DEFAULT_AVAILABILITY, type Availability } from "@/lib/booking/slots";
import { sendEmailCore, escapeHtml } from "@/lib/gmail/sendCore";
import { getValidZoomAccessTokenForUser } from "@/lib/zoom/tokens";
import { getValidMsTeamsAccessTokenForUser } from "@/lib/msteams/tokens";
import { createZoomMeeting } from "@/lib/calendar/zoomMeetings";
import { createTeamsMeeting } from "@/lib/calendar/msTeamsMeetings";
import { handleTeamSlotClaim } from "@/lib/booking/teamSlotClaim";
import { markCampaignContactMeetingBooked } from "@/lib/campaigns/meetingBooked";

// Anti-abuse throttle for the public (unauthenticated) booking endpoint. Keyed off the bookings
// table (no new infra) — since only a successful booking creates a row, this directly caps the
// harmful side effects (a calendar event + emails sent from the host's account). Probe/validation
// failures create no row and have no side effects, so they don't need throttling here.
const RATE_WINDOW_MS = 60 * 1000;
const MAX_BOOKINGS_PER_LINK_PER_WINDOW = 5;
const EMAIL_WINDOW_MS = 60 * 60 * 1000;
const MAX_BOOKINGS_PER_EMAIL_PER_LINK = 5;

function baseUrl(req: NextApiRequest): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || "";
  if (explicit) return explicit.replace(/\/$/, "");
  const proto = String(req.headers["x-forwarded-proto"] || "https");
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "localhost:3000");
  return `${proto}://${host}`.replace(/\/$/, "");
}

/** Public: create a booking for a link. Validates the slot is still free, then books it. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ message: "Method not allowed." });
    return;
  }
  const slug = asStr(req.query.id).trim();
  const link = await prisma.bookingLink.findUnique({ where: { slug } });
  if (!link || !link.active) {
    res.status(404).json({ message: "Booking link not found." });
    return;
  }

  const startIso = asStr(req.body?.start).trim();
  const inviteeName = asStr(req.body?.inviteeName).trim();
  const inviteeEmail = asStr(req.body?.inviteeEmail).trim().toLowerCase();
  const notes = asStr(req.body?.notes).trim();
  // Optional campaign-contact attribution — set when the booking link was inserted into a
  // campaign email with a ?ref= tracking param (see components/PanelPages/EmailingPlatformSection.tsx
  // and pages/book/[slug].tsx). Absent for plain shared booking-page links, which is fine.
  const campaignContactId = asStr(req.body?.ref).trim();
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime()) || start.getTime() <= Date.now()) {
    res.status(400).json({ message: "Pick a valid future time." });
    return;
  }
  if (!inviteeName || !EMAIL_REGEX.test(inviteeEmail)) {
    res.status(400).json({ message: "Your name and a valid email are required." });
    return;
  }

  // Throttle before doing any Google/calendar work or sending mail.
  const nowMs = Date.now();
  const recentForLink = await prisma.booking.count({
    where: { booking_link_id: link.id, created_at: { gte: new Date(nowMs - RATE_WINDOW_MS) } },
  });
  if (recentForLink >= MAX_BOOKINGS_PER_LINK_PER_WINDOW) {
    res.status(429).json({ message: "Too many booking attempts right now. Please try again in a minute." });
    return;
  }
  const recentForEmail = await prisma.booking.count({
    where: {
      booking_link_id: link.id,
      invitee_email: inviteeEmail,
      created_at: { gte: new Date(nowMs - EMAIL_WINDOW_MS) },
    },
  });
  if (recentForEmail >= MAX_BOOKINGS_PER_EMAIL_PER_LINK) {
    res.status(429).json({ message: "You've booked this link several times recently. Please wait a bit before booking again." });
    return;
  }

  const end = new Date(start.getTime() + link.duration_minutes * 60 * 1000);

  // Team link (round-robin) — claim-queue flow, no single host to book against yet. Kept as a
  // separate branch rather than threading through the solo logic below, since almost every step
  // differs (team-wide availability, no meeting/calendar-event creation until claimed).
  if (link.company_id) {
    await handleTeamSlotClaim(req, res, link, { start, end, inviteeName, inviteeEmail, notes, campaignContactId });
    return;
  }

  const token = await getValidGmailAccessToken(link.user_id, link.account_email);
  if (!token.ok) {
    res.status(502).json({ message: "This calendar is temporarily unavailable." });
    return;
  }

  // Validate the submitted start server-side: it must be a slot the availability window would
  // actually offer AND still free. We can't trust the client to only POST an offered time, so
  // we recompute slots (same logic as the slots endpoint) over a window covering `start`, with
  // busy = Google free/busy + our own confirmed bookings. The local bookings matter because a
  // booking made when the host lacked calendar.events scope has no Google event, so free/busy
  // never reports it — without this the same slot stays bookable forever.
  const now = new Date();
  const validationRangeEnd = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  const localBookings = await prisma.booking.findMany({
    where: { booking_link_id: link.id, status: "confirmed", end_at: { gt: now } },
    select: { start_at: true, end_at: true },
  });
  const busy: BusyInterval[] = [
    ...(await getBusy(token.accessToken, now.toISOString(), validationRangeEnd.toISOString())),
    ...localBookings.map((b) => ({ start: b.start_at.toISOString(), end: b.end_at.toISOString() })),
  ];
  const availability = (link.availability as unknown as Availability) || DEFAULT_AVAILABILITY;
  const offered = computeSlots({
    availability,
    durationMinutes: link.duration_minutes,
    bufferMinutes: link.buffer_minutes,
    busy,
    rangeStart: now,
    rangeEnd: validationRangeEnd,
    nowMs: now.getTime(),
    timeZone: link.timezone || "UTC",
  });
  if (!offered.includes(start.toISOString())) {
    // Not in the window, misaligned to the slot grid, in the buffer around a busy event, or
    // overlapping an existing booking.
    res.status(409).json({ message: "That time isn't available — please pick another." });
    return;
  }

  const summary = `${link.title} — ${inviteeName}`;
  const description = notes ? `Booked via Vierra.\n\nNotes: ${notes}` : "Booked via Vierra.";

  // Reserve the slot atomically BEFORE creating any calendar event: a per-link advisory lock
  // serializes the overlap-check + insert, so two identical submits racing between page load
  // and here can't both succeed (the loser returns 409 and no orphaned calendar event/email is
  // created for it). The lock is transaction-scoped and released on commit/rollback.
  const booking = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`booking:${link.id}`}))`;
    const conflict = await tx.booking.findFirst({
      where: { booking_link_id: link.id, status: "confirmed", start_at: { lt: end }, end_at: { gt: start } },
      select: { id: true },
    });
    if (conflict) return null;
    return tx.booking.create({
      data: {
        booking_link_id: link.id,
        invitee_name: inviteeName,
        invitee_email: inviteeEmail,
        invitee_notes: notes || null,
        start_at: start,
        end_at: end,
        status: "confirmed",
        google_event_id: null,
        provider: link.provider,
        campaign_contact_id: campaignContactId || null,
      },
    });
  });
  if (!booking) {
    res.status(409).json({ message: "That time was just taken — please pick another." });
    return;
  }

  // If this link uses Zoom/Teams, create the real meeting under the host's provider account
  // FIRST so its join link can be embedded in the Google Calendar event we still write either
  // way (free/busy blocking + the invite come from Calendar regardless of video provider — see
  // DESIGN.md §14 deviations). Falls back to a plain Calendar event with no video link if the
  // host's provider token is missing/invalid, same graceful-degradation shape as the existing
  // "no calendar.events scope -> .ics only" fallback below.
  let providerMeeting: { meetingId: string; joinUrl: string | null } | null = null;
  if (link.provider === "zoom") {
    const zoomToken = await getValidZoomAccessTokenForUser(link.user_id);
    if (zoomToken.ok) {
      providerMeeting = await createZoomMeeting(zoomToken.accessToken, {
        topic: summary,
        startIso: start.toISOString(),
        durationMinutes: link.duration_minutes,
        timezone: link.timezone || "UTC",
      });
    }
  } else if (link.provider === "microsoft_teams") {
    const teamsToken = await getValidMsTeamsAccessTokenForUser(link.user_id);
    if (teamsToken.ok) {
      providerMeeting = await createTeamsMeeting(teamsToken.accessToken, {
        subject: summary,
        startIso: start.toISOString(),
        endIso: end.toISOString(),
      });
    }
  }

  // Now create the calendar event (may be null if the host lacks calendar.events scope) and
  // backfill its id + join URL/code. Kept outside the transaction so a slow Google call never
  // holds the lock. Google Meet auto-provisions its own link; Zoom/Teams pass their real join
  // URL through as the event location instead.
  const created: CreatedCalendarEvent | null = await createCalendarEvent(token.accessToken, {
    summary,
    description,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    timezone: link.timezone || "UTC",
    attendees: [inviteeEmail, link.account_email],
    createConferenceLink: link.provider === "google_meet",
    location: providerMeeting?.joinUrl || undefined,
  });
  const finalProviderMeetingId = providerMeeting?.meetingId ?? created?.meetingCode ?? null;
  const finalJoinUrl = providerMeeting?.joinUrl ?? created?.joinUrl ?? null;
  if (created || providerMeeting) {
    await prisma.booking.update({
      where: { id: booking.id },
      data: { google_event_id: created?.eventId || null, provider_meeting_id: finalProviderMeetingId, meeting_join_url: finalJoinUrl },
    });
  }

  // Best-effort: attribute this booking to a campaign contact and tag it meeting_booked (fires
  // the same Discord notification as manually re-categorizing the contact). Never blocks the
  // booking itself — a bad/stale ref shouldn't break confirmation.
  if (campaignContactId) {
    await markCampaignContactMeetingBooked(campaignContactId, "booking_link_confirmed");
  }

  // Confirmation email to the invitee (with an .ics so it works even without a Calendar event).
  const ics = buildIcs({
    uid: booking.id,
    summary,
    description,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    organizerEmail: link.account_email,
    attendeeEmail: inviteeEmail,
  });
  const when = start.toLocaleString("en-US", { dateStyle: "full", timeStyle: "short", timeZone: link.timezone || "UTC" });
  // Invitee fields are attacker-controlled on this public endpoint — escape before embedding in the
  // HTML bodies (the host-notification lands in the host's own inbox, so raw HTML here would be an
  // injection/phishing vector). link.title is host-owned but escaped too for consistency.
  const safeName = escapeHtml(inviteeName);
  const safeEmail = escapeHtml(inviteeEmail);
  const safeNotes = escapeHtml(notes);
  const safeTitle = escapeHtml(link.title);
  // Surface the join link directly in our own email too — don't rely solely on Google's native
  // calendar-invite email as the only place it ever appears (that invite also may not arrive if
  // the invitee's mail client hides calendar invites, or if the host lacked calendar.events scope).
  const joinLinkHtml = finalJoinUrl ? `<p>Join link: <a href="${escapeHtml(finalJoinUrl)}">${escapeHtml(finalJoinUrl)}</a></p>` : "";
  const manageUrl = `${baseUrl(req)}/manage/${booking.id}`;
  const confirmationHtml = `<p>Hi ${safeName},</p><p>Your meeting <strong>${safeTitle}</strong> is confirmed for <strong>${when} (${link.timezone || "UTC"})</strong>.</p>${joinLinkHtml}${notes ? `<p>Your notes: ${safeNotes}</p>` : ""}<p>See you then!</p><p><a href="${escapeHtml(manageUrl)}">Need to reschedule or cancel?</a></p>`;
  // Only attach our own .ics when there's no real Calendar event: createCalendarEvent's
  // sendUpdates=all already makes Google send the invitee (and host) a native calendar invite
  // in that case, so attaching a second, separately-built .ics (different UID) on top would
  // hand them two invites for the same meeting — most calendar clients add that as two separate
  // events rather than recognizing them as one.
  const attachments = created
    ? undefined
    : [{ filename: "invite.ics", contentType: "text/calendar", contentBase64: Buffer.from(ics, "utf8").toString("base64") }];

  await sendEmailCore(
    link.user_id,
    { accountEmail: link.account_email, to: inviteeEmail, subject: `Confirmed: ${link.title}`, bodyHtml: confirmationHtml, body: `Your meeting "${link.title}" is confirmed for ${when}.`, attachments },
    baseUrl(req)
  ).catch(() => null);

  // If no Calendar event was created (host lacks calendar.events scope), notify the host too.
  if (!created) {
    await sendEmailCore(
      link.user_id,
      {
        accountEmail: link.account_email,
        to: link.account_email,
        subject: `New booking: ${link.title} with ${inviteeName}`,
        bodyHtml: `<p>${safeName} (${safeEmail}) booked <strong>${safeTitle}</strong> for <strong>${when}</strong>.</p>${notes ? `<p>Notes: ${safeNotes}</p>` : ""}`,
        body: `${inviteeName} (${inviteeEmail}) booked ${link.title} for ${when}.`,
        attachments,
      },
      baseUrl(req)
    ).catch(() => null);
  }

  res.status(200).json({ ok: true, when });
}
