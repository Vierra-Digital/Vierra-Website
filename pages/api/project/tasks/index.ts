import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { findCompanyBoard, serializeTask } from "@/lib/api/projectAccess";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireRole(req, res, ["admin", "staff"]);
  if (!session) return;

  if (req.method === "GET") {
    const board = await findCompanyBoard(session.companyId, req.query.boardId as string | undefined);
    if (!board) {
      return res.status(400).json({ message: "Invalid or missing boardId" });
    }

    try {
      const tasks = await prisma.projectTask.findMany({
        where: { board_id: board.id, company_id: session.companyId },
        include: { task_assignments: { select: { user_id: true } } },
        orderBy: [{ status: "asc" }, { created_at: "desc" }],
      });
      return res.status(200).json(tasks.map(serializeTask));
    } catch (e) {
      console.error("project/tasks GET", e);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  }

  if (req.method === "POST") {
    if (session.user.role !== "admin") {
      return res.status(403).json({ message: "Only admins can create tasks" });
    }

    const { boardId, name, description, checklist, assignedTo, deadline } = req.body;
    if (!boardId || !name || typeof description !== "string") {
      return res.status(400).json({ message: "boardId, name, and description are required" });
    }
    const board = await findCompanyBoard(session.companyId, boardId);
    if (!board) {
      return res.status(400).json({ message: "Invalid boardId" });
    }

    const assignedIds = Array.isArray(assignedTo)
      ? assignedTo.filter((id: unknown) => typeof id === "string")
      : typeof assignedTo === "string"
        ? [assignedTo]
        : [];

    const deadlineDate = deadline != null && deadline !== "" ? new Date(deadline) : undefined;

    try {
      const task = await prisma.projectTask.create({
        data: {
          company_id: session.companyId,
          board_id: board.id,
          name: String(name).trim(),
          description: String(description).trim(),
          checklist: Array.isArray(checklist) ? checklist : undefined,
          status: "not_started",
          deadline: deadlineDate,
          created_by: session.user.id,
          task_assignments: assignedIds.length
            ? { createMany: { data: assignedIds.map((userId: string) => ({ user_id: userId })) } }
            : undefined,
        },
        include: { task_assignments: { select: { user_id: true } } },
      });
      return res.status(201).json(serializeTask(task));
    } catch (e) {
      console.error("project/tasks POST", e);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  }

  return res.status(405).json({ message: "Method Not Allowed" });
}
