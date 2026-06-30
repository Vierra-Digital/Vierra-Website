import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { serializeTask } from "@/lib/api/projectAccess";

const VALID_STATUSES = ["not_started", "ongoing", "under_review", "completed"];

export default withAuth(async (req, res, session) => {
  const id = req.query.id as string;
  if (!id) return res.status(400).json({ message: "Task id required" });

  const existing = await prisma.projectTask.findFirst({
    where: { id, company_id: session.companyId },
    include: { task_assignments: { select: { user_id: true } } },
  });
  if (!existing) return res.status(404).json({ message: "Task not found" });

  if (req.method === "PATCH") {
    const { name, description, checklist, status, assignedTo, deadline } = req.body;

    const updates: Record<string, unknown> = {};
    if (typeof name === "string") updates.name = name.trim();
    if (typeof description === "string") updates.description = description.trim();
    if (Array.isArray(checklist)) {
      if (existing.status === "completed") {
        const existingItems = (existing.checklist as { text?: string; completed?: boolean }[] | null) ?? [];
        const newItems = checklist as { text?: string; completed?: boolean }[];
        const wouldUncheck = existingItems.some((oldItem) => {
          if (oldItem?.completed !== true) return false;
          const match = newItems.find((n) => (n?.text ?? "").trim() === (oldItem?.text ?? "").trim());
          return match && match.completed === false;
        });
        if (wouldUncheck) {
          return res.status(400).json({ message: "Cannot uncheck checklist items on a completed task" });
        }
      }
      updates.checklist = checklist;
    }

    let assignmentIds: string[] | null = null;
    if (session.user.role === "admin") {
      if (assignedTo !== undefined) {
        assignmentIds = Array.isArray(assignedTo)
          ? assignedTo.filter((aid: unknown) => typeof aid === "string")
          : typeof assignedTo === "string"
            ? [assignedTo]
            : [];
      }
      if (deadline !== undefined) {
        updates.deadline = deadline != null && deadline !== "" ? new Date(deadline) : null;
      }
    }

    if (status !== undefined) {
      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      if (status === "completed") {
        if (session.user.role !== "admin") {
          return res.status(403).json({ message: "Only admins can mark a task as completed" });
        }
        if (existing.status !== "under_review") {
          return res.status(400).json({ message: "Task must be under review before it can be marked as completed" });
        }
      }
      if (status === "under_review" || status === "completed") {
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
      if (assignmentIds !== null) {
        const currentIds = existing.task_assignments.map((a) => a.user_id);
        const toAdd = assignmentIds.filter((aid) => !currentIds.includes(aid));
        const toRemove = currentIds.filter((aid) => !assignmentIds!.includes(aid));
        if (toRemove.length) {
          await prisma.taskAssignment.deleteMany({ where: { task_id: id, user_id: { in: toRemove } } });
        }
        if (toAdd.length) {
          await prisma.taskAssignment.createMany({ data: toAdd.map((userId) => ({ task_id: id, user_id: userId })) });
        }
      }
      const task = await prisma.projectTask.update({
        where: { id },
        data: updates,
        include: { task_assignments: { select: { user_id: true } } },
      });
      return res.status(200).json(serializeTask(task));
    } catch (e) {
      console.error("project/tasks PATCH", e);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  }

  if (req.method === "DELETE") {
    if (session.user.role !== "admin") {
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

  res.setHeader("Allow", ["PATCH", "DELETE"]);
  return res.status(405).json({ message: "Method Not Allowed" });
}, { methods: ["PATCH", "DELETE"], roles: ["admin", "staff"] });
