import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { getSessionPosition, parseProjectBoard, requireBoardAccessOrRespond403 } from "@/lib/api/projectAccess";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireSession(req, res);
  if (!session) return res.status(401).json({ message: "Not authenticated" });

  const role = (session.user as { role?: string })?.role;
  if (role !== "admin" && role !== "staff") {
    return res.status(403).json({ message: "Forbidden" });
  }

  const position = await getSessionPosition(session);

  if (req.method === "GET") {
    const board = parseProjectBoard(req.query.board);
    if (!board) {
      return res.status(400).json({ message: "Invalid or missing board" });
    }
    requireBoardAccessOrRespond403(res, position, board);

    try {
      const tasks = await prisma.projectTask.findMany({
        where: { board },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      });
      return res.status(200).json(tasks);
    } catch (e) {
      console.error("project/tasks GET", e);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  }

  if (req.method === "POST") {
    if (role !== "admin") {
      return res.status(403).json({ message: "Only admins can create tasks" });
    }

    const { board, name, description, checklist, assignedTo, deadline } = req.body;
    if (!board || !name || typeof description !== "string") {
      return res.status(400).json({ message: "board, name, and description are required" });
    }
    if (!parseProjectBoard(board)) {
      return res.status(400).json({ message: "Invalid board" });
    }

    const assignedIds = Array.isArray(assignedTo)
      ? assignedTo.filter((id: unknown) => typeof id === "number").map(Number)
      : typeof assignedTo === "number"
        ? [assignedTo]
        : undefined;

    const deadlineDate =
      deadline != null && deadline !== ""
        ? new Date(deadline)
        : undefined;

    try {
      const task = await prisma.projectTask.create({
        data: {
          board,
          name: String(name).trim(),
          description: String(description).trim(),
          checklist: Array.isArray(checklist) ? checklist : undefined,
          status: "NotStarted",
          assignedTo: assignedIds?.length ? assignedIds : undefined,
          deadline: deadlineDate,
        },
      });
      return res.status(201).json(task);
    } catch (e) {
      console.error("project/tasks POST", e);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  }

  return res.status(405).json({ message: "Method Not Allowed" });
}
