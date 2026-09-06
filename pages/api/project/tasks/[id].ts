import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { serializeTask } from "@/lib/api/projectAccess";

const VALID_STATUSES = ["not_started", "ongoing", "under_review", "completed"];

export default withAuth(async (req, res, session) => {
  const id = req.query.id as string;
  if (!id) return res.status(400).json({ message: "Task id required" });

  // Any Vierra staff member may act on any client's task (see
  // docs/ROLE_MODEL_REDESIGN.md's "v2" section) — looked up by id alone.
  const existing = await prisma.projectTask.findFirst({
    where: { id },
    include: { task_assignments: { select: { user_id: true } } },
  });
  if (!existing) return res.status(404).json({ message: "Task not found" });

  if (req.method === "PATCH") {
    const { name, description, checklist, status, assignedTo, deadline, expectedUpdatedAt } = req.body;
    if (expectedUpdatedAt !== undefined && (typeof expectedUpdatedAt !== "string" || !Number.isFinite(Date.parse(expectedUpdatedAt)))) return res.status(400).json({ message: "Invalid task revision." });
    if (expectedUpdatedAt && new Date(expectedUpdatedAt).getTime() !== existing.updated_at.getTime()) return res.status(409).json({ message: "This task changed since you opened it. Your edits are kept; reopen the latest task before saving." });

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
      const task = await prisma.$transaction(async (tx) => {
      // Compare and lock the row before changing assignments. Both changes roll back
      // together when another writer won the race after our initial read.
      await tx.projectTask.update({
        where: { id, updated_at: existing.updated_at },
        data: { ...updates, updated_at: new Date() },
      });
      if (assignmentIds !== null) {
        const currentIds = existing.task_assignments.map((a) => a.user_id);
        const toAdd = assignmentIds.filter((aid) => !currentIds.includes(aid));
        const toRemove = currentIds.filter((aid) => !assignmentIds!.includes(aid));
        if (toRemove.length) {
          await tx.taskAssignment.deleteMany({ where: { task_id: id, user_id: { in: toRemove } } });
        }
        if (toAdd.length) {
          await tx.taskAssignment.createMany({ data: toAdd.map((userId) => ({ task_id: id, user_id: userId })) });
        }
      }
      return tx.projectTask.findUniqueOrThrow({
        where: { id },
        include: { task_assignments: { select: { user_id: true } } },
      });
      });
      return res.status(200).json(serializeTask(task));
    } catch (e) {
      if (e && typeof e === "object" && "code" in e && e.code === "P2025") return res.status(409).json({ message: "This task was changed by someone else. Reopen it to review the latest version." });
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
