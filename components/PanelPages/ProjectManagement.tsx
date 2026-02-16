"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Inter } from "next/font/google";
import { useSession } from "next-auth/react";
import {
  FiPlus,
  FiTrash2,
  FiCheck,
  FiX,
  FiLayers,
  FiCode,
  FiSend,
  FiAward,
  FiChevronRight,
  FiChevronLeft,
  FiList,
  FiEdit3,
  FiCalendar,
} from "react-icons/fi";
import ProfileImage from "../ProfileImage";

const inter = Inter({ subsets: ["latin"] });

type ProjectBoard = "Design" | "Development" | "Outreach" | "Leadership";
type ProjectTaskStatus = "NotStarted" | "Ongoing" | "UnderReview" | "Completed";

interface ChecklistItem {
  text: string;
  completed: boolean;
}

interface BoardMember {
  id: number;
  name: string | null;
  email: string | null;
  position: string | null;
}

interface ProjectTask {
  id: string;
  board: ProjectBoard;
  name: string;
  description: string;
  checklist: ChecklistItem[] | null;
  status: ProjectTaskStatus;
  assignedTo: number[] | null;
  deadline: string | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_LABELS: Record<ProjectTaskStatus, string> = {
  NotStarted: "Not Started",
  Ongoing: "Ongoing",
  UnderReview: "Under Review",
  Completed: "Completed",
};

const STATUS_COLUMNS: ProjectTaskStatus[] = ["NotStarted", "Ongoing", "UnderReview", "Completed"];

const STATUS_STYLES: Record<
  ProjectTaskStatus,
  { bg: string; headerBg: string; text: string; border: string; accent: string }
> = {
  NotStarted: {
    bg: "bg-gray-50",
    headerBg: "bg-gray-100",
    text: "text-gray-700",
    border: "border-gray-200",
    accent: "bg-gray-500",
  },
  Ongoing: {
    bg: "bg-amber-50",
    headerBg: "bg-amber-100",
    text: "text-amber-800",
    border: "border-amber-200",
    accent: "bg-amber-500",
  },
  UnderReview: {
    bg: "bg-blue-50",
    headerBg: "bg-blue-100",
    text: "text-blue-800",
    border: "border-blue-200",
    accent: "bg-blue-500",
  },
  Completed: {
    bg: "bg-green-50",
    headerBg: "bg-green-100",
    text: "text-green-800",
    border: "border-green-200",
    accent: "bg-green-500",
  },
};

const BOARD_ICONS: Record<ProjectBoard, React.ReactNode> = {
  Design: <FiLayers className="w-4 h-4" />,
  Development: <FiCode className="w-4 h-4" />,
  Outreach: <FiSend className="w-4 h-4" />,
  Leadership: <FiAward className="w-4 h-4" />,
};

function getChecklistProgress(task: ProjectTask): { done: number; total: number } {
  if (!task.checklist || task.checklist.length === 0)
    return { done: 0, total: 0 };
  const done = task.checklist.filter((c) => c.completed).length;
  return { done, total: task.checklist.length };
}

export default function ProjectManagement() {
  const { data: session } = useSession();
  const [boards, setBoards] = useState<ProjectBoard[]>([]);
  const [selectedBoard, setSelectedBoard] = useState<ProjectBoard | null>(null);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<ProjectTask | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<ProjectTask | null>(null);
  const [boardMembers, setBoardMembers] = useState<BoardMember[]>([]);
  const [addStep, setAddStep] = useState(1);
  const [addForm, setAddForm] = useState({
    name: "",
    description: "",
    checklistText: "",
    assignedTo: [] as number[],
    deadline: "",
  });

  const isAdmin = (session?.user as { role?: string })?.role === "admin";

  const fetchBoards = useCallback(async () => {
    try {
      const r = await fetch("/api/project/boards");
      if (r.ok) {
        const d = await r.json();
        const boardList = d.boards || [];
        setBoards(boardList);
        setSelectedBoard((prev) => {
          if (!prev || !boardList.includes(prev)) return boardList[0] || null;
          return prev;
        });
      }
    } catch {
      setBoards([]);
    }
  }, []);

  const fetchTasks = useCallback(async () => {
    if (!selectedBoard) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/project/tasks?board=${selectedBoard}`);
      if (r.ok) {
        const data = await r.json();
        setTasks(data);
      } else {
        setTasks([]);
      }
    } catch {
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [selectedBoard]);

  useEffect(() => {
    fetchBoards();
  }, [fetchBoards]);

  useEffect(() => {
    if (selectedBoard) fetchTasks();
  }, [selectedBoard, fetchTasks]);

  const fetchBoardMembers = useCallback(async () => {
    if (!selectedBoard) return;
    try {
      const r = await fetch(`/api/project/boardMembers?board=${selectedBoard}`);
      if (r.ok) {
        const data = await r.json();
        setBoardMembers(data);
      }
    } catch {
      setBoardMembers([]);
    }
  }, [selectedBoard]);

  useEffect(() => {
    if (selectedBoard) fetchBoardMembers();
  }, [selectedBoard, fetchBoardMembers]);

  const tasksByStatus = STATUS_COLUMNS.reduce(
    (acc, status) => {
      const filtered = tasks.filter((t) => t.status === status);
      acc[status] = [...filtered].sort((a, b) => {
        const aDate = a.deadline ? new Date(a.deadline).getTime() : Infinity;
        const bDate = b.deadline ? new Date(b.deadline).getTime() : Infinity;
        return aDate - bDate;
      });
      return acc;
    },
    {} as Record<ProjectTaskStatus, ProjectTask[]>
  );

  const handleStatusChange = async (taskId: string, newStatus: ProjectTaskStatus) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const { done, total } = getChecklistProgress(task);
    const checklistComplete = total === 0 || done === total;

    if (newStatus === "UnderReview" || newStatus === "Completed") {
      if (!checklistComplete) {
        alert("Complete all checklist items to move the task to under review.");
        return;
      }
    }

    if (newStatus === "Completed") {
      if (task.status !== "UnderReview") {
        alert("Task must be Under Review before it can be marked as Completed.");
        return;
      }
      if (!isAdmin) {
        alert("Only admins can mark tasks as Completed.");
        return;
      }
    }

    try {
      const r = await fetch(`/api/project/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (r.ok) {
        const updated = await r.json();
        setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
        if (selectedTask?.id === taskId) setSelectedTask(updated);
      } else {
        const err = await r.json();
        alert(err.message || "Failed to update status");
      }
    } catch {
      alert("Failed to update status");
    }
  };

  const handleChecklistToggle = async (taskId: string, index: number) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || !task.checklist) return;
    const item = task.checklist[index];
    if (task.status === "Completed" && item?.completed) return;
    const updated = [...task.checklist];
    updated[index] = { ...updated[index], completed: !updated[index].completed };
    try {
      const r = await fetch(`/api/project/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checklist: updated }),
      });
      if (r.ok) {
        const data = await r.json();
        setTasks((prev) => prev.map((t) => (t.id === taskId ? data : t)));
        if (selectedTask?.id === taskId) setSelectedTask(data);
      }
    } catch {
      alert("Failed to update checklist");
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBoard || !addForm.name.trim() || !addForm.description.trim()) return;
    try {
      const checklist = addForm.checklistText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((text) => ({ text, completed: false }));
      const r = await fetch("/api/project/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          board: selectedBoard,
          name: addForm.name.trim(),
          description: addForm.description.trim(),
          checklist: checklist.length ? checklist : null,
          assignedTo: addForm.assignedTo.length ? addForm.assignedTo : undefined,
          deadline: addForm.deadline || undefined,
        }),
      });
      if (r.ok) {
        const task = await r.json();
        setTasks((prev) => [...prev, task]);
        setShowAddModal(false);
        setAddForm({ name: "", description: "", checklistText: "", assignedTo: [], deadline: "" });
        setAddStep(1);
      } else {
        const err = await r.json();
        alert(err.message || "Failed to create task");
      }
    } catch {
      alert("Failed to create task");
    }
  };

  const handleUpdateTask = async (updates: Partial<ProjectTask>) => {
    if (!selectedTask) return;

    if (updates.status !== undefined) {
      const effectiveChecklist = updates.checklist ?? selectedTask.checklist;
      const { done, total } = getChecklistProgress({ ...selectedTask, checklist: effectiveChecklist });
      const checklistComplete = total === 0 || done === total;

      if (updates.status === "UnderReview" || updates.status === "Completed") {
        if (!checklistComplete) {
          alert("Complete all checklist items to move the task to under review.");
          return;
        }
      }

      if (updates.status === "Completed") {
        if (selectedTask.status !== "UnderReview") {
          alert("Task must be Under Review before it can be marked as Completed.");
          return;
        }
        if (!isAdmin) {
          alert("Only admins can mark tasks as Completed.");
          return;
        }
      }
    }

    try {
      const body: Record<string, unknown> = {};
      if (updates.name !== undefined) body.name = updates.name;
      if (updates.description !== undefined) body.description = updates.description;
      if (updates.checklist !== undefined) body.checklist = updates.checklist;
      if (updates.status !== undefined) body.status = updates.status;
      if (updates.assignedTo !== undefined) body.assignedTo = updates.assignedTo;
      if (updates.deadline !== undefined) body.deadline = updates.deadline || null;
      const r = await fetch(`/api/project/tasks/${selectedTask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (r.ok) {
        const task = await r.json();
        setTasks((prev) => prev.map((t) => (t.id === selectedTask.id ? task : t)));
        setSelectedTask(task);
      } else {
        const err = await r.json();
        alert(err.message || "Failed to update task");
      }
    } catch {
      alert("Failed to update task");
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      const r = await fetch(`/api/project/tasks/${taskId}`, { method: "DELETE" });
      if (r.ok) {
        setTasks((prev) => prev.filter((t) => t.id !== taskId));
        if (selectedTask?.id === taskId) setSelectedTask(null);
        setTaskToDelete(null);
      } else {
        const err = await r.json();
        alert(err.message || "Failed to delete task");
      }
    } catch {
      alert("Failed to delete task");
    }
  };

  if (boards.length === 0) {
    return (
      <div className={`w-full h-full bg-white text-[#111014] flex flex-col ${inter.className}`}>
        <div className="flex-1 flex justify-center items-center px-6">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 rounded-2xl bg-[#F8F0FF] flex items-center justify-center mx-auto mb-4">
              <FiLayers className="w-8 h-8 text-[#701CC0]" />
            </div>
            <h3 className="text-lg font-semibold text-[#111827] mb-2">No Boards Assigned</h3>
            <p className="text-sm text-[#6B7280]">
              You don&apos;t have access to any project boards. Contact an administrator to assign your position in Staff Orbital.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full h-full bg-[#FAFAFA] text-[#111014] flex flex-col ${inter.className}`}>
      <div className="flex-1 flex justify-center px-6 pt-2">
        <div className="w-full max-w-6xl flex flex-col h-full">
          <div className="w-full flex justify-between items-center mb-2">
            <div>
              <h1 className="text-2xl font-semibold text-[#111827] mt-6 mb-6">Project Tasks</h1>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {boards.map((board) => (
                <button
                  key={board}
                  onClick={() => setSelectedBoard(board)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                    selectedBoard === board
                      ? "bg-[#701CC0] text-white shadow-sm"
                      : "bg-white text-[#374151] border border-[#E5E7EB] hover:bg-gray-50 hover:border-[#701CC0]"
                  }`}
                >
                  {BOARD_ICONS[board]}
                  {board}
                </button>
              ))}
              {isAdmin && (
                <button
                  onClick={() => setShowAddModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#701CC0] text-white rounded-lg hover:bg-[#5f17a5] text-sm font-medium transition-colors shadow-sm"
                >
                  <FiPlus className="w-4 h-4" />
                  New Task
                </button>
              )}
            </div>
          </div>

          
          <div className="flex-1 overflow-auto pb-6 min-h-0">
            <div className="w-full">
              {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="rounded-xl bg-white border border-[#E5E7EB] shadow-sm overflow-hidden animate-pulse">
                    <div className="h-12 bg-[#F8F0FF] border-b border-[#E5E7EB]" />
                    <div className="p-3 space-y-2">
                      {[1, 2, 3].map((j) => (
                        <div key={j} className="h-14 bg-[#F3F4F6] rounded-lg" />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 min-w-0">
                {STATUS_COLUMNS.map((status) => {
                  const style = STATUS_STYLES[status];
                  const columnTasks = tasksByStatus[status];
                  return (
                    <div
                      key={status}
                      className={`rounded-xl border ${style.border} ${style.bg} shadow-sm min-h-[280px] flex flex-col overflow-hidden`}
                    >
                      <div className={`flex items-center gap-2 px-4 py-3 border-b ${style.border} ${style.headerBg}`}>
                        <div className={`w-1 h-4 rounded-full ${style.accent}`} />
                        <h3 className={`font-semibold text-sm ${style.text}`}>
                          {STATUS_LABELS[status]}
                        </h3>
                        <span className="ml-auto text-xs font-medium text-[#6B7280] bg-white/80 px-2 py-0.5 rounded-md">
                          {columnTasks.length}
                        </span>
                      </div>
                      <div className={`flex-1 p-3 space-y-2 overflow-y-auto min-h-0 ${style.bg}`}>
                        {columnTasks.map((task) => {
                          const { done, total } = getChecklistProgress(task);
                          const assignees = (task.assignedTo || [])
                            .map((id) => boardMembers.find((m) => m.id === id))
                            .filter(Boolean) as BoardMember[];
                          const deadlineStr = task.deadline
                            ? new Date(task.deadline).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })
                            : null;
                          const now = new Date();
                          const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
                          const isPastDeadline =
                            task.status !== "Completed" &&
                            task.deadline &&
                            task.deadline < todayStr;
                          return (
                            <div
                              key={task.id}
                              className={`group relative bg-white rounded-xl overflow-hidden transition-all duration-200 cursor-pointer border border-[#E5E7EB] hover:border-[#701CC0] hover:shadow-md ${
                                isPastDeadline ? "border-l-4 border-l-red-500 bg-red-50/30" : ""
                              }`}
                              onClick={() => setSelectedTask(task)}
                            >
                              {isPastDeadline && (
                                <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-red-100 text-red-800 text-[10px] font-medium uppercase tracking-wide">
                                  Overdue
                                </div>
                              )}
                              <div className="p-3">
                                <div className="flex items-start justify-between gap-2">
                                  <p className={`text-sm font-medium text-[#111827] line-clamp-2 flex-1 pr-8 ${isPastDeadline ? "pt-5" : ""}`}>
                                    {task.name}
                                  </p>
                                  {isAdmin && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setTaskToDelete(task);
                                      }}
                                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1.5 text-[#9CA3AF] hover:text-red-600 hover:bg-red-50 rounded-md transition-all"
                                      aria-label="Delete task"
                                    >
                                      <FiTrash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                                {deadlineStr && (
                                  <div className={`mt-2 flex items-center gap-1.5 text-xs ${isPastDeadline ? "text-red-700" : "text-[#701CC0]"}`}>
                                    <FiCalendar className="w-3.5 h-3.5 flex-shrink-0" />
                                    <span className={task.status === "Completed" ? "line-through" : ""}>{deadlineStr}</span>
                                  </div>
                                )}
                                {assignees.length > 0 && (
                                  <div className="mt-2 flex items-center gap-1.5">
                                    <div className="flex -space-x-1.5">
                                      {assignees.slice(0, 3).map((m) => (
                                        <div
                                          key={m.id}
                                          className="ring-2 ring-white rounded-full"
                                          title={m.name || m.email || ""}
                                        >
                                          <ProfileImage
                                            src={`/api/admin/getUserImage?userId=${m.id}`}
                                            alt={m.name || ""}
                                            name={m.name || m.email || "?"}
                                            size={24}
                                            className="rounded-full"
                                          />
                                        </div>
                                      ))}
                                    </div>
                                    {assignees.length > 3 && (
                                      <span className="text-xs text-[#6B7280]">
                                        +{assignees.length - 3}
                                      </span>
                                    )}
                                  </div>
                                )}
                                {total > 0 && (
                                  <div className="mt-2 flex items-center gap-2">
                                    <div className="flex-1 h-1.5 bg-[#E5E7EB] rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-[#701CC0] rounded-full transition-all"
                                        style={{ width: `${(done / total) * 100}%` }}
                                      />
                                    </div>
                                    <span className="text-xs text-[#701CC0] font-medium">
                                      {done}/{total}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        {columnTasks.length === 0 && (
                          <div className="flex flex-col items-center justify-center py-10 text-center">
                            <div className={`w-10 h-10 rounded-lg ${style.headerBg} border ${style.border} flex items-center justify-center mb-2`}>
                              <FiList className={`w-5 h-5 ${style.text}`} />
                            </div>
                            <p className={`text-xs ${style.text}`}>No Tasks</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              )}
            </div>
          </div>
        </div>
      </div>

      
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          isAdmin={isAdmin}
          boardMembers={boardMembers}
          onClose={() => setSelectedTask(null)}
          onStatusChange={(status) => handleStatusChange(selectedTask.id, status)}
          onChecklistToggle={(index) => handleChecklistToggle(selectedTask.id, index)}
          onDelete={() => setTaskToDelete(selectedTask)}
          onEdit={() => setShowEditModal(true)}
        />
      )}

      
      {showEditModal && selectedTask && isAdmin && (
        <EditTaskModal
          task={selectedTask}
          boardMembers={boardMembers}
          onClose={() => setShowEditModal(false)}
          onSave={(updates) => {
            handleUpdateTask(updates);
            setShowEditModal(false);
          }}
        />
      )}

      
      {taskToDelete && (
        <ConfirmDeleteTaskModal
          taskName={taskToDelete.name}
          onConfirm={() => handleDeleteTask(taskToDelete.id)}
          onCancel={() => setTaskToDelete(null)}
        />
      )}

      
      {showAddModal && selectedBoard && (
        <AddTaskModal
          form={addForm}
          setForm={setAddForm}
          step={addStep}
          setStep={setAddStep}
          boardMembers={boardMembers}
          onSubmit={handleAddTask}
          onClose={() => {
            setShowAddModal(false);
            setAddForm({ name: "", description: "", checklistText: "", assignedTo: [], deadline: "" });
            setAddStep(1);
          }}
        />
      )}
    </div>
  );
}

function ConfirmDeleteTaskModal({
  taskName,
  onConfirm,
  onCancel,
}: {
  taskName: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
            <FiTrash2 className="w-6 h-6 text-red-600" />
          </div>
          <h3 className="text-xl font-semibold text-[#111827]">Delete Task</h3>
        </div>
        <p className="text-sm text-[#6B7280] mb-6">
          Are you sure you want to delete{" "}
          <span className="font-semibold text-[#111827]">&ldquo;{taskName}&rdquo;</span>? This action
          is permanent and cannot be undone.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-[#E5E7EB] text-[#374151] hover:bg-gray-50 text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 text-sm font-medium"
          >
            Delete Task
          </button>
        </div>
      </div>
    </div>
  );
}

function AddTaskModal({
  form,
  setForm,
  step,
  setStep,
  boardMembers,
  onSubmit,
  onClose,
}: {
  form: { name: string; description: string; checklistText: string; assignedTo: number[]; deadline: string };
  setForm: React.Dispatch<React.SetStateAction<{ name: string; description: string; checklistText: string; assignedTo: number[]; deadline: string }>>;
  step: number;
  setStep: (n: number) => void;
  boardMembers: BoardMember[];
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}) {
  const steps = [
    { number: 1, title: "Basic Info" },
    { number: 2, title: "Team & Timeline" },
    { number: 3, title: "Checklist" },
  ];
  const canNext =
    step === 1
      ? form.name.trim() && form.description.trim()
      : step === 2
        ? form.assignedTo.length > 0
        : true;
  const isLastStep = step === 3;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-[#E5E7EB]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-6 py-5 border-b border-[#E5E7EB]">
          <div className="w-10 h-10 rounded-xl bg-[#701CC0]/10 flex items-center justify-center">
            <FiPlus className="w-5 h-5 text-[#701CC0]" />
          </div>
          <h2 className="text-lg font-semibold text-[#111827] flex-1">New Task</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-[#6B7280] hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        
        <div className="px-6 pt-4">
          <div className="flex items-center gap-2">
            {steps.map((s, i) => (
              <React.Fragment key={s.number}>
                <div className="flex items-center gap-2">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                      step >= s.number ? "bg-[#701CC0] text-white" : "bg-[#E5E7EB] text-[#9CA3AF]"
                    }`}
                  >
                    {s.number}
                  </div>
                  <span className={`text-sm ${step >= s.number ? "text-[#701CC0] font-medium" : "text-[#9CA3AF]"}`}>
                    {s.title}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 min-w-[20px] ${step > s.number ? "bg-[#701CC0]" : "bg-[#E5E7EB]"}`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        <form
          className="p-6"
          onSubmit={(e) => e.preventDefault()}
        >
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">Task Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  className="w-full border border-[#E5E7EB] rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#701CC0] focus:border-transparent transition-shadow"
                  placeholder="e.g. Design landing page hero"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  className="w-full border border-[#E5E7EB] rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#701CC0] focus:border-transparent min-h-[100px] resize-none transition-shadow"
                  placeholder="Describe the task..."
                  required
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">Assign</label>
                <div className="max-h-32 overflow-y-auto border border-[#E5E7EB] rounded-xl p-2 space-y-1.5">
                  {boardMembers.length === 0 ? (
                    <p className="text-xs text-[#9CA3AF] py-2">No team members with board access</p>
                  ) : (
                    boardMembers.map((m) => (
                      <label
                        key={m.id}
                        className="flex items-center gap-2 p-2 rounded-lg hover:bg-[#F8F0FF]/50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={form.assignedTo.includes(m.id)}
                          onChange={(e) => {
                            setForm((p) => ({
                              ...p,
                              assignedTo: e.target.checked
                                ? [...p.assignedTo, m.id]
                                : p.assignedTo.filter((id) => id !== m.id),
                            }));
                          }}
                          className="rounded border-[#E5E7EB] text-[#701CC0] focus:ring-[#701CC0]"
                        />
                        <ProfileImage
                          src={`/api/admin/getUserImage?userId=${m.id}`}
                          alt={m.name || ""}
                          name={m.name || m.email || "?"}
                          size={24}
                          className="rounded-full flex-shrink-0"
                        />
                        <span className="text-sm text-[#111827]">
                          {m.name || m.email} {m.position ? `· ${m.position}` : ""}
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">Deadline</label>
                <input
                  type="date"
                  value={form.deadline}
                  onChange={(e) => setForm((p) => ({ ...p, deadline: e.target.value }))}
                  className="w-full border border-[#E5E7EB] rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#701CC0] focus:border-transparent"
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">
                Checklist <span className="text-[#9CA3AF] font-normal">(Optional, One Item Per Line)</span>
              </label>
              <textarea
                value={form.checklistText}
                onChange={(e) => setForm((p) => ({ ...p, checklistText: e.target.value }))}
                className="w-full border border-[#E5E7EB] rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#701CC0] focus:border-transparent min-h-[100px] resize-none transition-shadow placeholder:text-[#9CA3AF]"
                placeholder="Enter subtasks..."
              />
            </div>
          )}
        </form>

        <div className="flex justify-between items-center px-6 pb-6 pt-4 mt-4 border-t border-[#E5E7EB]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 text-sm font-medium transition-colors"
          >
            Cancel
          </button>
          <div className="flex gap-3">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="px-4 py-2.5 border border-[#E5E7EB] rounded-xl text-[#374151] hover:bg-[#F9FAFB] text-sm font-medium transition-colors flex items-center gap-1.5"
              >
                <FiChevronLeft className="w-4 h-4" /> Back
              </button>
            ) : null}
            {isLastStep ? (
              <button
                type="button"
                onClick={() => onSubmit({ preventDefault: () => {} } as React.FormEvent)}
                className="px-4 py-2.5 bg-[#701CC0] text-white rounded-xl hover:bg-[#5f17a5] text-sm font-medium transition-colors shadow-sm"
              >
                Create Task
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStep(step + 1)}
                disabled={!canNext}
                className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  canNext ? "bg-[#701CC0] text-white hover:bg-[#5f17a5] shadow-sm" : "bg-[#E5E7EB] text-[#9CA3AF] cursor-not-allowed"
                }`}
              >
                Next <FiChevronRight className="w-4 h-4 inline ml-1" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TaskDetailModal({
  task,
  isAdmin,
  boardMembers,
  onClose,
  onStatusChange,
  onChecklistToggle,
  onDelete,
  onEdit,
}: {
  task: ProjectTask;
  isAdmin: boolean;
  boardMembers: BoardMember[];
  onClose: () => void;
  onStatusChange: (status: ProjectTaskStatus) => void;
  onChecklistToggle: (index: number) => void;
  onDelete: () => void;
  onEdit: () => void;
}) {
  const { done, total } = getChecklistProgress(task);
  const progressPct = total > 0 ? Math.round((done / total) * 100) : 0;
  const checklistComplete = total === 0 || done === total;
  const canSetCompleted = isAdmin && task.status === "UnderReview" && checklistComplete;
  const canSetUnderReview = checklistComplete;
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const isPastDeadline =
    task.status !== "Completed" && task.deadline && task.deadline < todayStr;
  const assignees = (task.assignedTo || [])
    .map((id) => boardMembers.find((m) => m.id === id))
    .filter(Boolean) as BoardMember[];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-[#E5E7EB] max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        
        <div className="flex-shrink-0 flex items-center gap-3 px-6 py-5 border-b border-[#E5E7EB]">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-[#111827] leading-snug truncate">{task.name}</h2>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span
                className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium ${
                  STATUS_STYLES[task.status].bg
                } ${STATUS_STYLES[task.status].text}`}
              >
                {STATUS_LABELS[task.status]}
              </span>
              {isPastDeadline && (
                <span className="inline-flex px-2 py-0.5 rounded-md bg-red-100 text-red-800 text-xs font-medium">
                  Overdue
                </span>
              )}
              {task.deadline && (
                <span className="inline-flex items-center gap-1 text-xs text-[#6B7280]">
                  <FiCalendar className="w-3.5 h-3.5 text-[#9CA3AF]" />
                  {new Date(task.deadline).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-[#6B7280] hover:bg-red-50 hover:text-red-600 shrink-0 transition-colors"
            aria-label="Close"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          
          {assignees.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {assignees.slice(0, 4).map((m) => (
                  <div
                    key={m.id}
                    className="ring-2 ring-white rounded-full"
                    title={`${m.name || m.email}${m.position ? ` · ${m.position}` : ""}`}
                  >
                    <ProfileImage
                      src={`/api/admin/getUserImage?userId=${m.id}`}
                      alt={m.name || ""}
                      name={m.name || m.email || "?"}
                      size={32}
                      className="rounded-full"
                    />
                  </div>
                ))}
              </div>
              {assignees.length > 4 && (
                <span className="text-xs text-[#6B7280]">+{assignees.length - 4}</span>
              )}
              <span className="text-xs text-[#9CA3AF]">
                {assignees.map((m) => m.name || m.email).join(", ")}
              </span>
            </div>
          )}

          
          <div>
            <span className="text-xs font-medium text-[#6B7280] block mb-2">Description</span>
            <p className="text-sm text-[#374151] leading-relaxed whitespace-pre-wrap">
              {task.description}
            </p>
          </div>

          
          {task.checklist && task.checklist.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-[#6B7280]">Checklist</span>
                <span className="text-xs text-[#9CA3AF]">{done}/{total}</span>
              </div>
              <div className="space-y-1">
                {task.checklist.map((item, i) => {
                  const canUncheck = !(task.status === "Completed" && item.completed);
                  return (
                  <label
                    key={i}
                    className={`flex items-center gap-2.5 py-2 px-2.5 -mx-2.5 rounded-lg transition-colors group ${
                      canUncheck ? "hover:bg-[#F9FAFB] cursor-pointer" : "cursor-default"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        if (canUncheck) onChecklistToggle(i);
                      }}
                      className={`flex-shrink-0 w-4 h-4 rounded flex items-center justify-center transition-all ${
                        item.completed
                          ? "bg-[#701CC0] text-white"
                          : "border border-[#D1D5DB] group-hover:border-[#701CC0]/50"
                      } ${!canUncheck ? "cursor-default opacity-90" : ""}`}
                      aria-label={item.completed ? (canUncheck ? "Mark incomplete" : "Cannot uncheck completed task") : "Mark complete"}
                      disabled={!canUncheck}
                    >
                      {item.completed && <FiCheck className="w-2.5 h-2.5" strokeWidth={3} />}
                    </button>
                    <span
                      className={`text-sm flex-1 ${
                        item.completed ? "text-[#9CA3AF] line-through" : "text-[#374151]"
                      }`}
                    >
                      {item.text}
                    </span>
                  </label>
                  );
                })}
              </div>
              <div className="mt-1.5 h-1.5 bg-[#E5E7EB] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#701CC0] rounded-full transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}

          
          <div>
            <span className="text-xs font-medium text-[#6B7280] block mb-2">Status</span>
            <div className="flex flex-wrap gap-1.5">
              {(["NotStarted", "Ongoing"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => onStatusChange(s)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                    task.status === s
                      ? "bg-[#701CC0] text-white"
                      : "bg-[#F3F4F6] text-[#6B7280] hover:bg-[#E5E7EB]"
                  }`}
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
              <button
                onClick={() => canSetUnderReview && onStatusChange("UnderReview")}
                disabled={!canSetUnderReview}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  task.status === "UnderReview"
                    ? "bg-[#701CC0] text-white"
                    : canSetUnderReview
                      ? "bg-[#F3F4F6] text-[#6B7280] hover:bg-[#E5E7EB]"
                      : "bg-[#F3F4F6] text-[#9CA3AF] cursor-not-allowed opacity-60"
                }`}
                title={!canSetUnderReview ? "Complete all checklist items first" : undefined}
              >
                {STATUS_LABELS.UnderReview}
              </button>
              {isAdmin && (
                <button
                  onClick={() => canSetCompleted && onStatusChange("Completed")}
                  disabled={!canSetCompleted}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                    task.status === "Completed"
                      ? "bg-[#701CC0] text-white"
                      : canSetCompleted
                        ? "bg-[#F3F4F6] text-[#6B7280] hover:bg-[#E5E7EB]"
                        : "bg-[#F3F4F6] text-[#9CA3AF] cursor-not-allowed opacity-60"
                  }`}
                  title={
                    !canSetCompleted
                      ? task.status !== "UnderReview"
                        ? "Task must be Under Review first"
                        : !checklistComplete
                          ? "Complete all checklist items first"
                          : undefined
                      : undefined
                  }
                >
                  Completed
                </button>
              )}
            </div>
            {!checklistComplete && total > 0 && (
              <p className="text-[11px] text-[#9CA3AF] mt-1.5">
                Complete all checklist items to move the task to under review.
              </p>
            )}
          </div>
        </div>

        
        {isAdmin && (
          <div className="flex-shrink-0 px-6 py-4 border-t border-[#E5E7EB] flex gap-3">
            <button
              onClick={onEdit}
              className="flex items-center gap-1.5 text-[#701CC0] hover:text-[#5f17a5] text-sm font-medium"
            >
              <FiEdit3 className="w-4 h-4" />
              Edit
            </button>
            <button
              onClick={onDelete}
              className="flex items-center gap-1.5 text-red-600 hover:text-red-700 text-sm font-medium"
            >
              <FiTrash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function EditTaskModal({
  task,
  boardMembers,
  onClose,
  onSave,
}: {
  task: ProjectTask;
  boardMembers: BoardMember[];
  onClose: () => void;
  onSave: (updates: Partial<ProjectTask>) => void;
}) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState(task.name);
  const [description, setDescription] = useState(task.description);
  const [checklistText, setChecklistText] = useState(
    task.checklist?.map((c) => c.text).join("\n") || ""
  );
  const [status, setStatus] = useState<ProjectTaskStatus>(task.status);
  const [assignedTo, setAssignedTo] = useState<number[]>(task.assignedTo || []);
  const [deadline, setDeadline] = useState(
    task.deadline ? new Date(task.deadline).toISOString().slice(0, 10) : ""
  );

  const steps = [
    { number: 1, title: "Basic Info" },
    { number: 2, title: "Team & Timeline" },
    { number: 3, title: "Checklist" },
  ];
  const canNext =
    step === 1
      ? name.trim() && description.trim()
      : step === 2
        ? assignedTo.length > 0
        : true;
  const isLastStep = step === 3;

  const handleSubmit = () => {
    const existingMap = new Map(
      (task.checklist || []).map((c) => [c.text.trim(), c.completed])
    );
    const mergedChecklist = checklistText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((text) => ({ text, completed: existingMap.get(text) ?? false }));
    onSave({
      name: name.trim(),
      description: description.trim(),
      checklist: mergedChecklist.length ? mergedChecklist : null,
      status,
      assignedTo: assignedTo.length ? assignedTo : null,
      deadline: deadline || null,
    });
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-[#E5E7EB]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-6 py-5 border-b border-[#E5E7EB]">
          <div className="w-10 h-10 rounded-xl bg-[#701CC0]/10 flex items-center justify-center">
            <FiEdit3 className="w-5 h-5 text-[#701CC0]" />
          </div>
          <h2 className="text-lg font-semibold text-[#111827] flex-1">Edit Task</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-[#6B7280] hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        
        <div className="px-6 pt-4">
          <div className="flex items-center gap-2">
            {steps.map((s, i) => (
              <React.Fragment key={s.number}>
                <div className="flex items-center gap-2">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                      step >= s.number ? "bg-[#701CC0] text-white" : "bg-[#E5E7EB] text-[#9CA3AF]"
                    }`}
                  >
                    {s.number}
                  </div>
                  <span className={`text-sm ${step >= s.number ? "text-[#701CC0] font-medium" : "text-[#9CA3AF]"}`}>
                    {s.title}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 min-w-[20px] ${step > s.number ? "bg-[#701CC0]" : "bg-[#E5E7EB]"}`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        <form className="p-6" onSubmit={(e) => e.preventDefault()}>
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">Task Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border border-[#E5E7EB] rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#701CC0] focus:border-transparent transition-shadow"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full border border-[#E5E7EB] rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#701CC0] focus:border-transparent min-h-[100px] resize-none transition-shadow"
                  required
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">Assign</label>
                <div className="max-h-32 overflow-y-auto border border-[#E5E7EB] rounded-xl p-2 space-y-1.5">
                  {boardMembers.map((m) => (
                    <label
                      key={m.id}
                      className="flex items-center gap-2 p-2 rounded-lg hover:bg-[#F8F0FF]/50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={assignedTo.includes(m.id)}
                        onChange={(e) => {
                          setAssignedTo((prev) =>
                            e.target.checked ? [...prev, m.id] : prev.filter((id) => id !== m.id)
                          );
                        }}
                        className="rounded border-[#E5E7EB] text-[#701CC0] focus:ring-[#701CC0]"
                      />
                      <ProfileImage
                        src={`/api/admin/getUserImage?userId=${m.id}`}
                        alt={m.name || ""}
                        name={m.name || m.email || "?"}
                        size={24}
                        className="rounded-full flex-shrink-0"
                      />
                      <span className="text-sm text-[#111827]">
                        {m.name || m.email} {m.position ? `· ${m.position}` : ""}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">Deadline</label>
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full border border-[#E5E7EB] rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#701CC0] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">Status</label>
                <div className="relative">
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ProjectTaskStatus)}
                    className="w-full border border-[#E5E7EB] rounded-xl pl-4 pr-12 py-2.5 text-sm focus:ring-2 focus:ring-[#701CC0] focus:border-transparent appearance-none bg-white"
                  >
                    <option value="NotStarted">Not Started</option>
                    <option value="Ongoing">Ongoing</option>
                    <option value="UnderReview">Under Review</option>
                    <option value="Completed">Completed</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                    <svg className="w-4 h-4 text-[#6B7280]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">
                Checklist <span className="text-[#9CA3AF] font-normal">(Optional, One Item Per Line)</span>
              </label>
              <textarea
                value={checklistText}
                onChange={(e) => setChecklistText(e.target.value)}
                className="w-full border border-[#E5E7EB] rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#701CC0] focus:border-transparent min-h-[100px] resize-none transition-shadow placeholder:text-[#9CA3AF]"
                placeholder="Enter subtasks..."
              />
            </div>
          )}
        </form>

        <div className="flex justify-between items-center px-6 pb-6 pt-4 mt-4 border-t border-[#E5E7EB]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 text-sm font-medium transition-colors"
          >
            Cancel
          </button>
          <div className="flex gap-3">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="px-4 py-2.5 border border-[#E5E7EB] rounded-xl text-[#374151] hover:bg-[#F9FAFB] text-sm font-medium transition-colors flex items-center gap-1.5"
              >
                <FiChevronLeft className="w-4 h-4" /> Back
              </button>
            ) : null}
            {isLastStep ? (
              <button
                type="button"
                onClick={handleSubmit}
                className="px-4 py-2.5 bg-[#701CC0] text-white rounded-xl hover:bg-[#5f17a5] text-sm font-medium transition-colors shadow-sm"
              >
                Save changes
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStep(step + 1)}
                disabled={!canNext}
                className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  canNext ? "bg-[#701CC0] text-white hover:bg-[#5f17a5] shadow-sm" : "bg-[#E5E7EB] text-[#9CA3AF] cursor-not-allowed"
                }`}
              >
                Next <FiChevronRight className="w-4 h-4 inline ml-1" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
