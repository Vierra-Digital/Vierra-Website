import { prisma } from "@/lib/prisma";
import { getValidGmailAccessToken } from "@/lib/gmail/tokens";
import { getBusy, type BusyInterval } from "@/lib/calendar/googleCalendar";

/** First connected Gmail account for a user — used to resolve a claiming/candidate host's own calendar. */
export async function findFirstGmailAccountForUser(userId: string): Promise<string | null> {
  const row = await prisma.platformToken.findFirst({
    where: { user_id: userId, platform: { startsWith: "gmail:" } },
    select: { platform: true },
  });
  return row ? row.platform.replace(/^gmail:/, "") : null;
}

/**
 * Intersection of N busy-interval lists — a time is only "all busy" if every list covers it.
 * Standard sweep-line: +1 at each interval start, -1 at each end; a segment where the running
 * count reaches `lists.length` is where everyone overlaps.
 */
function intersectBusyIntervals(lists: BusyInterval[][]): BusyInterval[] {
  const n = lists.length;
  if (n === 0) return [];
  const events: Array<{ t: number; delta: number }> = [];
  for (const list of lists) {
    for (const iv of list) {
      events.push({ t: new Date(iv.start).getTime(), delta: 1 });
      events.push({ t: new Date(iv.end).getTime(), delta: -1 });
    }
  }
  events.sort((a, b) => a.t - b.t || a.delta - b.delta);

  const result: BusyInterval[] = [];
  let count = 0;
  let segStart: number | null = null;
  for (const e of events) {
    const before = count;
    count += e.delta;
    if (before < n && count >= n) segStart = e.t;
    else if (before >= n && count < n && segStart !== null) {
      result.push({ start: new Date(segStart).toISOString(), end: new Date(e.t).toISOString() });
      segStart = null;
    }
  }
  return result;
}

/**
 * "Team busy" for a company over a window — a time only blocks the booking page if EVERY
 * calendar-connected member is busy then (MEETING_TRACKING_QUESTIONS.md §37: only exclude a
 * slot when nobody's free). Members with no connected Google Calendar are excluded from the
 * intersection entirely (soft-fallback — we can't verify them, so we don't let them block a slot).
 */
export async function getTeamBusyIntersection(companyId: string, rangeStartIso: string, rangeEndIso: string): Promise<BusyInterval[]> {
  const members = await prisma.companyMembership.findMany({ where: { company_id: companyId }, select: { user_id: true } });
  const perMemberBusy: BusyInterval[][] = [];
  for (const { user_id } of members) {
    const email = await findFirstGmailAccountForUser(user_id);
    if (!email) continue;
    const token = await getValidGmailAccessToken(user_id, email);
    if (!token.ok) continue;
    perMemberBusy.push(await getBusy(token.accessToken, rangeStartIso, rangeEndIso));
  }
  if (perMemberBusy.length === 0) return []; // nobody's calendar is checkable — never block
  return intersectBusyIntervals(perMemberBusy);
}

/** Company members free at a specific slot (used by claim/auto-assign — a narrower, single-slot version of the above). */
export async function findFreeCompanyMembers(companyId: string, startIso: string, endIso: string): Promise<string[]> {
  const members = await prisma.companyMembership.findMany({ where: { company_id: companyId }, select: { user_id: true } });
  const free: string[] = [];
  for (const { user_id } of members) {
    const email = await findFirstGmailAccountForUser(user_id);
    if (!email) {
      free.push(user_id); // no calendar connected — can't verify, don't exclude (soft-fallback)
      continue;
    }
    const token = await getValidGmailAccessToken(user_id, email);
    if (!token.ok) {
      free.push(user_id);
      continue;
    }
    const busy = await getBusy(token.accessToken, startIso, endIso);
    const overlapsThisSlot = busy.some((b) => new Date(b.start).getTime() < new Date(endIso).getTime() && new Date(b.end).getTime() > new Date(startIso).getTime());
    if (!overlapsThisSlot) free.push(user_id);
  }
  return free;
}
