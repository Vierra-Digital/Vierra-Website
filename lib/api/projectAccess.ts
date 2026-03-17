import type { NextApiResponse } from "next";
import type { ProjectBoard } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canAccessBoard } from "@/lib/projectBoards";

export const VALID_PROJECT_BOARDS: ProjectBoard[] = ["Design", "Development", "Outreach", "Leadership"];

export function parseProjectBoard(value: string | string[] | undefined): ProjectBoard | null {
  const board = Array.isArray(value) ? value[0] : value;
  if (!board) return null;
  return VALID_PROJECT_BOARDS.includes(board as ProjectBoard) ? (board as ProjectBoard) : null;
}

export async function getSessionPosition(session: { user?: { id?: unknown; email?: unknown; role?: string } }) {
  const role = session.user?.role;
  if (role === "admin") return "Leadership";

  const rawId = session.user?.id;
  if (rawId != null && rawId !== "") {
    const user = await prisma.user.findUnique({
      where: { id: parseInt(String(rawId), 10) },
      select: { position: true },
    });
    return user?.position ?? null;
  }

  const email = typeof session.user?.email === "string" ? session.user.email : null;
  if (!email) return null;
  const user = await prisma.user.findUnique({
    where: { email },
    select: { position: true },
  });
  return user?.position ?? null;
}

export function requireBoardAccessOrRespond403(
  res: NextApiResponse,
  position: string | null,
  board: ProjectBoard,
  message = "You do not have access to this board"
) {
  if (!canAccessBoard(position, board)) {
    res.status(403).json({ message });
    throw new Error("__handled__");
  }
}

