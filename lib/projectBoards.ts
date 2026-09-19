/**
 * The boards every company starts with.
 *
 * Project Management began with a fixed set (a ProjectBoard enum, see 1070cbc "Completed the project
 * management system") and later became free-form rows, which left a new company with no boards at
 * all and a "New board" box as its entire empty state. These are seeded on first read instead, so
 * the page opens on the four teams the work is actually split between; a company can still add its
 * own, and deleting a default does not bring it back.
 */
export const DEFAULT_BOARD_NAMES = ["Design", "Development", "Outreach", "Leadership"] as const;

/**
 * Which board a position lands on first. The original build used this to gate access outright —
 * a Designer could only open Design — which is more than is wanted here: everyone can see every
 * board, but opening the page on your own team's board saves a click for most of the team.
 */
const POSITION_HOME_BOARD: Record<string, string> = {
  Designer: "Design",
  Developer: "Development",
  Development: "Development",
  Outreach: "Outreach",
  Leadership: "Leadership",
  Founder: "Leadership",
  "Business Advisor": "Leadership",
};

export function homeBoardForPosition(position: string | null | undefined): string | null {
  return position ? POSITION_HOME_BOARD[position] ?? null : null;
}
