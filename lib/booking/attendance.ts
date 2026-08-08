/**
 * Provider-agnostic attendance computation. Each provider's attendance-report client
 * (googleMeet.ts, zoomMeetings.ts, msTeamsMeetings.ts) normalizes to AttendanceParticipant[];
 * this is the one place the "held" rule lives (MEETING_TRACKING_QUESTIONS.md §5): >=5 minutes
 * of overlap AND the invitee's specific email must appear in the participant list — a second
 * unrelated participant sitting in doesn't count on its own.
 */
export type AttendanceParticipant = { email: string | null; startTime: string; endTime: string | null };

const MIN_HELD_SECONDS_DEFAULT = 5 * 60;

function overlapSeconds(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
  const start = Math.max(aStart, bStart);
  const end = Math.min(aEnd, bEnd);
  return Math.max(0, (end - start) / 1000);
}

export function computeAttendance(opts: {
  inviteeEmail: string;
  participants: AttendanceParticipant[];
  meetingStartIso: string;
  meetingEndIso: string;
  minHeldSeconds?: number;
}): { held: boolean; attendeeCount: number; durationSeconds: number } {
  const invitee = opts.inviteeEmail.trim().toLowerCase();
  const windowStart = new Date(opts.meetingStartIso).getTime();
  // Clamp the window end generously (2h past scheduled end) so a session that legitimately ran
  // long still counts, without being unbounded.
  const windowEnd = new Date(opts.meetingEndIso).getTime() + 2 * 60 * 60 * 1000;
  const minHeldSeconds = opts.minHeldSeconds ?? MIN_HELD_SECONDS_DEFAULT;

  const distinctEmails = new Set<string>();
  let inviteeSeconds = 0;
  for (const p of opts.participants) {
    if (p.email) distinctEmails.add(p.email.toLowerCase());
    if (!p.email || p.email.toLowerCase() !== invitee) continue;
    const sessionStart = new Date(p.startTime).getTime();
    const sessionEnd = p.endTime ? new Date(p.endTime).getTime() : windowEnd;
    if (!Number.isFinite(sessionStart)) continue;
    inviteeSeconds += overlapSeconds(sessionStart, sessionEnd, windowStart, windowEnd);
  }

  return {
    held: inviteeSeconds >= minHeldSeconds,
    attendeeCount: distinctEmails.size,
    durationSeconds: Math.round(inviteeSeconds),
  };
}
