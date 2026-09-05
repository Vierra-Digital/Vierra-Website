import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { FiFilter, FiPlus, FiEdit3, FiTrash2, FiCheck, FiChevronDown } from "react-icons/fi";
import Image from "next/image";
import ProfileImage from "../ProfileImage";
import { inter } from "@/lib/fonts";
import RowActionMenu, { RowActionMenuItem } from "@/components/ui/RowActionMenu";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import ConfirmActionModal from "@/components/ui/ConfirmActionModal";
import Modal from "@/components/ui/Modal";
import {
    PanelBadge,
    PanelButton,
    PanelCard,
    PanelEmptyCell,
    PanelEmptyState,
    PanelHeader,
    PanelPage,
    PanelPagination,
    PanelPopover,
    PanelSearch,
    PanelSelect,
    PanelTable,
    PanelTbody,
    PanelTd,
    PanelTh,
    PanelThead,
    PanelTr,
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
            <RowActionMenuItem onClick={onEdit} icon={<FiEdit3 className="w-4 h-4" />} tone="accent">
                Edit Staff
            </RowActionMenuItem>
            {!isSelf && (
                <RowActionMenuItem onClick={onDelete} icon={<FiTrash2 className="w-4 h-4" />} tone="danger">
                    Remove Staff
                </RowActionMenuItem>
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
            <RowActionMenuItem onClick={onRescind} icon={<FiTrash2 className="w-4 h-4" />} tone="danger">
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
    time_zone: string
    strikes: string
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

    const getActualStatus = () => {
        if (!lastActiveAt) return "offline"

        const lastActive = new Date(lastActiveAt)
        const now = new Date()
        const diffMinutes = (now.getTime() - lastActive.getTime()) / (1000 * 60)
        if (diffMinutes > 30) return "offline"
        if (diffMinutes > 10) return "away"
        return "online"
    }

    const actualStatus = getActualStatus()

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
    const [searchTerm, setSearchTerm] = useState("")
    const [sortBy, setSortBy] = useState<"position" | "timeZone" | "strikes" | "status">("position")
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc")
    const [statusFilter, setStatusFilter] = useState<"all" | "online" | "away" | "offline" | "pending">("all")
    const [isFilterOpen, setIsFilterOpen] = useState(false)
    const filterRef = useRef<HTMLDivElement>(null)
    const pageSize = 10

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
                strikes: u.strikes,
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
                            name: inv.email,
                            email: inv.email,
                            image: null,
                            position: "Invited",
                            country: "—",
                            company_email: null,
                            mentor: null,
                            time_zone: "—",
                            strikes: "—",
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
                    aValue = parseInt(a.strikes?.split("/")[0] || "0")
                    bValue = parseInt(b.strikes?.split("/")[0] || "0")
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

    const columns = useMemo(() => {
        const baseColumns = [
            { key: "name", header: "Name" },
            { key: "position", header: "Position" },
            { key: "time_zone", header: "Time Zone" },
            { key: "mentor", header: "Mentor" },
            { key: "strikes", header: "Strikes" },
            { key: "status", header: "Status" },
        ]
        if (userRole === "admin") {
            baseColumns.push({ key: "manage", header: "Manage" })
        }
        
        return baseColumns
    }, [userRole])

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
    const paginatedRows = filteredRows.slice(page * pageSize, (page + 1) * pageSize)

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
                            <button
                                type="button"
                                onClick={() => {
                                    setSearchTerm("")
                                    setSortBy("position")
                                    setSortOrder("asc")
                                    setStatusFilter("all")
                                    setIsFilterOpen(false)
                                }}
                                className="h-8 w-full rounded-lg border-t border-[#EFECF4] text-[12px] font-medium text-[#6B7280] transition-colors hover:bg-[#FAF9FD] hover:text-[#374151]"
                            >
                                Clear All Filters
                            </button>
                        </PanelPopover>
                    )}
                </div>
                {userRole === "admin" && (
                    <PanelButton variant="primary" onClick={() => setShowAddStaff(true)} icon={<FiPlus className="h-4 w-4" />}>
                        Invite Teammate
                    </PanelButton>
                )}
            </PanelHeader>

            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <LoadingSpinner label="Loading Staff Data..." />
                </div>
            ) : (
                <PanelCard>
                    {filteredRows.length === 0 ? (
                        <PanelEmptyState
                            message={searchTerm ? "No staff match your search." : "You have no staff added."}
                            image={
                                <Image src="/assets/no-client.png" alt="" width={176} height={176} className="h-auto w-44" />
                            }
                        >
                            {userRole === "admin" && !searchTerm && (
                                <PanelButton variant="primary" onClick={() => setShowAddStaff(true)} icon={<FiPlus className="h-4 w-4" />}>
                                    Invite Teammate
                                </PanelButton>
                            )}
                        </PanelEmptyState>
                    ) : (
                        <>
                            <PanelTable>
                                <PanelThead>
                                    {columns.map((column) => (
                                        <PanelTh key={column.key}>{column.header}</PanelTh>
                                    ))}
                                </PanelThead>
                                <PanelTbody>
                                    {paginatedRows.map((r) => (
                                        <PanelTr key={r.id}>
                                            <PanelTd>
                                                <div className="flex items-center gap-3">
                                                    <ProfileImage
                                                        src={r.image ? `/api/admin/getUserImage?userId=${r.id}&v=${r.imageVersion ?? 0}` : null}
                                                        name={r.name}
                                                        size={32}
                                                        alt={`${r.name}'s profile`}
                                                    />
                                                    <div className="min-w-0">
                                                        <div className="truncate font-medium text-[#111827]">{r.name}</div>
                                                        <div className="truncate text-[12px] text-[#6B7280]">{r.email}</div>
                                                    </div>
                                                </div>
                                            </PanelTd>
                                            <PanelTd>
                                                {r.position ? (
                                                    <PanelBadge tone={positionTone(r.position)}>{r.position}</PanelBadge>
                                                ) : (
                                                    <PanelEmptyCell />
                                                )}
                                            </PanelTd>
                                            <PanelTd>{r.time_zone || <PanelEmptyCell />}</PanelTd>
                                            <PanelTd>{r.mentor || <PanelEmptyCell />}</PanelTd>
                                            <PanelTd className="tabular-nums">{r.strikes || "0/3"}</PanelTd>
                                            <PanelTd>
                                                <StatusBadge lastActiveAt={r.lastActiveAt} isPending={r.isPending} />
                                            </PanelTd>
                                            {userRole === "admin" && (
                                                <PanelTd className="relative">
                                                    {r.isPending ? (
                                                        <InviteActionsMenu
                                                            inviteEmail={r.email}
                                                            onRescind={() => handleRescindInvite(r.id, r.email)}
                                                        />
                                                    ) : (
                                                        <StaffActionsMenu
                                                            staffId={r.id}
                                                            staffName={r.name}
                                                            onEdit={() => handleManageStaff(r)}
                                                            onDelete={() => handleDeleteStaff(r.id, r.name)}
                                                            isSelf={r.isSelf}
                                                        />
                                                    )}
                                                </PanelTd>
                                            )}
                                        </PanelTr>
                                    ))}
                                </PanelTbody>
                            </PanelTable>
                            <PanelPagination
                                page={page}
                                pageSize={pageSize}
                                total={filteredRows.length}
                                onPageChange={setCurrentPage}
                            />
                        </>
                    )}
                </PanelCard>
            )}

            {showAddStaff && userRole === "admin" && (
                <InviteTeammateModal
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
                    confirmLabel={deleting ? "Removing…" : "Remove Staff"}
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
                    onCancel={() => {
                        setShowRescindModal(false)
                        setInviteToRescind(null)
                    }}
                    onConfirm={confirmRescindInvite}
                />
            )}
        </PanelPage>
    )
}
const InviteTeammateModal: React.FC<{ onClose: () => void; onCreated: () => void }> = ({ onClose, onCreated }) => {
    const [email, setEmail] = useState("")
    const [role, setRole] = useState<"admin" | "staff">("staff")
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState("")
    const [showSuccess, setShowSuccess] = useState(false)

    const submit = async () => {
        setSubmitting(true)
        setError("")
        try {
            const response = await fetch("/api/admin/invitations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, role }),
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
            cardClassName="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4"
            label="Invite Teammate"
            onClose={onClose}
        >
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-full bg-[#701CC0]/10 flex items-center justify-center">
                        <FiPlus className="w-6 h-6 text-[#701CC0]" />
                    </div>
                    <h3 className="text-xl font-semibold text-[#111827]">Invite Teammate</h3>
            </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#8B8598] mb-1.5">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => {
                                setEmail(e.target.value)
                                if (error) setError("")
                            }}
                            className={`w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#701CC0] focus:border-transparent ${
                                email && !isValidEmail(email) ? 'border-red-500 bg-red-50' : 'border-[#E5E7EB]'
                            }`}
                            placeholder="teammate@company.com"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#8B8598] mb-1.5">Role</label>
                        <select
                            value={role}
                            onChange={(e) => setRole(e.target.value as "admin" | "staff")}
                            className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#701CC0] focus:border-transparent bg-white"
                        >
                            <option value="staff">Staff</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>
                </div>

                {error && <div className="mt-4 text-sm text-red-600">{error}</div>}

                <div className="flex justify-between items-center mt-6">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={submit}
                        disabled={submitting || !isValidEmail(email)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium ${
                            submitting || !isValidEmail(email)
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'bg-[#701CC0] text-white hover:bg-[#5f17a5]'
                        }`}
                    >
                        {submitting ? "Sending..." : "Send Invite"}
                    </button>
                </div>
        </Modal>
    )
}
const ManageStaffModal: React.FC<{
    staff: TeamRow
    onClose: () => void
    onUpdate: (data: Partial<TeamRow>) => void
}> = ({ staff, onClose, onUpdate }) => {
    const [formData, setFormData] = useState({
        name: staff.name || "",
        email: staff.email || "",
        position: staff.position || "",
        country: staff.country || "",
        company_email: staff.company_email || "",
        mentor: staff.mentor || "",
        time_zone: staff.time_zone || "",
        strikes: staff.strikes || "0/3"
    })
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleInputChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    const hasValidEmails = () => {
        const mainEmailValid = formData.email ? isValidEmail(formData.email) : false
        const companyEmailValid = formData.company_email ? isValidEmail(formData.company_email) : true
        return mainEmailValid && companyEmailValid
    }

    const handleSave = async () => {
        setIsSubmitting(true)
        try {
            await onUpdate(formData)
            onClose()
        } catch (error) {
            console.error("Error updating staff:", error)
        } finally {
            setIsSubmitting(false)
        }
    }


    const positionOptions = [
        "Founder",
        "Leadership",
        "Business Advisor",
        "Developer",
        "Designer",
        "Outreach"
    ]

    return (
        <Modal
            zIndexClass="z-50"
            backdropClassName="bg-black/50"
            cardClassName="bg-white rounded-xl p-6 w-full max-w-2xl mx-4"
            label="Edit Staff Member"
            onClose={onClose}
        >
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                        <FiEdit3 className="w-6 h-6 text-blue-600" />
                    </div>
                    <h3 className="text-xl font-semibold text-[#111827]">Edit Staff Member</h3>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                        <label className="block text-sm font-medium text-[#374151] mb-1">Name</label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => handleInputChange('name', e.target.value)}
                            className="w-full px-3 py-2 border border-[#D1D5DB] rounded-md focus:outline-none focus:ring-2 focus:ring-[#701CC0] text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[#374151] mb-1">Email</label>
                        <input
                            type="email"
                            value={formData.email}
                            onChange={(e) => handleInputChange('email', e.target.value)}
                            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#701CC0] text-sm ${
                                formData.email && !isValidEmail(formData.email) 
                                    ? 'border-red-500 bg-red-50' 
                                    : 'border-[#D1D5DB]'
                            }`}
                            required
                            pattern="[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[#374151] mb-1">Position</label>
                        <div className="relative">
                            <select
                                value={formData.position}
                                onChange={(e) => handleInputChange('position', e.target.value)}
                                className="w-full px-3 py-2 border border-[#D1D5DB] rounded-md focus:outline-none focus:ring-2 focus:ring-[#701CC0] text-sm pr-10 appearance-none bg-white"
                            >
                                <option value="">Select Position</option>
                                {positionOptions.map(option => (
                                    <option key={option} value={option}>{option}</option>
                                ))}
                            </select>
                            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                <svg className="w-4 h-4 text-[#6B7280]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[#374151] mb-1">Country</label>
                        <input
                            type="text"
                            value={formData.country}
                            onChange={(e) => handleInputChange('country', e.target.value)}
                            className="w-full px-3 py-2 border border-[#D1D5DB] rounded-md focus:outline-none focus:ring-2 focus:ring-[#701CC0] text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[#374151] mb-1">Timezone</label>
                        <input
                            type="text"
                            value={formData.time_zone}
                            onChange={(e) => handleInputChange('time_zone', e.target.value)}
                            className="w-full px-3 py-2 border border-[#D1D5DB] rounded-md focus:outline-none focus:ring-2 focus:ring-[#701CC0] text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[#374151] mb-1">Company Email</label>
                        <input
                            type="email"
                            value={formData.company_email}
                            onChange={(e) => handleInputChange('company_email', e.target.value)}
                            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#701CC0] text-sm ${
                                formData.company_email && !isValidEmail(formData.company_email) 
                                    ? 'border-red-500 bg-red-50' 
                                    : 'border-[#D1D5DB]'
                            }`}
                            pattern="[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[#374151] mb-1">Mentor</label>
                        <input
                            type="text"
                            value={formData.mentor}
                            onChange={(e) => handleInputChange('mentor', e.target.value)}
                            className="w-full px-3 py-2 border border-[#D1D5DB] rounded-md focus:outline-none focus:ring-2 focus:ring-[#701CC0] text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[#374151] mb-1">Strikes</label>
                        <input
                            type="text"
                            value={formData.strikes}
                            onChange={(e) => handleInputChange('strikes', e.target.value)}
                            className="w-full px-3 py-2 border border-[#D1D5DB] rounded-md focus:outline-none focus:ring-2 focus:ring-[#701CC0] text-sm"
                        />
                    </div>
                </div>
                
                <div className="flex gap-3 justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg border border-[#E5E7EB] text-[#374151] hover:bg-gray-50 text-sm font-medium"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSubmitting || !hasValidEmails()}
                        className={`px-4 py-2 rounded-lg text-sm font-medium ${
                            isSubmitting || !hasValidEmails()
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'bg-[#701CC0] text-white hover:bg-[#5f17a5]'
                        }`}
                    >
                        {isSubmitting ? "Saving..." : "Save Changes"}
                    </button>
                </div>
        </Modal>
    )
}

export default TeamPanelSection;