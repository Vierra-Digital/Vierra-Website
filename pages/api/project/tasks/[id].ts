import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { canAccessBoard } from "@/lib/projectBoards";
import type { ProjectTaskStatus } from "@prisma/client";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireSession(req, res);
  if (!session) return res.status(401).json({ message: "Not authenticated" });

  const role = (session.user as { role?: string })?.role;
  if (role !== "admin" && role !== "staff") {
    return res.status(403).json({ message: "Forbidden" });
  }

  const id = req.query.id as string;
  if (!id) return res.status(400).json({ message: "Task id required" });

  const userId = (session.user as any)?.id;
  const user = userId
    ? await prisma.user.findUnique({
        where: { id: parseInt(String(userId), 10) },
        select: { position: true },
      })
    : await prisma.user.findUnique({
        where: { email: (session.user as any)?.email },
        select: { position: true },
      });
  const position = user?.position ?? null;

  const existing = await prisma.projectTask.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ message: "Task not found" });

  if (!canAccessBoard(position, existing.board)) {
    return res.status(403).json({ message: "You do not have access to this task's board" });
  }

  if (req.method === "PATCH") {
    const { name, description, checklist, status, assignedTo, deadline } = req.body;

    const updates: Record<string, unknown> = {};
    if (typeof name === "string") updates.name = name.trim();
    if (typeof description === "string") updates.description = description.trim();
    if (Array.isArray(checklist)) {
      if (existing.status === "Completed") {
        const existingItems = (existing.checklist as { text?: string; completed?: boolean }[] | null) ?? [];
        const newItems = checklist as { text?: string; completed?: boolean }[];
        const wouldUncheck = existingItems.some(
          (oldItem) => {
            if (oldItem?.completed !== true) return false;
            const match = newItems.find((n) => (n?.text ?? "").trim() === (oldItem?.text ?? "").trim());
            return match && match.completed === false;
          }
        );
        if (wouldUncheck) {
          return res.status(400).json({ message: "Cannot uncheck checklist items on a completed task" });
        }
      }
      updates.checklist = checklist;
    }

    if (role === "admin") {
      if (assignedTo !== undefined) {
        const ids = Array.isArray(assignedTo)
          ? assignedTo.filter((id: unknown) => typeof id === "number").map(Number)
          : typeof assignedTo === "number"
            ? [assignedTo]
            : [];
        updates.assignedTo = ids.length ? ids : null;
      }
      if (deadline !== undefined) {
        updates.deadline = deadline != null && deadline !== "" ? new Date(deadline) : null;
      }
    }

    if (status !== undefined) {
      const valid: ProjectTaskStatus[] = ["NotStarted", "Ongoing", "UnderReview", "Completed"];
      if (!valid.includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      if (status === "Completed") {
        if (role !== "admin") {
          return res.status(403).json({ message: "Only admins can mark a task as Completed" });
        }
        if (existing.status !== "UnderReview") {
          return res.status(400).json({ message: "Task must be Under Review before it can be marked as Completed" });
        }
      }
      if (status === "UnderReview" || status === "Completed") {
        const items = Array.isArray(checklist) ? checklist : (existing.checklist as unknown[] | null) ?? [];
        if (items.length > 0) {
          const allComplete = items.every((item: { completed?: boolean }) => item?.completed === true);
          if (!allComplete) {
            return res.status(400).json({ message: "Complete all checklist items to move the task to under review" });
          }
        }
      }
      updates.status = status;
    }

    try {
      const task = await prisma.projectTask.update({
        where: { id },
        data: updates,
      });
      return res.status(200).json(task);
    } catch (e) {
      console.error("project/tasks PATCH", e);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  }

  if (req.method === "DELETE") {
    if (role !== "admin") {
      return res.status(403).json({ message: "Only admins can delete tasks" });
    }
    try {
      await prisma.projectTask.delete({ where: { id } });
      return res.status(200).json({ success: true });
    } catch (e) {
      console.error("project/tasks DELETE", e);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  }

  return res.status(405).json({ message: "Method Not Allowed" });
}
