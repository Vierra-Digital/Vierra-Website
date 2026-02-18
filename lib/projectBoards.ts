import type { ProjectBoard } from "@prisma/client";

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

export const BOARDS: ProjectBoard[] = ["Design", "Development", "Outreach", "Leadership"];
