import { prisma } from "@/lib/prisma";

/** Returns the board if it exists and belongs to the given company, else null. */
export async function findCompanyBoard(companyId: string, boardId: string | string[] | undefined) {
  const id = Array.isArray(boardId) ? boardId[0] : boardId;
  if (!id) return null;
  return prisma.projectBoard.findFirst({ where: { id, company_id: companyId } });
}

type SerializableTask = {
  id: string;
  board_id: string;
  name: string;
  description: string;
  checklist: unknown;
  status: string;
  deadline: Date | null;
  created_at: Date;
  updated_at: Date;
  task_assignments: { user_id: string }[];
};

/** Shapes a ProjectTask row (snake_case Prisma fields + join-table assignments) for the frontend. */
export function serializeTask(task: SerializableTask) {
  return {
    id: task.id,
    boardId: task.board_id,
    name: task.name,
    description: task.description,
    checklist: task.checklist,
    status: task.status,
    assignedTo: task.task_assignments.map((a) => a.user_id),
    deadline: task.deadline,
    createdAt: task.created_at,
    updatedAt: task.updated_at,
  };
}
