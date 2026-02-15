import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { canAccessBoard } from "@/lib/projectBoards";
import type { ProjectBoard } from "@prisma/client";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireSession(req, res);
  if (!session) return res.status(401).json({ message: "Not authenticated" });

  const role = (session.user as { role?: string })?.role;
  if (role !== "admin" && role !== "staff") {
    return res.status(403).json({ message: "Forbidden" });
  }

  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const board = req.query.board as ProjectBoard | undefined;
  if (!board || !["Design", "Development", "Outreach", "Leadership"].includes(board)) {
    return res.status(400).json({ message: "Invalid or missing board" });
  }

  try {
    const users = await prisma.user.findMany({
      where: {
        OR: [{ role: "admin" }, { role: "staff" }],
      },
      select: {
        id: true,
        name: true,
        email: true,
        position: true,
        role: true,
      },
    });

    const members = users.filter((u) => {
      if (u.role === "admin") return true;
      const pos = u.position ?? null;
      return canAccessBoard(pos, board);
    });

    return res.status(200).json(members);
  } catch (e) {
    console.error("project/boardMembers GET", e);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}
