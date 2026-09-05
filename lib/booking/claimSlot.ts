import { prisma } from "@/lib/prisma";
import { provisionBookingMeeting } from "@/lib/booking/provisionMeeting";
import { findFirstGmailAccountForUser } from "@/lib/booking/teamAvailability";
import { sendEmailCore, escapeHtml } from "@/lib/gmail/sendCore";
import { buildIcs } from "@/lib/calendar/googleCalendar";

export type ClaimResult =
  | { ok: true }
  | { ok: false; reason: "not_claimable" | "no_calendar_connected" | "provisioning_failed" };

/**
 * Pair a specific host to an unclaimed team-link slot (status='slot_claimed' -> 'confirmed'):
 * atomically claims the row (guards two members racing the same slot), provisions the real
 * meeting under that host's own tokens, and emails the prospect. Shared by the manual claim
 * endpoint (pages/api/booking/[id]/claim.ts) and the round-robin auto-assign job
 * (the `auto-assign-meetings` pg_cron job, prisma/manual/20260901_migrate_cron_to_pg_cron.sql)
 * so there's exactly one place this happens.
 */
export async function claimBookingSlot(bookingId: string, hostUserId: string): Promise<ClaimResult> {
  // Snapshotted onto the booking so "who took this meeting" survives the host's users row
  // later being deleted (claimed_by_user_id alone would just go SET NULL).
  const host = await prisma.user.findUnique({ where: { id: hostUserId }, select: { email: true } });

  // Atomic conditional update — only one caller can flip status='slot_claimed' -> a transitional
  // 'claiming' marker; whoever's updateMany reports count=1 won the race.
  const claimed = await prisma.booking.updateMany({
    where: { id: bookingId, status: "slot_claimed" },
    data: { status: "claiming", claimed_by_user_id: hostUserId, claimed_by_user_email: host?.email ?? null },
  });
  if (claimed.count === 0) return { ok: false, reason: "not_claimable" };

  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: { booking_links: true } });
  if (!booking) return { ok: false, reason: "not_claimable" };

  const hostGmailAccountEmail = await findFirstGmailAccountForUser(hostUserId);
  if (!hostGmailAccountEmail) {
    // Roll back to slot_claimed so someone else (or a future auto-assign pass) can take it.
    await prisma.booking.update({
      where: { id: bookingId },
      data: { status: "slot_claimed", claimed_by_user_id: null, claimed_by_user_email: null },
    });
    return { ok: false, reason: "no_calendar_connected" };
  }

  const link = booking.booking_links;
  const summary = `${link.title} — ${booking.invitee_name}`;
  const description = booking.invitee_notes ? `Booked via Vierra.\n\nNotes: ${booking.invitee_notes}` : "Booked via Vierra.";

  let provisioned: Awaited<ReturnType<typeof provisionBookingMeeting>>;
  try {
    provisioned = await provisionBookingMeeting({
      hostUserId,
      hostGmailAccountEmail,
      provider: booking.provider,
      summary,
      description,
      startIso: booking.start_at.toISOString(),
      endIso: booking.end_at.toISOString(),
      timezone: link.timezone || "UTC",
      durationMinutes: link.duration_minutes,
      attendeeEmails: [booking.invitee_email],
    });
  } catch (err) {
    // Roll back to slot_claimed so the cron or a manual claim can retry — otherwise the row
    // is stuck at 'claiming' forever, invisible to both the auto-assign query and the UI.
    console.error("claimBookingSlot provisioning failed", bookingId, err);
    await prisma.booking.update({
      where: { id: bookingId },
      data: { status: "slot_claimed", claimed_by_user_id: null, claimed_by_user_email: null },
    });
    return { ok: false, reason: "provisioning_failed" };
  }

  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      status: "confirmed",
      google_event_id: provisioned.googleEventId,
      provider_meeting_id: provisioned.providerMeetingId,
      meeting_join_url: provisioned.joinUrl,
    },
  });

  const when = booking.start_at.toLocaleString("en-US", { dateStyle: "full", timeStyle: "short", timeZone: link.timezone || "UTC" });
  const joinLinkHtml = provisioned.joinUrl ? `<p>Join link: <a href="${escapeHtml(provisioned.joinUrl)}">${escapeHtml(provisioned.joinUrl)}</a></p>` : "";
  const ics = buildIcs({
    uid: booking.id,
    summary,
    description,
    startIso: booking.start_at.toISOString(),
    endIso: booking.end_at.toISOString(),
    organizerEmail: hostGmailAccountEmail,
    attendeeEmail: booking.invitee_email,
  });

  await sendEmailCore(
    hostUserId,
    {
      accountEmail: hostGmailAccountEmail,
      to: booking.invitee_email,
      subject: `Confirmed: ${link.title}`,
      bodyHtml: `<p>Hi ${escapeHtml(booking.invitee_name)},</p><p>Your meeting <strong>${escapeHtml(link.title)}</strong> is confirmed for <strong>${when} (${link.timezone || "UTC"})</strong>.</p>${joinLinkHtml}<p>See you then!</p>`,
      body: `Your meeting "${link.title}" is confirmed for ${when}.`,
      attachments: [{ filename: "invite.ics", contentType: "text/calendar", contentBase64: Buffer.from(ics, "utf8").toString("base64") }],
    },
    (process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || "").replace(/\/$/, "")
  ).catch(() => null);

  return { ok: true };
}
