import type { ProjectBoard } from "@prisma/client";

/** Leadership positions can access all boards */
const LEADERSHIP_POSITIONS = ["Leadership", "Founder", "Business Advisor"];

/** Map staff position to allowed board(s). Leadership positions can access all boards. */
const POSITION_TO_BOARDS: Record<string, ProjectBoard[]> = {
  Designer: ["Design"],
  Developer: ["Development"],
  Development: ["Development"],
  Outreach: ["Outreach"],
  Leadership: ["Design", "Development", "Outreach", "Leadership"],
  Founder: ["Design", "Development", "Outreach", "Leadership"],
  "Business Advisor": ["Design", "Development", "Outreach", "Leadership"],
};

export function canAccessBoard(position: string | null, board: ProjectBoard): boolean {
  if (!position) return false;
  const allowed = POSITION_TO_BOARDS[position];
  if (!allowed) return false;
  return allowed.includes(board);
}

export function isLeadership(position: string | null): boolean {
  return position ? LEADERSHIP_POSITIONS.includes(position) : false;
}

export const BOARDS: ProjectBoard[] = ["Design", "Development", "Outreach", "Leadership"];
