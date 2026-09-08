import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { FiFilter, FiPlus, FiEdit3, FiTrash2, FiCheck, FiChevronDown, FiX } from "react-icons/fi";
import Image from "next/image";
import ProfileImage from "../ProfileImage";
import { inter } from "@/lib/fonts";
import RowActionMenu, { RowActionMenuDivider, RowActionMenuItem } from "@/components/ui/RowActionMenu";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import ConfirmActionModal from "@/components/ui/ConfirmActionModal";
import Modal from "@/components/ui/Modal";
import { computePresenceStatus } from "@/lib/presence";
import {
    PanelBadge,
    PanelBulkBar,
    PanelButton,
    PanelClearFilters,
    PanelDataTable,
    PanelEmptyCell,
    PanelHeader,
    PanelPage,
    PanelPopover,
    PanelSearch,
    PanelSelect,
} from "@/components/panel/PanelTable";

/** Strict email-shape check shared by the team invite/edit modals below. */
const isValidEmail = (value: string) => /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(value);

const StaffActionsMenu: React.FC<{
    staffId: string
    staffName: string
    onEdit: () => void
    onDelete: () => void
    isSelf?: boolean
}> = ({ staffName, onEdit, onDelete, isSelf }) => {
    return (
        <RowActionMenu label={`Manage ${staffName}`}>
            <RowActionMenuItem onClick={onEdit} icon={<FiEdit3 className="w-4 h-4" />}>
                Edit Staff
            </RowActionMenuItem>
            {!isSelf && (
                <>
                    <RowActionMenuDivider />
                    <RowActionMenuItem onClick={onDelete} icon={<FiTrash2 className="w-4 h-4" />} tone="danger">
                        Remove Staff
                    </RowActionMenuItem>
                </>
            )}
        </RowActionMenu>
    )
}

const InviteActionsMenu: React.FC<{
    inviteEmail: string
    onRescind: () => void
}> = ({ inviteEmail, onRescind }) => {
    return (
        <RowActionMenu label={`Manage invite for ${inviteEmail}`}>
            <RowActionMenuItem onClick={onRescind} icon={<FiTrash2 className="w-4 h-4" />}>
                Rescind Invite
            </RowActionMenuItem>
        </RowActionMenu>
    )
}

interface TeamRow {
    id: string
    name: string
    email: string
    image: any
    imageVersion?: number | string
    position: string
    country: string
    company_email: string | null
    mentor: string | null
    time_zone: string | null
    /**
     * The count, not the "2/3" label. It was typed as a string while the API sends the integer
     * column straight through, so sorting by Strikes called .split on a number and took the whole
     * panel down with it. null means "not applicable" — a pending invite has no strike count.
     */
    strikes: number | null
    status: string
    lastActiveAt: string | null
    isPending?: boolean
    isSelf?: boolean
}

const StatusBadge: React.FC<{ lastActiveAt: string | null; isPending?: boolean }> = ({ lastActiveAt, isPending }) => {
    if (isPending) {
        return (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                Pending
            </span>
        )
    }

    const actualStatus = computePresenceStatus(lastActiveAt)

    const getStatusColor = () => {
        if (actualStatus === "online") return "bg-green-100 text-green-800"
        if (actualStatus === "away") return "bg-yellow-100 text-yellow-800"
        return "bg-gray-100 text-gray-800"
    }

    const getStatusText = () => {
        if (actualStatus === "online") return "Online"
        if (actualStatus === "away") return "Away"
        return "Offline"
    }

    return (
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor()}`}>
            {getStatusText()}
        </span>
    )
}

const TeamPanelSection: React.FC<{ userRole?: string }> = ({ userRole }) => {
    const [rows, setRows] = useState<TeamRow[]>([])
    const [loading, setLoading] = useState(true)
    const [currentPage, setCurrentPage] = useState(0)
    const [showAddStaff, setShowAddStaff] = useState(false)
    const [showManageModal, setShowManageModal] = useState(false)
    const [selectedStaff, setSelectedStaff] = useState<TeamRow | null>(null)
    const [showDeleteModal, setShowDeleteModal] = useState(false)
    const [staffToDelete, setStaffToDelete] = useState<{ id: string; name: string } | null>(null)
    const [deleteError, setDeleteError] = useState("")
    const [deleting, setDeleting] = useState(false)
    const [showRescindModal, setShowRescindModal] = useState(false)
    const [inviteToRescind, setInviteToRescind] = useState<{ id: string; email: string } | null>(null)
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false)
    const [bulkDeleting, setBulkDeleting] = useState(false)
    const [bulkDeleteError, setBulkDeleteError] = useState("")
    const [searchTerm, setSearchTerm] = useState("")
    const [sortBy, setSortBy] = useState<"position" | "timeZone" | "strikes" | "status">("position")
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc")
    const [statusFilter, setStatusFilter] = useState<"all" | "online" | "away" | "offline" | "pending">("all")
    const [isFilterOpen, setIsFilterOpen] = useState(false)
    const filterRef = useRef<HTMLDivElement>(null)
    // Twenty-five a page, the same as User Management — ten meant paging through a team that
    // fits on one screen.
    const pageSize = 25

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
                setIsFilterOpen(false)
            }
        }

        if (isFilterOpen) {
            document.addEventListener('mousedown', handleClickOutside)
            return () => document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [isFilterOpen])

    const handleManageStaff = (staff: TeamRow) => {
        setSelectedStaff(staff)
        setShowManageModal(true)
    }

    const handleDeleteStaff = (staffId: string, staffName: string) => {
        setStaffToDelete({ id: staffId, name: staffName })
        setDeleteError("")
        setShowDeleteModal(true)
    }

    const confirmDeleteStaff = async () => {
        if (!staffToDelete) return

        setDeleting(true)
        setDeleteError("")
        try {
            const response = await fetch(`/api/admin/users`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: staffToDelete.id }),
            })

            if (!response.ok) {
                // The endpoint says exactly why it refused — "Superadmin accounts can't be
                // removed here.", "You cannot remove your own account", "User not found" — and
                // that was being thrown away and replaced with a browser alert reading "Failed
                // to delete staff member. Please try again.", so a deliberate refusal was
                // indistinguishable from a crash and retrying could never help.
                const body = await response.json().catch(() => ({}))
                setDeleteError(body?.message || `Could not remove this member (HTTP ${response.status}).`)
                return
            }
            setRows(prev => prev.filter(r => r.id !== staffToDelete.id))
            setShowDeleteModal(false)
            setStaffToDelete(null)
        } catch {
            setDeleteError("Could not remove this member — the request failed.")
        } finally {
            setDeleting(false)
        }
    }

    const handleRescindInvite = (inviteId: string, inviteEmail: string) => {
        setInviteToRescind({ id: inviteId, email: inviteEmail })
        setShowRescindModal(true)
    }

    const confirmRescindInvite = async () => {
        if (!inviteToRescind) return

        try {
            const response = await fetch(`/api/admin/invitations/${inviteToRescind.id}`, {
                method: "DELETE",
            })

            if (!response.ok) {
                throw new Error("Failed to rescind invite")
            }
            setRows(prev => prev.filter(r => r.id !== inviteToRescind.id))
            setShowRescindModal(false)
            setInviteToRescind(null)
        } catch (error) {
            console.error("Error rescinding invite:", error)
            alert("Failed to rescind invite. Please try again.")
        }
    }

    const toggleRowSelection = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const togglePageSelection = (keys: string[], nextChecked: boolean) => {
        setSelectedIds(prev => {
            const next = new Set(prev)
            for (const key of keys) {
                if (nextChecked) next.add(key)
                else next.delete(key)
            }
            return next
        })
    }

    const clearSelection = () => setSelectedIds(new Set())

    /**
     * A row can't be bulk-removed if it's the signed-in admin's own account — the API refuses
     * that anyway, but surfacing it as "not even checkable" is clearer than a per-row failure
     * buried in the bulk error summary.
     */
    const isRowSelectable = (id: string) => {
        const row = rows.find(r => r.id === id)
        return Boolean(row) && !row?.isSelf
    }

    const handleBulkRemove = async () => {
        if (activeSelectedIds.size === 0 || bulkDeleting) return
        setBulkDeleting(true)
        setBulkDeleteError("")
        const targets = rows.filter(r => activeSelectedIds.has(r.id))
        // Sequential: staff removal and invite rescission both hit admin routes (staff removal
        // also calls out to Supabase Auth), and a bulk removal here is rare enough that one at a
        // time is safer than a burst of concurrent admin calls.
        const failedIds = new Set<string>()
        const failedLabels: string[] = []
        for (const target of targets) {
            try {
                const response = target.isPending
                    ? await fetch(`/api/admin/invitations/${target.id}`, { method: "DELETE" })
                    : await fetch(`/api/admin/users`, {
                          method: "DELETE",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ id: target.id }),
                      })
                if (!response.ok) throw new Error("failed")
            } catch {
                failedIds.add(target.id)
                failedLabels.push(target.name || target.email)
            }
        }
        const removedIds = new Set(targets.filter(t => !failedIds.has(t.id)).map(t => t.id))
        setRows(prev => prev.filter(r => !removedIds.has(r.id)))
        setSelectedIds(new Set())
        if (failedIds.size > 0) {
            setBulkDeleteError(
                failedIds.size === targets.length
                    ? "Could not remove any of the selected rows. Close this dialog and try again."
                    : `Removed ${targets.length - failedIds.size} of ${targets.length}. Failed: ${failedLabels.join(", ")}.`
            )
        } else {
            setBulkDeleteModalOpen(false)
        }
        setBulkDeleting(false)
    }

    const handleUpdateStaff = async (updatedData: Partial<TeamRow>) => {
        if (!selectedStaff) return

        try {
            const response = await fetch(`/api/admin/users`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    id: selectedStaff.id, 
                    ...updatedData 
                }),
            })

            if (!response.ok) {
                throw new Error("Failed to update staff member")
            }
            setRows(prev => prev.map(r => 
                r.id === selectedStaff.id ? { ...r, ...updatedData } : r
            ))
            setShowManageModal(false)
            setSelectedStaff(null)
        } catch (error) {
            console.error("Error updating staff:", error)
            alert("Failed to update staff member. Please try again.")
        }
    }

    const loadTeamData = useCallback(async () => {
        setLoading(true)
        try {
            try {
                await fetch("/api/admin/updateUserStatus", { method: "POST" })
            } catch (e) {
                console.warn("Failed to update user status:", e)
            }
            
            const res = await fetch("/api/admin/users")
            if (!res.ok) throw new Error("Failed to fetch team data")
            const data = await res.json()
            const teamOnly = (data as any[]).filter((u: any) => u.role === "admin" || u.role === "staff")
            const shaped: TeamRow[] = teamOnly.map((u: any) => ({
                id: u.id,
                name: u.name,
                email: u.email,
                image: u.image,
                imageVersion: u.imageVersion,
                position: u.position,
                country: u.country,
                company_email: u.company_email,
                mentor: u.mentor,
                strikes: typeof u.strikes === "number" ? u.strikes : 0,
                time_zone: u.time_zone,
                status: u.status,
                lastActiveAt: u.lastActiveAt,
                isPending: false,
                isSelf: u.isSelf,
            }))

            let pendingRows: TeamRow[] = []
            if (userRole === "admin") {
                try {
                    const invRes = await fetch("/api/admin/invitations")
                    if (invRes.ok) {
                        const invitations = await invRes.json()
                        pendingRows = (invitations as any[]).map((inv: any) => ({
                            id: inv.id,
                            // The invite carries what the inviter filled in, so a pending row reads
                            // like the rest of the table rather than repeating the email twice and
                            // showing a dash where real answers exist. The Pending badge is what
                            // marks it, not a placeholder in every column.
                            name: [inv.first_name, inv.last_name].filter(Boolean).join(" ") || inv.email,
                            email: inv.email,
                            image: null,
                            position: inv.position || "Invited",
                            country: "—",
                            company_email: null,
                            mentor: null,
                            time_zone: inv.time_zone || null,
                            strikes: null,
                            status: "pending",
                            lastActiveAt: null,
                            isPending: true,
                        }))
                    }
                } catch (e) {
                    console.warn("Failed to load pending invitations:", e)
                }
            }

            setRows([...pendingRows, ...shaped])
        } catch (error) {
            console.error("Error loading team data:", error)
        } finally {
        setLoading(false)
        }
    }, [userRole])

    /**
     * The rows the table shows. Derived, not stored.
     *
     * This memo already computed the value; an effect then copied it into state and reset the page,
     * which meant every filter or sort change rendered the old list once before the new one. The
     * page index is clamped below instead of reset, which also covers the case the reset never
     * did: deleting enough rows to leave you past the end used to render an empty table.
     */
    const filteredRows = useMemo(() => {
        const filtered = rows.filter(row => {
            const matchesSearch = !searchTerm || 
                row.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                row.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                row.position?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                row.country?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                row.company_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                row.mentor?.toLowerCase().includes(searchTerm.toLowerCase())
            const matchesStatus = statusFilter === "all" ||
                (statusFilter === "online" && row.status === "online") ||
                (statusFilter === "away" && row.status === "away") ||
                (statusFilter === "offline" && row.status === "offline") ||
                (statusFilter === "pending" && row.status === "pending")

            return matchesSearch && matchesStatus
        })
        filtered.sort((a, b) => {
            let aValue: string | number
            let bValue: string | number

            switch (sortBy) {
                case "position":
                    const positionOrder = {
                        "Founder": 1,
                        "Leadership": 2,
                        "Business Advisor": 3,
                        "Developer": 4,
                        "Designer": 5,
                        "Outreach": 6
                    }
                    aValue = positionOrder[a.position as keyof typeof positionOrder] || 999
                    bValue = positionOrder[b.position as keyof typeof positionOrder] || 999
                    break
                case "timeZone":
                    aValue = a.time_zone || ""
                    bValue = b.time_zone || ""
                    break
                case "strikes":
                    // Rows with no strike count sort last in either direction.
                    aValue = a.strikes ?? -1
                    bValue = b.strikes ?? -1
                    break
                case "status":
                    const statusOrder = { "pending": 0, "online": 1, "away": 2, "offline": 3 }
                    aValue = statusOrder[a.status as keyof typeof statusOrder] || 999
                    bValue = statusOrder[b.status as keyof typeof statusOrder] || 999
                    break
                default:
                    aValue = a.position || ""
                    bValue = b.position || ""
            }

            if (sortOrder === "asc") {
                return aValue < bValue ? -1 : aValue > bValue ? 1 : 0
            } else {
                return aValue > bValue ? -1 : aValue < bValue ? 1 : 0
            }
        })

        return filtered
    }, [rows, searchTerm, sortBy, sortOrder, statusFilter])

    useEffect(() => {
        // Loading the team on mount; the loader flips its own loading state after awaiting.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        loadTeamData()
    }, [loadTeamData])

    // Derived, not synced via an effect: a refetch or a single-row delete can drop ids that are
    // still in selectedIds, and re-deriving here (rather than pruning selectedIds itself in an
    // effect) keeps the bulk bar's count from ever including a row that's already gone.
    const activeSelectedIds = new Set<string>()
    for (const row of rows) {
        if (selectedIds.has(row.id)) activeSelectedIds.add(row.id)
    }

    const positionTone = (position: string) => {
        switch (position) {
            case "Founder":
            case "Leadership":
            case "Business Advisor":
                return "danger" as const
            case "Developer":
                return "info" as const
            case "Designer":
                return "accent" as const
            case "Outreach":
                return "positive" as const
            default:
                return "neutral" as const
        }
    }

    const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize))
    // Clamped rather than reset: a filter that shrinks the list can leave currentPage past the end,
    // and slicing beyond the array renders an empty table with no way to tell why.
    const page = Math.min(currentPage, totalPages - 1)

    return (
        <PanelPage>
            <PanelHeader title="Staff Orbital">
                <PanelSearch
                    id="staff-search"
                    label="Search Staff"
                    placeholder="Search staff"
                    value={searchTerm}
                    onChange={setSearchTerm}
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
                            <h3 className="mb-3 text-[13px] font-semibold text-[#111827]">Sort &amp; Filter</h3>
                            <PanelSelect
                                label="Sort By"
                                value={sortBy}
                                onChange={(value) => setSortBy(value as typeof sortBy)}
                                options={[
                                    { value: "position", label: "Position" },
                                    { value: "timeZone", label: "Time Zone" },
                                    { value: "strikes", label: "Strikes" },
                                    { value: "status", label: "Status" },
                                ]}
                            />
                            <PanelSelect
                                label="Status"
                                value={statusFilter}
                                onChange={(value) => setStatusFilter(value as typeof statusFilter)}
                                options={[
                                    { value: "all", label: "All Status" },
                                    { value: "online", label: "Online" },
                                    { value: "away", label: "Away" },
                                    { value: "offline", label: "Offline" },
                                    { value: "pending", label: "Pending" },
                                ]}
                            />
                            <div className="mb-4">
                                <span className="mb-1.5 block text-[11px] font-medium text-[#6B7280]">Order</span>
                                <div className="flex gap-2">
                                    {(["asc", "desc"] as const).map((dir) => (
                                        <button
                                            key={dir}
                                            type="button"
                                            onClick={() => setSortOrder(dir)}
                                            className={`h-8 flex-1 rounded-lg text-[12px] font-medium transition-colors ${
                                                sortOrder === dir
                                                    ? "bg-[#701CC0] text-white"
                                                    : "bg-[#F3F1F8] text-[#5B5468] hover:bg-[#EAE6F3]"
                                            }`}
                                        >
                                            {dir === "asc" ? "Ascending" : "Descending"}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <PanelClearFilters
                                onClick={() => {
                                    setSearchTerm("")
                                    setSortBy("position")
                                    setSortOrder("asc")
                                    setStatusFilter("all")
                                    setIsFilterOpen(false)
                                }}
                            />
                        </PanelPopover>
                    )}
                </div>
                {userRole === "admin" && (
                    <PanelButton variant="primary" onClick={() => setShowAddStaff(true)} icon={<FiPlus className="h-4 w-4" />}>
                        Invite Staff
                    </PanelButton>
                )}
            </PanelHeader>

            {userRole === "admin" && (
                <PanelBulkBar count={activeSelectedIds.size} onClear={clearSelection} label={(n) => `${n} selected`}>
                    <PanelButton
                        onClick={() => { setBulkDeleteError(""); setBulkDeleteModalOpen(true) }}
                        icon={<FiTrash2 className="h-4 w-4" />}
                    >
                        Remove
                    </PanelButton>
                </PanelBulkBar>
            )}

            <PanelDataTable<TeamRow>
                rows={filteredRows}
                getRowKey={(r) => r.id}
                loading={loading}
                loadingLabel={<LoadingSpinner label="Loading Staff Data..." />}
                page={page}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                emptyTitle="No Staff Found"
                emptyMessage="No staff match your search."
                emptyImage={<Image src="/assets/no-client.png" alt="" width={176} height={176} className="h-auto w-44" priority />}
                selection={
                    userRole === "admin"
                        ? {
                              selectedKeys: activeSelectedIds,
                              onToggleRow: toggleRowSelection,
                              onTogglePage: togglePageSelection,
                              isRowSelectable,
                          }
                        : undefined
                }
                columns={[
                    {
                        key: "name",
                        header: "Name",
                        cell: (r) => (
                            <div className="flex items-center gap-3">
                                <ProfileImage
                                    src={r.image ? `/api/admin/getUserImage?userId=${r.id}&v=${r.imageVersion ?? 0}` : null}
                                    name={r.name}
                                    size={32}
                                    alt={`${r.name}'s profile`}
                                />
                                <div className="min-w-0">
                                    {/* A pending invite has no name, so both lines were the same
                                        address printed twice. Same rule User Management uses: the
                                        address is the line when there is nothing else to put there. */}
                                    <div className="truncate font-medium text-[#111827]">{r.name || r.email}</div>
                                    {r.name && r.email && r.name !== r.email ? (
                                        <div className="truncate text-[12px] text-[#6B7280]">{r.email}</div>
                                    ) : null}
                                </div>
                            </div>
                        ),
                    },
                    {
                        key: "position",
                        header: "Position",
                        cell: (r) => (r.position ? <PanelBadge tone={positionTone(r.position)}>{r.position}</PanelBadge> : <PanelEmptyCell />),
                    },
                    {
                        key: "time_zone",
                        header: "Time Zone",
                        cell: (r) => (r.time_zone ? timeZoneLabel(r.time_zone) : <PanelEmptyCell />),
                    },
                    { key: "mentor", header: "Mentor", cell: (r) => r.mentor || <PanelEmptyCell /> },
                    {
                        key: "strikes",
                        header: "Strikes",
                        className: "tabular-nums",
                        cell: (r) => (r.strikes === null ? <PanelEmptyCell /> : `${r.strikes}/3`),
                    },
                    {
                        key: "status",
                        header: "Status",
                        cell: (r) => <StatusBadge lastActiveAt={r.lastActiveAt} isPending={r.isPending} />,
                    },
                    ...(userRole === "admin"
                        ? [
                              {
                                  key: "manage",
                                  header: "Manage",
                                  className: "relative",
                                  cell: (r: TeamRow) =>
                                      r.isPending ? (
                                          <InviteActionsMenu inviteEmail={r.email} onRescind={() => handleRescindInvite(r.id, r.email)} />
                                      ) : (
                                          <StaffActionsMenu
                                              staffId={r.id}
                                              staffName={r.name}
                                              onEdit={() => handleManageStaff(r)}
                                              onDelete={() => handleDeleteStaff(r.id, r.name)}
                                              isSelf={r.isSelf}
                                          />
                                      ),
                              },
                          ]
                        : []),
                ]}
            />

            {showAddStaff && userRole === "admin" && (
                <InviteTeammateModal
                    mentorOptions={rows
                        .filter((r) => !r.isPending)
                        .map((r) => ({ id: r.id, name: r.name, email: r.email }))}
                    onClose={() => setShowAddStaff(false)}
                    onCreated={() => {
                        setShowAddStaff(false)
                        loadTeamData()
                    }}
                />
            )}

            {showManageModal && selectedStaff && userRole === "admin" && (
                <ManageStaffModal
                    staff={selectedStaff}
                    mentorOptions={rows
                        .filter((r) => !r.isPending)
                        .map((r) => ({ id: r.id, name: r.name, email: r.email }))}
                    onClose={() => {
                        setShowManageModal(false)
                        setSelectedStaff(null)
                    }}
                    onUpdate={handleUpdateStaff}
                />
            )}

            {userRole === "admin" && (
                <ConfirmActionModal
                    isOpen={showDeleteModal}
                    title="Remove Staff Member"
                    message={
                        <>
                            Are you sure you want to remove{" "}
                            <span className="font-semibold text-[#111827]">{staffToDelete?.name || ""}</span>? This action
                            is permanent and cannot be undone. All associated data will be removed.
                            {deleteError && (
                                <span className="mt-3 block rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700">
                                    {deleteError}
                                </span>
                            )}
                        </>
                    }
                    confirmLabel="Remove Staff"
                    // As above: the label changed but the button stayed clickable.
                    busy={deleting}
                    busyLabel="Removing…"
                    onCancel={() => {
                        setShowDeleteModal(false)
                        setStaffToDelete(null)
                        setDeleteError("")
                    }}
                    onConfirm={confirmDeleteStaff}
                />
            )}

            {userRole === "admin" && (
                <ConfirmActionModal
                    isOpen={showRescindModal}
                    title="Rescind Invite"
                    message={
                        <>
                            Are you sure you want to rescind the invite for{" "}
                            <span className="font-semibold text-[#111827]">{inviteToRescind?.email || ""}</span>? They
                            will no longer be able to use this invite to join the team.
                        </>
                    }
                    confirmLabel="Rescind Invite"
                    danger={false}
                    onCancel={() => {
                        setShowRescindModal(false)
                        setInviteToRescind(null)
                    }}
                    onConfirm={confirmRescindInvite}
                />
            )}

            {userRole === "admin" && (
                <ConfirmActionModal
                    isOpen={bulkDeleteModalOpen}
                    title="Remove Selected"
                    message={
                        <>
                            Are you sure you want to remove{" "}
                            <span className="font-semibold text-[#111827]">
                                {activeSelectedIds.size} row{activeSelectedIds.size === 1 ? "" : "s"}
                            </span>
                            ? Staff removal is permanent and cannot be undone; pending invites are rescinded.
                            {bulkDeleteError && (
                                <span className="mt-3 block rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700">
                                    {bulkDeleteError}
                                </span>
                            )}
                        </>
                    }
                    confirmLabel="Remove Selected"
                    busy={bulkDeleting}
                    busyLabel="Removing…"
                    onCancel={() => {
                        if (bulkDeleting) return
                        setBulkDeleteModalOpen(false)
                        setBulkDeleteError("")
                    }}
                    onConfirm={handleBulkRemove}
                />
            )}
        </PanelPage>
    )
}
const FIELD_BASE =
    "h-9 w-full rounded-[10px] px-3 text-[13px] text-[#111827] ring-1 ring-inset transition-shadow focus:outline-none"
const FIELD = `${FIELD_BASE} bg-[#F4F2F8] ring-transparent focus:bg-white focus:ring-[#701CC0]/35`
/** Same field, flagged. Built from the same base rather than rewritten, which is how the colour
 *  went missing the first time. */
const FIELD_INVALID = `${FIELD_BASE} bg-red-50 ring-red-300 focus:ring-red-400`

/** Select in the panel's field styling, with our chevron rather than the platform's. */
const FieldSelect: React.FC<{
    value: string
    onChange: (value: string) => void
    children: React.ReactNode
}> = ({ value, onChange, children }) => (
    <span className="relative block">
        <select value={value} onChange={(e) => onChange(e.target.value)} className={`${FIELD} appearance-none pr-9`}>
            {children}
        </select>
        <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#9CA3AF]" aria-hidden />
    </span>
)

const POSITION_OPTIONS = ["Founder", "Leadership", "Business Advisor", "Developer", "Designer", "Outreach"]

/**
 * The zones a team is plausibly spread across, labelled by city rather than by IANA identifier.
 * The value stored is still the identifier — "America/New_York" is what Date formatting needs —
 * but nobody should have to type it, or remember whether it is New_York or New York.
 */
/**
 * The abbreviation here is a fallback, not the first choice. Where the platform knows a letter
 * code it is derived instead, because the code is not a fixed property of the zone — New York is
 * EST for half the year and EDT for the other half. ICU only carries letter codes for US zones
 * though; everywhere else it answers with a GMT offset, and "Tokyo (JST)" beats "Tokyo (GMT+9)".
 */
const TIME_ZONE_OPTIONS: Array<{ value: string; city: string; abbr: string }> = [
    { value: "Pacific/Honolulu", city: "Honolulu", abbr: "HST" },
    { value: "America/Anchorage", city: "Anchorage", abbr: "AKT" },
    { value: "America/Los_Angeles", city: "Los Angeles", abbr: "PT" },
    { value: "America/Denver", city: "Denver", abbr: "MT" },
    { value: "America/Phoenix", city: "Phoenix", abbr: "MST" },
    { value: "America/Chicago", city: "Chicago", abbr: "CT" },
    { value: "America/New_York", city: "New York", abbr: "ET" },
    { value: "America/Toronto", city: "Toronto", abbr: "ET" },
    { value: "America/Mexico_City", city: "Mexico City", abbr: "CST" },
    { value: "America/Bogota", city: "Bogotá", abbr: "COT" },
    { value: "America/Sao_Paulo", city: "São Paulo", abbr: "BRT" },
    { value: "America/Argentina/Buenos_Aires", city: "Buenos Aires", abbr: "ART" },
    { value: "Europe/London", city: "London", abbr: "GMT/BST" },
    { value: "Europe/Dublin", city: "Dublin", abbr: "GMT/IST" },
    { value: "Europe/Lisbon", city: "Lisbon", abbr: "WET" },
    { value: "Europe/Madrid", city: "Madrid", abbr: "CET" },
    { value: "Europe/Paris", city: "Paris", abbr: "CET" },
    { value: "Europe/Berlin", city: "Berlin", abbr: "CET" },
    { value: "Europe/Warsaw", city: "Warsaw", abbr: "CET" },
    { value: "Europe/Athens", city: "Athens", abbr: "EET" },
    { value: "Europe/Istanbul", city: "Istanbul", abbr: "TRT" },
    { value: "Europe/Moscow", city: "Moscow", abbr: "MSK" },
    { value: "Africa/Lagos", city: "Lagos", abbr: "WAT" },
    { value: "Africa/Johannesburg", city: "Johannesburg", abbr: "SAST" },
    { value: "Africa/Nairobi", city: "Nairobi", abbr: "EAT" },
    { value: "Asia/Dubai", city: "Dubai", abbr: "GST" },
    { value: "Asia/Karachi", city: "Karachi", abbr: "PKT" },
    { value: "Asia/Kolkata", city: "Kolkata", abbr: "IST" },
    { value: "Asia/Dhaka", city: "Dhaka", abbr: "BST" },
    { value: "Asia/Bangkok", city: "Bangkok", abbr: "ICT" },
    { value: "Asia/Singapore", city: "Singapore", abbr: "SGT" },
    { value: "Asia/Manila", city: "Manila", abbr: "PHT" },
    { value: "Asia/Hong_Kong", city: "Hong Kong", abbr: "HKT" },
    { value: "Asia/Shanghai", city: "Shanghai", abbr: "CST" },
    { value: "Asia/Tokyo", city: "Tokyo", abbr: "JST" },
    { value: "Asia/Seoul", city: "Seoul", abbr: "KST" },
    { value: "Australia/Perth", city: "Perth", abbr: "AWST" },
    { value: "Australia/Sydney", city: "Sydney", abbr: "AET" },
    { value: "Pacific/Auckland", city: "Auckland", abbr: "NZT" },
]

/**
 * The zone's abbreviation as of now — "EST" in January, "EDT" in July. Zones with no letter
 * abbreviation come back as a GMT offset ("GMT+5:30"), which is what the platform has to offer
 * and still reads correctly in the label.
 */
const timeZoneAbbreviation = (timeZone: string, now = new Date()) => {
    try {
        return (
            new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" })
                .formatToParts(now)
                .find((part) => part.type === "timeZoneName")?.value ?? ""
        )
    } catch {
        // An unknown or malformed zone throws rather than returning anything useful.
        return ""
    }
}

/**
 * users.name is a single column, and the dialogs ask for the halves separately. Splitting at the
 * first space and rejoining with one round-trips exactly — "Mary Jane Watson" comes back as
 * itself — so nothing is lost by editing through two fields.
 */
const splitName = (full: string) => {
    const trimmed = full.trim().replace(/\s+/g, " ")
    const space = trimmed.indexOf(" ")
    return space === -1
        ? { first: trimmed, last: "" }
        : { first: trimmed.slice(0, space), last: trimmed.slice(space + 1) }
}

/** "America/New_York" reads as "New York (EST)". Falls back to the last path segment. */
const timeZoneLabel = (timeZone: string, now = new Date()) => {
    const option = TIME_ZONE_OPTIONS.find((entry) => entry.value === timeZone)
    const city = option?.city ?? timeZone.split("/").pop()?.replace(/_/g, " ") ?? timeZone
    const derived = timeZoneAbbreviation(timeZone, now)
    // A derived code is preferred only when it is a code. Outside the US the platform answers with
    // an offset like "GMT+5:30", and the curated letters read better than that. Bare "GMT" is
    // excluded with the offsets: London derives it in winter but an offset in summer, so taking it
    // would relabel those zones twice a year.
    const isCode = /^[A-Z]{2,}$/.test(derived) && derived !== "GMT"
    const abbreviation = isCode ? derived : option?.abbr ?? derived
    return abbreviation ? `${city} (${abbreviation})` : city
}


/**
 * Invite dialog, with the staff detail it used to collect before invitations replaced direct
 * account creation: position, mentor, time zone and strikes. None of it can be written to a user
 * that does not exist yet, so it rides on the invitation row and is applied to the membership
 * when the invite is accepted (see lib/auth/resolveUser.ts).
 */
const InviteTeammateModal: React.FC<{
    onClose: () => void
    onCreated: () => void
    mentorOptions: Array<{ id: string; name: string; email: string }>
}> = ({ onClose, onCreated, mentorOptions }) => {
    const [email, setEmail] = useState("")
    const [position, setPosition] = useState("")
    const [mentorId, setMentorId] = useState("")
    const [firstName, setFirstName] = useState("")
    const [lastName, setLastName] = useState("")
    const [timeZone, setTimeZone] = useState("")
    const [strikes, setStrikes] = useState(0)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState("")
    const [showSuccess, setShowSuccess] = useState(false)

    // Everything but the mentor has to be answered. Strikes always holds a value, so it is the
    // name, email, position and time zone that decide whether the invite can go.
    const canSubmit =
        firstName.trim() !== "" &&
        lastName.trim() !== "" &&
        isValidEmail(email) &&
        position !== "" &&
        timeZone !== ""

    const submit = async () => {
        setSubmitting(true)
        setError("")
        try {
            const response = await fetch("/api/admin/invitations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ firstName, lastName, email, position, mentorId, timeZone, strikes }),
            })
            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.message || "Failed to send invite")
            }
            setShowSuccess(true)
        } catch (e: any) {
            setError(e?.message || "Failed to send invite")
        } finally {
            setSubmitting(false)
        }
    }

    if (showSuccess) {
        return (
            <Modal
                zIndexClass="z-[200]"
                backdropClassName="bg-black/50 backdrop-blur-sm"
                cardClassName="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4"
                label="Invite Sent"
                onClose={() => {
                    setShowSuccess(false)
                    onCreated()
                    onClose()
                }}
            >
                    <div className="flex flex-col items-center text-center">
                        <div className="relative mb-4 inline-flex h-16 w-16 items-center justify-center">
                            <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-30 animate-ping" />
                            <span className="relative inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500 text-white">
                                    <FiCheck className="h-6 w-6" />
                                </span>
                            </span>
                        </div>
                        <h3 className="text-xl font-semibold text-[#111827] mb-2">Invite Sent!</h3>
                        <p className={`text-sm text-[#6B7280] mb-6 ${inter.className}`}>
                            {email} will receive an email to set their password and join the team.
                        </p>
                        <button
                            className="w-full rounded-lg px-4 py-2 bg-[#701CC0] text-white hover:bg-[#5f17a5] text-sm font-medium transition-colors"
                            onClick={() => {
                                setShowSuccess(false)
                                onCreated()
                                onClose()
                            }}
                        >
                            Done
                        </button>
                    </div>
            </Modal>
        )
    }

    return (
        <Modal
            zIndexClass="z-50"
            backdropClassName="bg-black/50 backdrop-blur-sm"
            cardClassName="bg-white rounded-2xl shadow-xl p-6 max-w-lg w-full mx-4"
            label="Invite Staff"
            onClose={onClose}
        >
                <header className="mb-5 flex items-center justify-between gap-4">
                    <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-[#111827]">Invite Staff</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="rounded-lg p-2 text-[#6B7280] transition-colors hover:bg-red-50 hover:text-red-600"
                    >
                        <FiX className="h-5 w-5" />
                    </button>
                </header>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                        <label className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#8B8598]">
                            First Name <span className="text-[#B42318]">*</span>
                        </label>
                        <input
                            type="text"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            className={FIELD}
                            placeholder="Bidoof"
                            required
                        />
                    </div>
                    <div>
                        <label className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#8B8598]">
                            Last Name <span className="text-[#B42318]">*</span>
                        </label>
                        <input
                            type="text"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            className={FIELD}
                            placeholder="Sanchez"
                            required
                        />
                    </div>
                    <div className="sm:col-span-2">
                        <label className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#8B8598]">
                            Email <span className="text-[#B42318]">*</span>
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => {
                                setEmail(e.target.value)
                                if (error) setError("")
                            }}
                            className={email && !isValidEmail(email) ? FIELD_INVALID : FIELD}
                            placeholder="name@vierradev.com"
                            required
                        />
                    </div>
                    <div>
                        <label className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#8B8598]">
                            Position <span className="text-[#B42318]">*</span>
                        </label>
                        <FieldSelect value={position} onChange={setPosition}>
                            <option value="">Not set</option>
                            {POSITION_OPTIONS.map((option) => (
                                <option key={option} value={option}>{option}</option>
                            ))}
                        </FieldSelect>
                    </div>
                    <div>
                        {/* A picker, not the free-text box the edit dialog still uses: the column is a
                            uuid foreign key to a user, so a typed name could never have been stored. */}
                        <label className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#8B8598]">
                            Mentor <span className="font-normal normal-case tracking-normal text-[#9CA3AF]">(Optional)</span>
                        </label>
                        <FieldSelect value={mentorId} onChange={setMentorId}>
                            <option value="">None</option>
                            {mentorOptions.map((option) => (
                                <option key={option.id} value={option.id}>{option.name || option.email}</option>
                            ))}
                        </FieldSelect>
                    </div>
                    <div>
                        <label className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#8B8598]">
                            Strikes <span className="text-[#B42318]">*</span>
                        </label>
                        <FieldSelect value={String(strikes)} onChange={(value) => setStrikes(Number(value))}>
                            {[0, 1, 2, 3].map((n) => (
                                <option key={n} value={n}>{n}/3</option>
                            ))}
                        </FieldSelect>
                    </div>
                    <div className="sm:col-span-2">
                        <label className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#8B8598]">
                            Time Zone <span className="text-[#B42318]">*</span>
                        </label>
                        <FieldSelect value={timeZone} onChange={setTimeZone}>
                            <option value="">Select A Time Zone</option>
                            {TIME_ZONE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {timeZoneLabel(option.value)}
                                </option>
                            ))}
                        </FieldSelect>
                    </div>
                </div>

                {error && <div className="mt-4 text-sm text-red-600">{error}</div>}

                <div className="mt-6 flex justify-end gap-2">
                    <button
                        onClick={onClose}
                        className="h-9 rounded-[10px] bg-[#F4F2F8] px-3.5 text-[13px] font-medium text-[#374151] transition-colors hover:bg-[#EAE6F3]"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={submit}
                        disabled={submitting || !canSubmit}
                        className="h-9 rounded-[10px] bg-[#701CC0] px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-[#5f17a5] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {submitting ? "Sending…" : "Send Invite"}
                    </button>
                </div>
        </Modal>
    )
}
/**
 * Edit a staff member.
 *
 * Rebuilt on the same fields as the invite dialog. Two things went with the rebuild: Country and
 * Company Email, which the list stopped showing because the API hardcodes both to null and the
 * PUT accepts neither — the dialog was offering to save what nothing could store. Mentor becomes
 * a picker for the same reason it is one on the invite: the column is a uuid foreign key, so a
 * typed name was never going anywhere.
 */
const ManageStaffModal: React.FC<{
    staff: TeamRow
    mentorOptions: Array<{ id: string; name: string; email: string }>
    onClose: () => void
    onUpdate: (data: Partial<TeamRow>) => void
}> = ({ staff, mentorOptions, onClose, onUpdate }) => {
    const [firstName, setFirstName] = useState(() => splitName(staff.name || "").first)
    const [lastName, setLastName] = useState(() => splitName(staff.name || "").last)
    const [email, setEmail] = useState(staff.email || "")
    const [position, setPosition] = useState(staff.position || "")
    const [mentorId, setMentorId] = useState(staff.mentor || "")
    const [timeZone, setTimeZone] = useState(staff.time_zone || "")
    const [strikes, setStrikes] = useState(staff.strikes ?? 0)
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Same rule as the invite dialog: everything but the mentor has to be answered. An existing
    // member with no position or time zone therefore has to be completed before the edit saves.
    const canSubmit =
        firstName.trim() !== "" &&
        lastName.trim() !== "" &&
        isValidEmail(email) &&
        position !== "" &&
        timeZone !== ""

    const handleSave = async () => {
        setIsSubmitting(true)
        try {
            const name = `${firstName.trim()} ${lastName.trim()}`.trim()
            await onUpdate({ name, email, position, mentor: mentorId || null, time_zone: timeZone || null, strikes })
            onClose()
        } catch (error) {
            console.error("Error updating staff:", error)
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Modal
            zIndexClass="z-50"
            backdropClassName="bg-black/50 backdrop-blur-sm"
            cardClassName="bg-white rounded-2xl shadow-xl p-6 max-w-lg w-full mx-4"
            label="Edit Staff"
            onClose={onClose}
        >
            <header className="mb-5 flex items-center justify-between gap-4">
                <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-[#111827]">Edit Staff</h2>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="rounded-lg p-2 text-[#6B7280] transition-colors hover:bg-red-50 hover:text-red-600"
                >
                    <FiX className="h-5 w-5" />
                </button>
            </header>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                    <label className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#8B8598]">
                        First Name <span className="text-[#B42318]">*</span>
                    </label>
                    <input
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className={FIELD}
                    />
                </div>
                <div>
                    <label className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#8B8598]">
                        Last Name <span className="text-[#B42318]">*</span>
                    </label>
                    <input
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className={FIELD}
                    />
                </div>
                <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#8B8598]">
                        Email <span className="text-[#B42318]">*</span>
                    </label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={email && !isValidEmail(email) ? FIELD_INVALID : FIELD}
                    />
                </div>
                <div>
                    <label className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#8B8598]">
                        Position <span className="text-[#B42318]">*</span>
                    </label>
                    <FieldSelect value={position} onChange={setPosition}>
                        <option value="">Not set</option>
                        {POSITION_OPTIONS.map((option) => (
                            <option key={option} value={option}>{option}</option>
                        ))}
                    </FieldSelect>
                </div>
                <div>
                    <label className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#8B8598]">
                        Mentor <span className="font-normal normal-case tracking-normal text-[#9CA3AF]">(Optional)</span>
                    </label>
                    <FieldSelect value={mentorId} onChange={setMentorId}>
                        <option value="">None</option>
                        {mentorOptions
                            .filter((option) => option.id !== staff.id)
                            .map((option) => (
                                <option key={option.id} value={option.id}>{option.name || option.email}</option>
                            ))}
                    </FieldSelect>
                </div>
                <div>
                    <label className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#8B8598]">
                        Strikes <span className="text-[#B42318]">*</span>
                    </label>
                    <FieldSelect value={String(strikes)} onChange={(value) => setStrikes(Number(value))}>
                        {[0, 1, 2, 3].map((n) => (
                            <option key={n} value={n}>{n}/3</option>
                        ))}
                    </FieldSelect>
                </div>
                <div>
                    <label className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#8B8598]">
                        Time Zone <span className="text-[#B42318]">*</span>
                    </label>
                    <FieldSelect value={timeZone} onChange={setTimeZone}>
                        <option value="">Select A Time Zone</option>
                        {TIME_ZONE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                                {timeZoneLabel(option.value)}
                            </option>
                        ))}
                    </FieldSelect>
                </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
                <button
                    onClick={onClose}
                    className="h-9 rounded-[10px] bg-[#F4F2F8] px-3.5 text-[13px] font-medium text-[#374151] transition-colors hover:bg-[#EAE6F3]"
                >
                    Cancel
                </button>
                <button
                    onClick={handleSave}
                    disabled={isSubmitting || !canSubmit}
                    className="h-9 rounded-[10px] bg-[#701CC0] px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-[#5f17a5] disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {isSubmitting ? "Saving…" : "Save Changes"}
                </button>
            </div>
        </Modal>
    )
}

export default TeamPanelSection;