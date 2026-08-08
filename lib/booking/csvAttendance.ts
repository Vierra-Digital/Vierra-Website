import type { AttendanceParticipant } from "@/lib/booking/attendance";

/**
 * Parse a provider's *native* attendance-report CSV export (Zoom's participant report, Teams'
 * attendance list export) — no template we impose on the host (MEETING_TRACKING_QUESTIONS.md
 * §12). Header matching is lenient (case-insensitive substring match) since providers vary
 * their exact column names across report types/versions, but a genuinely unrecognized shape
 * (no email-like column at all) is a hard fail — no preview/mapping UI in v1.
 */

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      cells.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells.map((c) => c.trim());
}

function findColumn(headers: string[], needle: string): number {
  return headers.findIndex((h) => h.toLowerCase().includes(needle));
}

export function parseAttendanceCsv(csvText: string): AttendanceParticipant[] | null {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return null;

  const headers = splitCsvLine(lines[0]);
  const emailCol = findColumn(headers, "email");
  const joinCol = findColumn(headers, "join");
  const leaveCol = findColumn(headers, "leave");
  if (emailCol === -1) return null; // unrecognized shape — hard fail

  const participants: AttendanceParticipant[] = [];
  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line);
    const email = cells[emailCol]?.trim().toLowerCase() || null;
    if (!email) continue;
    const startRaw = joinCol !== -1 ? cells[joinCol] : "";
    const endRaw = leaveCol !== -1 ? cells[leaveCol] : "";
    const startTime = startRaw && !Number.isNaN(new Date(startRaw).getTime()) ? new Date(startRaw).toISOString() : new Date(0).toISOString();
    const endTime = endRaw && !Number.isNaN(new Date(endRaw).getTime()) ? new Date(endRaw).toISOString() : null;
    participants.push({ email, startTime, endTime });
  }
  return participants;
}
