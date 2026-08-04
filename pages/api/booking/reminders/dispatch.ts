import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { safeCompare } from "@/lib/crypto";
import { findFirstGmailAccountForUser } from "@/lib/booking/teamAvailability";
import { sendEmailCore, escapeHtml } from "@/lib/gmail/sendCore";

/**
 * Cron dispatch for the "small reminder email" MEETING_TRACKING_QUESTIONS.md §13/§23 asked for
 * (a day before, alongside the native calendar invite — not a full notification suite, which is
 * explicitly stubbed for later). Runs hourly; a 2-hour lookahead window with a reminder_sent_at
 * idempotency flag means an hourly cadence can't double-send or miss a booking.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST" && req.method !== "GET") {
    res.setHeader("Allow", "GET, POST");
    res.status(405).json({ message: "Method not allowed." });
    return;
  }
  const secret = process.env.CRON_SECRET || "";
  const provided =
    (typeof req.headers["x-cron-secret"] === "string" ? req.headers["x-cron-secret"] : "") ||
    String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!secret || !safeCompare(provided, secret)) {
    res.status(401).json({ message: "Unauthorized." });
    return;
  }

  const windowStart = new Date(Date.now() + 23 * 60 * 60 * 1000);
  const windowEnd = new Date(Date.now() + 25 * 60 * 60 * 1000);
  const due = await prisma.booking.findMany({
    where: { status: "confirmed", reminder_sent_at: null, start_at: { gte: windowStart, lte: windowEnd } },
    include: { booking_links: true },
    take: 200,
  });

  let sent = 0;
  for (const booking of due) {
    const link = booking.booking_links;
    const hostUserId = booking.claimed_by_user_id || link.user_id;
    const fromEmail = (await findFirstGmailAccountForUser(hostUserId)) || link.account_email;
    const when = booking.start_at.toLocaleString("en-US", { dateStyle: "full", timeStyle: "short", timeZone: link.timezone || "UTC" });
    const joinLinkHtml = booking.meeting_join_url
      ? `<p>Join link: <a href="${escapeHtml(booking.meeting_join_url)}">${escapeHtml(booking.meeting_join_url)}</a></p>`
      : "";
    const result = await sendEmailCore(
      hostUserId,
      {
        accountEmail: fromEmail,
        to: booking.invitee_email,
        subject: `Reminder: ${link.title} tomorrow`,
        bodyHtml: `<p>Hi ${escapeHtml(booking.invitee_name)},</p><p>Just a reminder — <strong>${escapeHtml(link.title)}</strong> is coming up at <strong>${when} (${link.timezone || "UTC"})</strong>.</p>${joinLinkHtml}`,
        body: `Reminder: "${link.title}" is coming up at ${when}.`,
      },
      (process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || "").replace(/\/$/, "")
    ).catch(() => null);
    await prisma.booking.update({ where: { id: booking.id }, data: { reminder_sent_at: new Date() } });
    if (result?.ok) sent += 1;
  }

  res.status(200).json({ checked: due.length, sent });
}
