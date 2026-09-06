"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { inter } from "@/lib/fonts";
import {
  PanelButton,
  PanelCard,
  PanelClearFilters,
  PanelBadge,
  PanelHeader,
  PanelPage,
  PanelStat,
  PanelPopover,
  PanelSearch,
  PanelSelect,
} from "@/components/panel/PanelTable";
import { useSession } from "@/lib/session-client";
import {
  FiPlus,
  FiFilter,
  FiChevronDown,
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
import Modal from "@/components/ui/Modal";
import { useDraftGuard } from "@/hooks/useDraftGuard";
import { useRouter } from "next/router";
import { panelFetch } from "@/lib/panelFetch";
import { PANEL_FIELD, PanelFieldLabel, PanelModalHeader } from "@/components/ui/PanelForm";


type ProjectTaskStatus = "not_started" | "ongoing" | "under_review" | "completed";

interface ChecklistItem {
  text: string;
  completed: boolean;
}

interface BoardInfo {
  id: string;
  name: string;
}

interface BoardMember {
  id: string;
  name: string | null;
  email: string | null;
  position: string | null;
  image: boolean;
}

interface ProjectTask {
  id: string;
  boardId: string;
  name: string;
  description: string;
  checklist: ChecklistItem[] | null;
  status: ProjectTaskStatus;
  assignedTo: string[] | null;
  deadline: string | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_LABELS: Record<ProjectTaskStatus, string> = {
  not_started: "Not Started",
  ongoing: "Ongoing",
  under_review: "Under Review",
  completed: "Completed",
};

const STATUS_COLUMNS: ProjectTaskStatus[] = ["not_started", "ongoing", "under_review", "completed"];

/**
 * A dot per column, not a tint.
 *
 * Each column used to be a tub of its own colour — grey, amber, blue, green backgrounds with
 * matching borders and headers — so the board read as four different surfaces before it read as
 * four stages of one thing, and none of them matched the cards on any other page. The colour is
 * now one dot beside the heading, which is all it was ever carrying.
 */
const STATUS_DOTS: Record<ProjectTaskStatus, string> = {
  not_started: "bg-[#9CA3AF]",
  ongoing: "bg-[#F59E0B]",
  under_review: "bg-[#3B82F6]",
  completed: "bg-[#10B981]",
};

/** Boards are now company-owned, free-form rows — no fixed enum to key icons off of. */
function boardIcon(name: string): React.ReactNode {
  const lower = name.toLowerCase();
  if (lower.includes("design")) return <FiLayers className="w-4 h-4" />;
  if (lower.includes("dev")) return <FiCode className="w-4 h-4" />;
  if (lower.includes("outreach") || lower.includes("sales")) return <FiSend className="w-4 h-4" />;
  if (lower.includes("lead")) return <FiAward className="w-4 h-4" />;
  return <FiList className="w-4 h-4" />;
}

function getChecklistProgress(task: ProjectTask): { done: number; total: number } {
  if (!task.checklist || task.checklist.length === 0)
    return { done: 0, total: 0 };
  const done = task.checklist.filter((c) => c.completed).length;
  return { done, total: task.checklist.length };
}

export default function ProjectManagement() {
  const { data: session } = useSession();
  const [boards, setBoards] = useState<BoardInfo[]>([]);
  const [selectedBoard, setSelectedBoard] = useState<BoardInfo | null>(null);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<ProjectTask | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<ProjectTask | null>(null);
  const [boardMembers, setBoardMembers] = useState<BoardMember[]>([]);
  const [addForm, setAddForm] = useState({
    name: "",
    description: "",
    checklistText: "",
    assignedTo: [] as string[],
    deadline: "",
  });

  const router = useRouter();
  const [actionError, setActionError] = useState("");
  const [taskSearch, setTaskSearch] = useState("");
  const [taskFilter, setTaskFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [taskBusy, setTaskBusy] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setIsFilterOpen(false);
      }
    };
    if (isFilterOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isFilterOpen]);
  const busyRef = useRef(false);
  const canLeave = useDraftGuard(showAddModal && Boolean(addForm.name || addForm.description || addForm.checklistText || addForm.deadline || addForm.assignedTo.length), "New task", "6", taskBusy);
  const isAdmin = (session?.user as { role?: string })?.role === "admin";

  const fetchBoards = useCallback(async () => {
    try {
      const r = await panelFetch("/api/project/boards");
      if (r.ok) {
        const boardList: BoardInfo[] = await r.json();
        setBoards(boardList);
        setSelectedBoard((prev) => {
          if (!prev || !boardList.some((b) => b.id === prev.id)) return boardList.find(b => b.id === new URLSearchParams(window.location.search).get("board")) || boardList[0] || null;
          return prev;
        });
      }
    } catch {
      setActionError("Could not load boards. Try again.");
    }
  }, []);


  const fetchTasks = useCallback(async () => {
    if (!selectedBoard) return;
    setLoading(true);
    try {
      const r = await panelFetch(`/api/project/tasks?boardId=${selectedBoard.id}`);
      if (r.ok) {
        const data = await r.json();
        setTasks(data);
      } else {
        setActionError("Could not load tasks. Refresh this board to retry.");
      }
    } catch {
      setActionError("Could not load tasks. Refresh this board to retry.");
    } finally {
      setLoading(false);
    }
  }, [selectedBoard]);

  useEffect(() => {
    // Loading the board list on mount; the fetch flips its own loading and error state after
    // awaiting, which is what an effect is for.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchBoards();
  }, [fetchBoards]);

  useEffect(() => {
    // Tasks belong to the selected board, so they are re-fetched when the selection changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (selectedBoard) fetchTasks();
  }, [selectedBoard, fetchTasks]);

  const fetchBoardMembers = useCallback(async () => {
    try {
      const r = await fetch("/api/project/boardMembers");
      if (r.ok) {
        const data = await r.json();
        setBoardMembers(data);
      }
    } catch {
      setBoardMembers([]);
    }
  }, []);

  useEffect(() => {
    // Assignable members are the same for every board, so this loads once on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchBoardMembers();
  }, [fetchBoardMembers]);

  const tasksByStatus = STATUS_COLUMNS.reduce(
    (acc, status) => {
      const filtered = tasks.filter((t) => t.status === status &&
        (!taskSearch || (t.name + " " + t.description).toLowerCase().includes(taskSearch.toLowerCase())) &&
        (taskFilter !== "mine" || t.assignedTo?.includes(session?.user?.id || "")) &&
        (taskFilter !== "review" || t.status === "under_review") &&
        (!assigneeFilter || t.assignedTo?.includes(assigneeFilter)));
      acc[status] = [...filtered].sort((a, b) => {
        const aDate = a.deadline ? new Date(a.deadline).getTime() : Infinity;
        const bDate = b.deadline ? new Date(b.deadline).getTime() : Infinity;
        return aDate - bDate;
      });
      return acc;
    },
    {} as Record<ProjectTaskStatus, ProjectTask[]>
  );

  const visibleTasks = STATUS_COLUMNS.flatMap((status) => tasksByStatus[status]);
  const overdueCount = visibleTasks.filter(
    (t) => t.status !== "completed" && t.deadline && new Date(t.deadline).getTime() < now.getTime()
  ).length;

  const handleStatusChange = async (taskId: string, newStatus: ProjectTaskStatus) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const { done, total } = getChecklistProgress(task);
    const checklistComplete = total === 0 || done === total;

    if (newStatus === "under_review" || newStatus === "completed") {
      if (!checklistComplete) {
        setActionError("Complete all checklist items to move the task to under review.");
        return;
      }
    }

    if (newStatus === "completed") {
      if (task.status !== "under_review") {
        setActionError("Task must be Under Review before it can be marked as Completed.");
        return;
      }
      if (!isAdmin) {
        setActionError("Only admins can mark tasks as Completed.");
        return;
      }
    }

    if (busyRef.current) return;
    busyRef.current = true;
    setTaskBusy(true);
    setActionError("");
    try {
      const r = await fetch(`/api/project/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, expectedUpdatedAt: task.updatedAt }),
      });
      if (r.ok) {
        const updated = await r.json();
        setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
        if (selectedTask?.id === taskId) setSelectedTask(updated);
      } else {
        const err = await r.json();
        setActionError(err.message || "Failed to update status");
      }
    } catch {
      setActionError("Failed to update status");
    } finally { busyRef.current = false; setTaskBusy(false); }
  };

  const handleChecklistToggle = async (taskId: string, index: number) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || !task.checklist) return;
    const item = task.checklist[index];
    if (task.status === "completed" && item?.completed) return;
    const updated = [...task.checklist];
    updated[index] = { ...updated[index], completed: !updated[index].completed };
    if (busyRef.current) return;
    busyRef.current = true;
    setTaskBusy(true);
    setActionError("");
    try {
      const r = await fetch(`/api/project/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checklist: updated, expectedUpdatedAt: task.updatedAt }),
      });
      if (r.ok) {
        const data = await r.json();
        setTasks((prev) => prev.map((t) => (t.id === taskId ? data : t)));
        if (selectedTask?.id === taskId) setSelectedTask(data);
      }
    } catch {
      setActionError("Failed to update checklist");
    } finally { busyRef.current = false; setTaskBusy(false); }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBoard || !addForm.name.trim() || !addForm.description.trim()) return;
    if (busyRef.current) return;
    busyRef.current = true;
    setTaskBusy(true);
    setActionError("");
    try {
      const checklist = addForm.checklistText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((text) => ({ text, completed: false }));
      const r = await panelFetch("/api/project/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          boardId: selectedBoard.id,
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
      } else {
        const err = await r.json();
        setActionError(err.message || "Failed to create task");
      }
    } catch {
      setActionError("Failed to create task");
    } finally { busyRef.current = false; setTaskBusy(false); }
  };

  const handleUpdateTask = async (updates: Partial<ProjectTask>) => {
    if (!selectedTask) return;

    if (updates.status !== undefined) {
      const effectiveChecklist = updates.checklist ?? selectedTask.checklist;
      const { done, total } = getChecklistProgress({ ...selectedTask, checklist: effectiveChecklist });
      const checklistComplete = total === 0 || done === total;

      if (updates.status === "under_review" || updates.status === "completed") {
        if (!checklistComplete) {
          setActionError("Complete all checklist items to move the task to under review.");
          return;
        }
      }

      if (updates.status === "completed") {
        if (selectedTask.status !== "under_review") {
          setActionError("Task must be Under Review before it can be marked as Completed.");
          return;
        }
        if (!isAdmin) {
          setActionError("Only admins can mark tasks as Completed.");
          return;
        }
      }
    }

    if (busyRef.current) return;
    busyRef.current = true;
    setTaskBusy(true);
    setActionError("");
    try {
      const body: Record<string, unknown> = { expectedUpdatedAt: selectedTask.updatedAt };
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
        setShowEditModal(false);
      } else {
        const err = await r.json();
        setActionError(err.message || "Failed to update task");
      }
    } catch {
      setActionError("Failed to update task");
    } finally { busyRef.current = false; setTaskBusy(false); }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setTaskBusy(true);
    setActionError("");
    try {
      const r = await fetch(`/api/project/tasks/${taskId}`, { method: "DELETE" });
      if (r.ok) {
        setTasks((prev) => prev.filter((t) => t.id !== taskId));
        if (selectedTask?.id === taskId) setSelectedTask(null);
        setTaskToDelete(null);
      } else {
        const err = await r.json();
        setActionError(err.message || "Failed to delete task");
      }
    } catch {
      setActionError("Failed to delete task");
    } finally { busyRef.current = false; setTaskBusy(false); }
  };

  if (boards.length === 0) {
    return (
      <div className={inter.className}>
        <PanelPage>
          <PanelHeader title="Project Management" />
          <PanelCard>
          <div className="mx-auto max-w-md px-6 py-14 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#F8F0FF] flex items-center justify-center mx-auto mb-4">
              <FiLayers className="w-8 h-8 text-[#701CC0]" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-[#111827]">
              {actionError ? "Could not load boards" : "No Boards Yet"}
            </h3>
            {actionError ? (
              <p role="alert" className="text-[13px] text-[#B42318]">
                {actionError}{" "}
                <button type="button" onClick={() => void fetchBoards()} className="font-medium underline underline-offset-2">
                  Retry
                </button>
              </p>
            ) : (
              // The four defaults are created on the first read of this company's boards, so
              // landing here at all means that read failed rather than that none exist.
              <p className="text-[13px] text-[#6B7280]">Reload to set up this company&apos;s boards.</p>
            )}
          </div>
          </PanelCard>
        </PanelPage>
      </div>
    );
  }

  return (
    <div className={inter.className}>
      <PanelPage>
          <PanelHeader title="Project Management">
            <>
              <PanelSearch
                id="task-search"
                label="Search Tasks"
                placeholder="Search tasks"
                value={taskSearch}
                onChange={setTaskSearch}
              />
              <div className="relative" ref={filterRef}>
                <PanelButton
                  onClick={() => setIsFilterOpen(!isFilterOpen)}
                  icon={<FiFilter className="h-4 w-4" />}
                >
                  Filter
                  <FiChevronDown className={`h-3.5 w-3.5 transition-transform ${isFilterOpen ? "rotate-180" : ""}`} />
                </PanelButton>
                {isFilterOpen && (
                  <PanelPopover>
                    <h3 className="mb-3 text-[13px] font-semibold text-[#111827]">Filter</h3>
                    <PanelSelect
                      label="Tasks"
                      value={taskFilter}
                      onChange={setTaskFilter}
                      options={[
                        { value: "all", label: "All Tasks" },
                        { value: "mine", label: "My Tasks" },
                        { value: "review", label: "Needs Review" },
                      ]}
                    />
                    <PanelSelect
                      label="Assignee"
                      value={assigneeFilter}
                      onChange={setAssigneeFilter}
                      options={[
                        { value: "", label: "All Assignees" },
                        ...boardMembers.map((member) => ({
                          value: member.id,
                          label: member.name || member.email || "Unnamed",
                        })),
                      ]}
                    />
                    <PanelClearFilters
                      onClick={() => {
                        setTaskSearch("");
                        setTaskFilter("all");
                        setAssigneeFilter("");
                        setIsFilterOpen(false);
                      }}
                    />
                  </PanelPopover>
                )}
              </div>
              {boards.map((board) => (
                <button
                  key={board.id}
                  onClick={() => {
                    void (async () => {
                      if (!(await canLeave())) return;
                      setTasks([]);
                      setSelectedBoard(board);
                      void router
                        .replace(
                          { pathname: router.pathname, query: { ...router.query, board: board.id } },
                          undefined,
                          { shallow: true, scroll: false }
                        )
                        .catch(() => {});
                    })();
                  }}
                  className={`inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-lg px-3.5 text-[13px] font-medium transition-colors ${
                    selectedBoard?.id === board.id
                      ? "bg-[#701CC0] text-white shadow-sm"
                      : "border border-[#E4E0EC] bg-white text-[#374151] hover:border-[#D6CFE4] hover:bg-[#FAF9FD]"
                  }`}
                >
                  {boardIcon(board.name)}
                  {board.name}
                </button>
              ))}
              {isAdmin && (
                <button
                  onClick={() => setShowAddModal(true)}
                  className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#701CC0] px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-[#5f17a5]"
                >
                  <FiPlus className="w-4 h-4" />
                  New Task
                </button>
              )}
            </>
          </PanelHeader>

          {/* Board actions used to fail silently — a rejected status move or a save that lost a
              concurrency check left the card where it was with no explanation. */}
          {actionError && (
            <p role="alert" className="mb-3 flex flex-wrap items-center gap-2 text-[13px] text-[#B42318]">
              {actionError}
              <button
                type="button"
                onClick={() => void fetchTasks()}
                className="rounded font-medium underline underline-offset-2 hover:text-[#8f1c12]"
              >
                Refresh board
              </button>
            </p>
          )}
          <p role="status" className="sr-only">
            {taskBusy ? "Saving" : ""}
          </p>

          {/* Totals first, then the board — the order the dashboard and the tracker read in. */}
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <PanelStat label="Tasks" value={visibleTasks.length} />
            <PanelStat label="In Progress" value={tasksByStatus.ongoing.length} />
            <PanelStat label="Awaiting Review" value={tasksByStatus.under_review.length} />
            <PanelStat
              label="Overdue"
              value={overdueCount}
              hint={overdueCount === 0 ? "Nothing late" : "Past their deadline"}
            />
          </div>

          <div className="flex-1 min-h-0">
            <div className="w-full">
              {loading ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="overflow-hidden rounded-2xl border border-[#E4E0EC] bg-white">
                    <div className="h-[46px] border-b border-[#EEF1F7] bg-[#FBFCFF]" />
                    <div className="space-y-2 bg-[#FBFAFD] p-3">
                      {[1, 2, 3].map((j) => (
                        <div key={j} className="h-14 animate-pulse rounded-xl bg-[#F1EFF6]" />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                {STATUS_COLUMNS.map((status) => {
                  const columnTasks = tasksByStatus[status];
                  return (
                    <div
                      key={status}
                      className="flex min-h-[280px] flex-col overflow-hidden rounded-2xl border border-[#E4E0EC] bg-white"
                    >
                      <div className="flex items-center gap-2 border-b border-[#EEF1F7] bg-[#FBFCFF] px-4 py-3">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOTS[status]}`} />
                        <h3 className="text-[13px] font-semibold text-[#111827]">{STATUS_LABELS[status]}</h3>
                        <span className="ml-auto rounded-full bg-[#F1EFF6] px-2 py-0.5 text-[11.5px] font-medium tabular-nums text-[#5B5468]">
                          {columnTasks.length}
                        </span>
                      </div>
                      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-[#FBFAFD] p-3">
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
                          const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
                          const isPastDeadline =
                            task.status !== "completed" &&
                            task.deadline &&
                            task.deadline < todayStr;
                          return (
                            <div
                              key={task.id}
                              className="group relative cursor-pointer overflow-hidden rounded-xl border border-[#E4E0EC] bg-white transition-colors hover:border-[#D6CFE4]"
                              onClick={() => setSelectedTask(task)}
                            >
                              <div className="p-3">
                                <div className="flex items-start justify-between gap-2">
                                  {/* Overdue used to be an absolutely-placed chip in the corner,
                                      which meant the title had to be padded down out of its way on
                                      exactly those cards. It sits with the date it refers to now. */}
                                  <p className="line-clamp-2 flex-1 pr-8 text-[13px] font-medium text-[#111827]">
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
                                  <div className={`mt-2 flex flex-wrap items-center gap-1.5 text-[12px] ${isPastDeadline ? "text-[#B42318]" : "text-[#6B7280]"}`}>
                                    <FiCalendar className="h-3.5 w-3.5 flex-shrink-0" />
                                    <span className={task.status === "completed" ? "line-through" : ""}>{deadlineStr}</span>
                                    {isPastDeadline && (
                                      <span className="rounded-full bg-[#FDECEC] px-2 py-0.5 text-[11px] font-medium text-[#B42318]">
                                        Overdue
                                      </span>
                                    )}
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
                                            src={m.image ? `/api/admin/getUserImage?userId=${m.id}` : null}
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
                            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-[#F1EFF6]">
                              <FiList className="h-5 w-5 text-[#8B8598]" />
                            </div>
                            <p className="text-[12px] text-[#8B8598]">Nothing here</p>
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
      </PanelPage>

      
      {selectedTask && (
        <TaskDetailModal
          feedback={actionError}
          busy={taskBusy}
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
          feedback={actionError}
          busy={taskBusy}
          task={selectedTask}
          boardMembers={boardMembers}
          onClose={() => setShowEditModal(false)}
          onSave={handleUpdateTask}
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
          feedback={actionError}
          busy={taskBusy}
          form={addForm}
          setForm={setAddForm}
          boardMembers={boardMembers}
          onSubmit={handleAddTask}
          onClose={() => { void (async () => {
            if (!(await canLeave())) return;
            setShowAddModal(false);
            setAddForm({ name: "", description: "", checklistText: "", assignedTo: [], deadline: "" });
          })(); }}
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
    <Modal
      onClose={onCancel}
      zIndexClass="z-[70]"
      backdropClassName="bg-black/50 backdrop-blur-sm"
      cardClassName="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4"
      closeOnBackdrop={true}
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
    </Modal>
  );
}

/**
 * One screen, in the same shape as Invite Staff and Add Client.
 *
 * This was a three-step wizard over five fields, two of them optional — so the step you were on
 * told you less than the form would have if it had simply been shown.
 */
function AddTaskModal({
  feedback,
  busy,
  form,
  setForm,
  boardMembers,
  onSubmit,
  onClose,
}: {
  feedback: string;
  busy: boolean;
  form: { name: string; description: string; checklistText: string; assignedTo: string[]; deadline: string };
  setForm: React.Dispatch<React.SetStateAction<{ name: string; description: string; checklistText: string; assignedTo: string[]; deadline: string }>>;
  boardMembers: BoardMember[];
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}) {
  const canSubmit = form.name.trim() !== "" && !busy;

  return (
    <Modal
      zIndexClass="z-50"
      backdropClassName="bg-black/50 backdrop-blur-sm"
      cardClassName="bg-white rounded-2xl shadow-xl p-6 max-w-lg w-full mx-4"
      label="New Task"
      onClose={onClose}
    >
      <PanelModalHeader title="New Task" onClose={onClose} />

      <form onSubmit={onSubmit}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <PanelFieldLabel required>Task Name</PanelFieldLabel>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className={PANEL_FIELD}
              placeholder="Rebuild the pricing page"
              required
            />
          </div>

          <div className="sm:col-span-2">
            <PanelFieldLabel>Description</PanelFieldLabel>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className={`${PANEL_FIELD} min-h-[88px] resize-none py-2`}
              placeholder="What needs doing, and what done looks like"
            />
          </div>

          <div>
            <PanelFieldLabel>Deadline</PanelFieldLabel>
            <input
              type="date"
              value={form.deadline}
              onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
              className={PANEL_FIELD}
            />
          </div>

          <div>
            <PanelFieldLabel hint="Optional">Assign</PanelFieldLabel>
            <div className="max-h-[132px] space-y-1 overflow-y-auto rounded-[10px] bg-[#F4F2F8] p-1.5">
              {boardMembers.length === 0 ? (
                <p className="px-2 py-2 text-[12px] text-[#8B8598]">Nobody has access to this board.</p>
              ) : (
                boardMembers.map((member) => {
                  const checked = form.assignedTo.includes(member.id);
                  return (
                    <label
                      key={member.id}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-white"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setForm((f) => ({
                            ...f,
                            assignedTo: checked
                              ? f.assignedTo.filter((id) => id !== member.id)
                              : [...f.assignedTo, member.id],
                          }))
                        }
                        className="rounded border-[#D6CFE4] text-[#701CC0] focus:ring-[#701CC0]"
                      />
                      <ProfileImage
                        src={member.image ? `/api/admin/getUserImage?userId=${member.id}` : null}
                        alt={member.name || ""}
                        name={member.name || member.email || "?"}
                        size={20}
                        className="rounded-full"
                      />
                      <span className="truncate text-[12.5px] text-[#111827]">
                        {member.name || member.email}
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          <div className="sm:col-span-2">
            <PanelFieldLabel hint="Optional, one item per line">Checklist</PanelFieldLabel>
            <textarea
              value={form.checklistText}
              onChange={(e) => setForm((f) => ({ ...f, checklistText: e.target.value }))}
              className={`${PANEL_FIELD} min-h-[88px] resize-none py-2`}
              placeholder={"Draft copy\nReview with design\nShip"}
            />
          </div>
        </div>

        {feedback && !busy && <p className="mt-4 text-[13px] text-[#B42318]">{feedback}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-[10px] bg-[#F4F2F8] px-3.5 text-[13px] font-medium text-[#374151] transition-colors hover:bg-[#EAE6F3]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="h-9 rounded-[10px] bg-[#701CC0] px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-[#5f17a5] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Creating…" : "Create Task"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function TaskDetailModal({
  feedback,
  busy,
  task,
  isAdmin,
  boardMembers,
  onClose,
  onStatusChange,
  onChecklistToggle,
  onDelete,
  onEdit,
}: {
  feedback: string;
  busy: boolean;
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
  const canSetCompleted = isAdmin && task.status === "under_review" && checklistComplete;
  const canSetUnderReview = checklistComplete;
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const isPastDeadline =
    task.status !== "completed" && task.deadline && task.deadline < todayStr;
  const assignees = (task.assignedTo || [])
    .map((id) => boardMembers.find((m) => m.id === id))
    .filter(Boolean) as BoardMember[];

  return (
    <Modal
      onClose={() => { if (!busy) onClose(); }}
      zIndexClass="z-50"
      backdropClassName="bg-black/40 backdrop-blur-sm"
      cardClassName="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-[#E5E7EB] max-h-[90vh] overflow-hidden flex flex-col"
      closeOnBackdrop={!busy}
    >
      <div role="status" className="px-6 pt-3 text-sm text-red-700">{busy ? "Saving…" : feedback}</div>

        <div className="flex-shrink-0 flex items-center gap-3 px-6 py-5 border-b border-[#E5E7EB]">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-[#111827] leading-snug truncate">{task.name}</h2>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <PanelBadge icon={<span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOTS[task.status]}`} />}>
                {STATUS_LABELS[task.status]}
              </PanelBadge>
              {isPastDeadline && (
                <PanelBadge tone="danger">
                  Overdue
                </PanelBadge>
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
                      src={m.image ? `/api/admin/getUserImage?userId=${m.id}` : null}
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
                  const canUncheck = !(task.status === "completed" && item.completed);
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
              {(["not_started", "ongoing"] as const).map((s) => (
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
                onClick={() => canSetUnderReview && onStatusChange("under_review")}
                disabled={!canSetUnderReview}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  task.status === "under_review"
                    ? "bg-[#701CC0] text-white"
                    : canSetUnderReview
                      ? "bg-[#F3F4F6] text-[#6B7280] hover:bg-[#E5E7EB]"
                      : "bg-[#F3F4F6] text-[#9CA3AF] cursor-not-allowed opacity-60"
                }`}
                title={!canSetUnderReview ? "Complete all checklist items first" : undefined}
              >
                {STATUS_LABELS.under_review}
              </button>
              {isAdmin && (
                <button
                  onClick={() => canSetCompleted && onStatusChange("completed")}
                  disabled={!canSetCompleted}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                    task.status === "completed"
                      ? "bg-[#701CC0] text-white"
                      : canSetCompleted
                        ? "bg-[#F3F4F6] text-[#6B7280] hover:bg-[#E5E7EB]"
                        : "bg-[#F3F4F6] text-[#9CA3AF] cursor-not-allowed opacity-60"
                  }`}
                  title={
                    !canSetCompleted
                      ? task.status !== "under_review"
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
    </Modal>
  );
}

function EditTaskModal({
  feedback,
  busy,
  task,
  boardMembers,
  onClose,
  onSave,
}: {
  feedback: string;
  busy: boolean;
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
  const [assignedTo, setAssignedTo] = useState<string[]>(task.assignedTo || []);
  const [deadline, setDeadline] = useState(
    task.deadline ? new Date(task.deadline).toISOString().slice(0, 10) : ""
  );

  const [initial] = useState(() => JSON.stringify({ name, description, checklistText, status, assignedTo, deadline }));
  const canClose = useDraftGuard(JSON.stringify({ name, description, checklistText, status, assignedTo, deadline }) !== initial, "Edit task", "6", busy);
  const closeEditor = () => {
    if (busy) return;
    void (async () => { if (await canClose()) onClose(); })();
  };
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
    <Modal
      onClose={closeEditor}
      zIndexClass="z-[60]"
      backdropClassName="bg-black/40 backdrop-blur-sm"
      cardClassName="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-[#E5E7EB]"
      closeOnBackdrop={!busy}
    >
      <div role="status" className="px-6 pt-3 text-sm text-red-700">{busy ? "Saving…" : feedback}</div>
        <div className="flex items-center gap-3 px-6 py-5 border-b border-[#E5E7EB]">
          <div className="w-10 h-10 rounded-xl bg-[#701CC0]/10 flex items-center justify-center">
            <FiEdit3 className="w-5 h-5 text-[#701CC0]" />
          </div>
          <h2 className="text-lg font-semibold text-[#111827] flex-1">Edit Task</h2>
          <button
            onClick={closeEditor}
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
                        src={m.image ? `/api/admin/getUserImage?userId=${m.id}` : null}
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
                    <option value="not_started">Not Started</option>
                    <option value="ongoing">Ongoing</option>
                    <option value="under_review">Under Review</option>
                    <option value="completed">Completed</option>
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
            onClick={closeEditor}
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
    </Modal>
  );
}
