import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { asStr } from "@/lib/api/parsing";
import { getValidGmailAccessToken } from "@/lib/gmail/tokens";
import { getBusy } from "@/lib/calendar/googleCalendar";
import { computeSlots, DEFAULT_AVAILABILITY, type Availability } from "@/lib/booking/slots";
import { getTeamBusyIntersection } from "@/lib/booking/teamAvailability";

// Slugs of links that should never look "fully booked out" just because a hardcoded window/
// count cap was reached — bounded only by the weekly `availability` hours, not by a rolling
// date cutoff. Opt-in by slug (env-configured, comma-separated) rather than a DB column: keeps
// this scoped to specific links without touching every other booking link's behavior or
// requiring a schema migration. Must include the same slug NEXT_PUBLIC_AUDIT_CALL_BOOKING_SLUG
// points the audit-call modal at — set both when that link's slug changes.
const UNBOUNDED_WINDOW_SLUGS = new Set(
  (process.env.BOOKING_LINKS_UNBOUNDED_WINDOW || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
);
const UNBOUNDED_MAX_DAYS_AHEAD = 365;
// computeSlots' own default (200) is what actually produced the "2-week" ceiling in practice —
// at typical business hours that's exhausted in under two weeks, well before any day-range cap
// is reached. Sized generously above what UNBOUNDED_MAX_DAYS_AHEAD could ever produce at
// realistic meeting lengths, so it's never the thing that truncates the window.
const UNBOUNDED_MAX_SLOTS = 20000;

/** Public: available slots for a booking link over the next N days. No auth (invitee-facing). */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.status(405).json({ message: "Method not allowed." });
    return;
  }
  const slug = asStr(req.query.id).trim();
  const link = await prisma.bookingLink.findUnique({ where: { slug } });
  if (!link || !link.active) {
    res.status(404).json({ message: "Booking link not found." });
    return;
  }

  const unbounded = UNBOUNDED_WINDOW_SLUGS.has(slug);
  const daysAhead = unbounded
    ? Math.min(Math.max(Number(asStr(req.query.days)) || UNBOUNDED_MAX_DAYS_AHEAD, 1), UNBOUNDED_MAX_DAYS_AHEAD)
    : Math.min(Math.max(Number(asStr(req.query.days)) || 14, 1), 60);
  const now = new Date();
  const rangeStart = now;
  const rangeEnd = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

  const busy = link.company_id
    ? await getTeamBusyIntersection(link.company_id, rangeStart.toISOString(), rangeEnd.toISOString())
    : await (async () => {
        const token = await getValidGmailAccessToken(link.user_id, link.account_email);
        return token.ok ? getBusy(token.accessToken, rangeStart.toISOString(), rangeEnd.toISOString()) : [];
      })();

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
    max: unbounded ? UNBOUNDED_MAX_SLOTS : undefined,
  });

  res.status(200).json({
    title: link.title,
    description: link.description,
    durationMinutes: link.duration_minutes,
    slots,
  });
}
