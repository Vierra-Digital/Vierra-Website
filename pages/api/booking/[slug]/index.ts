import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { asStr } from "@/lib/api/parsing";
import { getValidGmailAccessToken } from "@/lib/gmail/tokens";
import { getBusy, createCalendarEvent, buildIcs, type BusyInterval } from "@/lib/calendar/googleCalendar";
import { computeSlots, DEFAULT_AVAILABILITY, type Availability } from "@/lib/booking/slots";
import { sendEmailCore } from "@/lib/gmail/sendCore";

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
  const slug = asStr(req.query.slug).trim();
  const link = await prisma.bookingLink.findUnique({ where: { slug } });
  if (!link || !link.active) {
    res.status(404).json({ message: "Booking link not found." });
    return;
  }

  const startIso = asStr(req.body?.start).trim();
  const inviteeName = asStr(req.body?.inviteeName).trim();
  const inviteeEmail = asStr(req.body?.inviteeEmail).trim().toLowerCase();
  const notes = asStr(req.body?.notes).trim();
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime()) || start.getTime() <= Date.now()) {
    res.status(400).json({ message: "Pick a valid future time." });
    return;
  }
  if (!inviteeName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteeEmail)) {
    res.status(400).json({ message: "Your name and a valid email are required." });
    return;
  }
  const end = new Date(start.getTime() + link.duration_minutes * 60 * 1000);

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
      },
    });
  });
  if (!booking) {
    res.status(409).json({ message: "That time was just taken — please pick another." });
    return;
  }

  // Now create the calendar event (may be null if the host lacks calendar.events scope) and
  // backfill its id. Kept outside the transaction so a slow Google call never holds the lock.
  const eventId = await createCalendarEvent(token.accessToken, {
    summary,
    description,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    timezone: link.timezone || "UTC",
    attendees: [inviteeEmail, link.account_email],
  });
  if (eventId) {
    await prisma.booking.update({ where: { id: booking.id }, data: { google_event_id: eventId } });
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
  const confirmationHtml = `<p>Hi ${inviteeName},</p><p>Your meeting <strong>${link.title}</strong> is confirmed for <strong>${when} (${link.timezone || "UTC"})</strong>.</p>${notes ? `<p>Your notes: ${notes}</p>` : ""}<p>See you then!</p>`;
  const attachments = [{ filename: "invite.ics", contentType: "text/calendar", contentBase64: Buffer.from(ics, "utf8").toString("base64") }];

  await sendEmailCore(
    link.user_id,
    { accountEmail: link.account_email, to: inviteeEmail, subject: `Confirmed: ${link.title}`, bodyHtml: confirmationHtml, body: `Your meeting "${link.title}" is confirmed for ${when}.`, attachments },
    baseUrl(req)
  ).catch(() => null);

  // If no Calendar event was created (host lacks calendar.events scope), notify the host too.
  if (!eventId) {
    await sendEmailCore(
      link.user_id,
      {
        accountEmail: link.account_email,
        to: link.account_email,
        subject: `New booking: ${link.title} with ${inviteeName}`,
        bodyHtml: `<p>${inviteeName} (${inviteeEmail}) booked <strong>${link.title}</strong> for <strong>${when}</strong>.</p>${notes ? `<p>Notes: ${notes}</p>` : ""}`,
        body: `${inviteeName} (${inviteeEmail}) booked ${link.title} for ${when}.`,
        attachments,
      },
      baseUrl(req)
    ).catch(() => null);
  }

  res.status(200).json({ ok: true, when });
}
