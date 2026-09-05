"use client"

import React, { useCallback, useEffect, useMemo, useState, useRef } from "react"
import {
    ChevronDown,
    Filter,
    KeyRound,
    Link as LinkIcon,
    Plus,
    RefreshCw,
    RotateCw,
    Trash2,
    UserCog,
    X,
    XCircle,
} from "lucide-react"
import { FiCheck, FiPlus, FiTrash2 } from "react-icons/fi"
import { inter } from "@/lib/fonts";
import Image from "next/image"
import ConfirmActionModal from "@/components/ui/ConfirmActionModal"
import RowActionMenu, { RowActionMenuDivider, RowActionMenuItem, RowActionMenuLabel } from "@/components/ui/RowActionMenu"
import Modal from "@/components/ui/Modal"
import LoadingSpinner from "@/components/ui/LoadingSpinner"
import ProfileImage from "@/components/ProfileImage"
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
} from "@/components/panel/PanelTable"

type ListedUser = {
    id: string
    name: string | null
    email: string | null
    image: boolean
    role: string
    clientName: string | null
    companyName: string | null
    imageVersion?: number | string
    isPlatformAdmin?: boolean
    isSelf?: boolean
    hasAccount?: boolean
}

type SessionStatus = "pending" | "in_progress" | "completed" | "expired" | "canceled"

type SessionRow = {
    token: string
    clientName: string
    clientEmail: string
    businessName: string
    createdAt: number
    submittedAt: number | null
    lastUpdatedAt: number | null
    status: SessionStatus
    hasAnswers: boolean
    platforms?: string[]
}

/** A user with the session that belongs to them, if any. See UsersPanel's `rows` for the join. */
type MergedRow = ListedUser & { session: SessionRow | null; isSessionOnly: boolean }

const SESSION_LABELS: Record<SessionStatus, string> = {
    pending: "Not Started",
    in_progress: "In Progress",
    completed: "Completed",
    expired: "Expired",
    canceled: "Canceled",
}

const SESSION_TONES: Record<SessionStatus, "warning" | "info" | "positive" | "danger" | "neutral"> = {
    pending: "warning",
    in_progress: "info",
    completed: "positive",
    expired: "danger",
    canceled: "neutral",
}

/** Sort order for the Session column: earliest in the funnel first, dead sessions last. */
const SESSION_ORDER: Record<SessionStatus, number> = {
    pending: 1,
    in_progress: 2,
    completed: 3,
    expired: 4,
    canceled: 5,
}

type RoleKey = "admin" | "staff" | "client"

/** The API stores a client's role as either "user" or "client"; the table only ever shows one. */
const normalizeRole = (role: string): RoleKey =>
    role === "admin" ? "admin" : role === "staff" ? "staff" : "client"

const ROLE_LABELS: Record<RoleKey, string> = { admin: "Admin", staff: "Staff", client: "Client" }
const ROLE_TONES: Record<RoleKey, "accent" | "info" | "neutral"> = {
    admin: "accent",
    staff: "info",
    client: "neutral",
}
const ROLE_CHOICES: Array<{ value: RoleKey; label: string }> = [
    { value: "admin", label: "Admin" },
    { value: "staff", label: "Staff" },
    { value: "client", label: "Client" },
]

const AdminEditorSection = () => <UsersPanel />

export default AdminEditorSection

/**
 * One page, not two.
 *
 * Sessions used to be a second full-screen view behind a "Manage Sessions" button, with its own
 * search, its own filter, its own table and its own pagination — a duplicate of this page listing
 * the same people by a different key. A session belongs to a client, and a client is a row here,
 * so the session is now a column and its actions live in that row's menu. The sweep that expires
 * stale sessions moves to the toolbar, where the rest of the page-level actions already are.
 */
function UsersPanel() {
    const [users, setUsers] = useState<ListedUser[]>([])
    const [sessions, setSessions] = useState<SessionRow[]>([])
    const [loading, setLoading] = useState<boolean>(false)
    const [error, setError] = useState<string>("")
    const [showCreate, setShowCreate] = useState<boolean>(false)
    const [resetSending, setResetSending] = useState<Record<string, boolean>>({})
    const [deleteModalOpen, setDeleteModalOpen] = useState<boolean>(false)
    const [userToDelete, setUserToDelete] = useState<{ id: string; name: string | null; email: string | null } | null>(null)
    const [searchQuery, setSearchQuery] = useState<string>("")
    const [currentPage, setCurrentPage] = useState<number>(0)
    const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "staff" | "user">("all")
    const [sessionFilter, setSessionFilter] = useState<"all" | "none" | SessionStatus>("all")
    const [sortBy, setSortBy] = useState<"name" | "email" | "role" | "session">("role")
    const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")
    const [isFilterOpen, setIsFilterOpen] = useState<boolean>(false)
    const [notice, setNotice] = useState<string>("")

    // Session-side state, carried over wholesale from the view this page absorbed.
    const [expiring, setExpiring] = useState<boolean>(false)
    const [showUpdateSessionsModal, setShowUpdateSessionsModal] = useState<boolean>(false)
    const [updateSessionsSuccess, setUpdateSessionsSuccess] = useState<boolean>(false)
    const [updatedCount, setUpdatedCount] = useState<number>(0)
    const [sessionToDelete, setSessionToDelete] = useState<{ token: string; clientName: string } | null>(null)
    const [deleteSessionModalOpen, setDeleteSessionModalOpen] = useState<boolean>(false)
    const [deletingSession, setDeletingSession] = useState<string | null>(null)
    const [renewingSession, setRenewingSession] = useState<string | null>(null)
    const [loadingLink, setLoadingLink] = useState<string | null>(null)
    const [getLinkModalOpen, setGetLinkModalOpen] = useState<boolean>(false)
    const [copiedLink, setCopiedLink] = useState<string | null>(null)
    const [renewModalOpen, setRenewModalOpen] = useState<boolean>(false)
    const [renewSuccess, setRenewSuccess] = useState<boolean>(false)

    const pageSize = 10
    const filterRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!isFilterOpen) return
        const onClickOutside = (event: MouseEvent) => {
            if (filterRef.current && !filterRef.current.contains(event.target as Node)) setIsFilterOpen(false)
        }
        document.addEventListener("mousedown", onClickOutside)
        return () => document.removeEventListener("mousedown", onClickOutside)
    }, [isFilterOpen])

    /**
     * Both lists in one pass. They are independent requests, so they go out together rather than
     * one after the other — and a failing session list must not blank the user list, which is the
     * reason this page exists.
     */
    const load = useCallback(async () => {
        setLoading(true)
        setError("")
        const [userResult, sessionResult] = await Promise.allSettled([
            fetch("/api/admin/users").then(async (r) => {
                if (!r.ok) throw new Error(`Failed to fetch users (${r.status})`)
                return (await r.json()) as ListedUser[]
            }),
            fetch("/api/session/listClientSessions").then(async (r) => {
                if (!r.ok) throw new Error(`Failed to fetch sessions (${r.status})`)
                return (await r.json()) as SessionRow[]
            }),
        ])
        if (userResult.status === "fulfilled") {
            setUsers(Array.isArray(userResult.value) ? userResult.value : [])
        } else {
            setError(userResult.reason?.message || "Failed to load users")
        }
        if (sessionResult.status === "fulfilled") {
            setSessions(Array.isArray(sessionResult.value) ? sessionResult.value : [])
        } else {
            setNotice("Sessions could not be loaded, so the session column is empty.")
        }
        setLoading(false)
    }, [])

    useEffect(() => {
        // Loading both lists on mount; the loader flips its own loading and error state after awaiting.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        load()
    }, [load])

    const sendPasswordReset = async (userId: string) => {
        setResetSending((prev) => ({ ...prev, [userId]: true }))
        setError("")
        try {
            const r = await fetch("/api/admin/userPassword", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: userId }),
            })
            if (r.ok) {
                setNotice("Password reset link sent.")
            } else {
                // A non-ok response used to fall through silently, so a failed send looked identical
                // to a successful one — the admin had no way to know the email never went out.
                const body = await r.json().catch(() => ({}))
                setError(body?.message || `Could not send the reset link (HTTP ${r.status}).`)
            }
        } catch {
            setError("Could not send the reset link — the request failed.")
        } finally {
            setResetSending((prev) => ({ ...prev, [userId]: false }))
        }
    }

    const updateRole = async (userId: string, role: string) => {
        setError("")
        try {
            const r = await fetch("/api/admin/users", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: userId, role }),
            })
            // The response was previously never checked, so the row was rewritten locally even when
            // the server refused the change — the table then showed a role the database did not
            // have, and it survived until the next reload.
            if (!r.ok) {
                const body = await r.json().catch(() => ({}))
                setError(body?.message || `Could not change the role (HTTP ${r.status}).`)
                return
            }
            setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)))
        } catch {
            setError("Could not change the role — the request failed.")
        }
    }

    const deleteUser = (userId: string) => {
        const user = users.find((u) => u.id === userId)
        if (!user) return
        setUserToDelete({ id: userId, name: user.name, email: user.email })
        setDeleteModalOpen(true)
    }

    const confirmDeleteUser = async () => {
        if (!userToDelete) return
        try {
            const r = await fetch(`/api/admin/users?id=${encodeURIComponent(userToDelete.id)}`, { method: "DELETE" })
            if (!r.ok) {
                const body = await r.json().catch(() => ({}))
                setError(body?.message || `Could not remove the user (HTTP ${r.status}).`)
                return
            }
            setUsers((prev) => prev.filter((u) => u.id !== userToDelete.id))
        } catch {
            setError("Could not remove the user — the request failed.")
        } finally {
            setDeleteModalOpen(false)
            setUserToDelete(null)
        }
    }

    const expireSessions = useCallback(async () => {
        try {
            setExpiring(true)
            const r = await fetch("/api/admin/expireSessions", { method: "POST" })
            if (!r.ok) throw new Error("Failed to update sessions")
            const j = await r.json()
            setUpdatedCount(j.updated ?? 0)
            setUpdateSessionsSuccess(true)
            setShowUpdateSessionsModal(true)
            await load()
        } catch {
            setUpdateSessionsSuccess(false)
            setShowUpdateSessionsModal(true)
        } finally {
            setExpiring(false)
        }
    }, [load])

    const handleGetLink = async (token: string, clientEmail: string) => {
        if (!token || !clientEmail) return
        setLoadingLink(token)
        try {
            const r = await fetch(`/api/admin/getClientSessionLink?clientEmail=${encodeURIComponent(clientEmail)}`)
            if (!r.ok) throw new Error("Failed to get session link")
            const data = await r.json()
            const fullLink = data.link.startsWith("http") ? data.link : `${window.location.origin}${data.link}`
            // Copying can fail on its own (a browser that withholds clipboard permission); the modal
            // shows the link either way, so a refused clipboard is not a failure to get the link.
            await navigator.clipboard.writeText(fullLink).catch(() => {})
            setCopiedLink(fullLink)
        } catch {
            setCopiedLink(null)
        } finally {
            setLoadingLink(null)
            setGetLinkModalOpen(true)
        }
    }

    const handleRenewSession = async (token: string) => {
        setRenewingSession(token)
        try {
            const r = await fetch("/api/admin/renewSession", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token }),
            })
            if (!r.ok) throw new Error("Failed to renew session")
            setRenewSuccess(true)
            await load()
        } catch {
            setRenewSuccess(false)
        } finally {
            setRenewingSession(null)
            setRenewModalOpen(true)
        }
    }

    const handleDeleteSession = async () => {
        if (!sessionToDelete) return
        setDeletingSession(sessionToDelete.token)
        try {
            const r = await fetch(`/api/admin/deleteSession?token=${encodeURIComponent(sessionToDelete.token)}`, {
                method: "DELETE",
            })
            if (!r.ok) {
                const body = await r.json().catch(() => ({}))
                throw new Error(body?.message || "Failed to delete session")
            }
            await load()
        } catch (e: any) {
            setError(e?.message || "Could not delete the session.")
        } finally {
            setDeleteSessionModalOpen(false)
            setSessionToDelete(null)
            setDeletingSession(null)
        }
    }

    /**
     * Users and sessions joined on email — the only key the two lists share.
     *
     * A session whose email matches nobody is kept as a row of its own rather than dropped: those
     * are clients who were sent an onboarding link and never finished, and losing them was the one
     * way merging the two views could have cost information.
     */
    const rows = useMemo<MergedRow[]>(() => {
        const byEmail = new Map<string, SessionRow>()
        for (const s of sessions) {
            const key = s.clientEmail?.toLowerCase()
            if (!key) continue
            const existing = byEmail.get(key)
            // Keep the most recently touched session when a client has more than one.
            if (!existing || (s.lastUpdatedAt ?? s.createdAt) > (existing.lastUpdatedAt ?? existing.createdAt)) {
                byEmail.set(key, s)
            }
        }
        const claimed = new Set<string>()
        const merged: MergedRow[] = users.map((u) => {
            const key = u.email?.toLowerCase()
            const session = key ? byEmail.get(key) : undefined
            if (key && session) claimed.add(key)
            return { ...u, session: session ?? null, isSessionOnly: false }
        })
        for (const [key, s] of byEmail) {
            if (claimed.has(key)) continue
            merged.push({
                id: `session:${s.token}`,
                name: s.clientName || s.clientEmail,
                email: s.clientEmail,
                image: false,
                role: "client",
                clientName: s.clientName,
                companyName: null,
                isPlatformAdmin: false,
                isSelf: false,
                hasAccount: false,
                session: s,
                isSessionOnly: true,
            })
        }
        return merged
    }, [users, sessions])

    const filteredRows = useMemo(() => {
        let filtered = rows
        if (roleFilter !== "all") {
            filtered = filtered.filter(
                (u) => u.role === roleFilter || (roleFilter === "user" && (u.role === "client" || u.role === "user"))
            )
        }
        if (sessionFilter !== "all") {
            filtered = filtered.filter((u) =>
                sessionFilter === "none" ? !u.session : u.session?.status === sessionFilter
            )
        }
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase()
            filtered = filtered.filter(
                (u) =>
                    u.name?.toLowerCase().includes(q) ||
                    u.email?.toLowerCase().includes(q) ||
                    u.clientName?.toLowerCase().includes(q) ||
                    u.companyName?.toLowerCase().includes(q) ||
                    u.role?.toLowerCase().includes(q) ||
                    u.session?.businessName?.toLowerCase().includes(q) ||
                    (u.session ? SESSION_LABELS[u.session.status].toLowerCase().includes(q) : false)
            )
        }
        const sorted = [...filtered].sort((a, b) => {
            let comparison = 0
            if (sortBy === "name") {
                comparison = (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" })
            } else if (sortBy === "email") {
                comparison = (a.email || "").localeCompare(b.email || "", undefined, { sensitivity: "base" })
            } else if (sortBy === "role") {
                comparison = (a.role || "").localeCompare(b.role || "", undefined, { sensitivity: "base" })
            } else {
                // No session sorts last in either direction — "most advanced session" is the point
                // of the sort, and rows without one have no place on that scale.
                comparison = (a.session ? SESSION_ORDER[a.session.status] : 99) - (b.session ? SESSION_ORDER[b.session.status] : 99)
            }
            return sortDir === "asc" ? comparison : -comparison
        })
        return sorted
    }, [rows, searchQuery, roleFilter, sessionFilter, sortBy, sortDir])

    const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize))
    const page = Math.min(currentPage, totalPages - 1)
    const paginatedRows = filteredRows.slice(page * pageSize, (page + 1) * pageSize)
    // Only platform admins get companyName back from the API — show the column just for them,
    // so everyone else's table (scoped to their own company) looks the same as before.
    const showCompanyColumn = rows.some((u) => u.companyName)

    return (
        <PanelPage>
            <PanelHeader title="User Management">
                <PanelSearch
                    id="users-search"
                    label="Search Users"
                    placeholder="Search users"
                    value={searchQuery}
                    onChange={(value) => {
                        setSearchQuery(value)
                        setCurrentPage(0)
                    }}
                />
                <div className="relative" ref={filterRef}>
                    <PanelButton onClick={() => setIsFilterOpen((v) => !v)} icon={<Filter className="h-4 w-4" />}>
                        Filter
                        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isFilterOpen ? "rotate-180" : ""}`} />
                    </PanelButton>
                    {isFilterOpen && (
                        <PanelPopover>
                            <h3 className="mb-3 text-[13px] font-semibold text-[#111827]">Sort &amp; Filter</h3>
                            <PanelSelect
                                label="Sort By"
                                value={sortBy}
                                onChange={(value) => {
                                    setSortBy(value as typeof sortBy)
                                    setCurrentPage(0)
                                }}
                                options={[
                                    { value: "name", label: "Name" },
                                    { value: "email", label: "Email" },
                                    { value: "role", label: "Role" },
                                    { value: "session", label: "Session" },
                                ]}
                            />
                            <PanelSelect
                                label="Role"
                                value={roleFilter}
                                onChange={(value) => {
                                    setRoleFilter(value as typeof roleFilter)
                                    setCurrentPage(0)
                                }}
                                options={[
                                    { value: "all", label: "All Roles" },
                                    { value: "admin", label: "Admin" },
                                    { value: "staff", label: "Staff" },
                                    { value: "user", label: "Client" },
                                ]}
                            />
                            <PanelSelect
                                label="Session"
                                value={sessionFilter}
                                onChange={(value) => {
                                    setSessionFilter(value as typeof sessionFilter)
                                    setCurrentPage(0)
                                }}
                                options={[
                                    { value: "all", label: "All Sessions" },
                                    { value: "pending", label: "Not Started" },
                                    { value: "in_progress", label: "In Progress" },
                                    { value: "completed", label: "Completed" },
                                    { value: "expired", label: "Expired" },
                                    { value: "canceled", label: "Canceled" },
                                    { value: "none", label: "No Session" },
                                ]}
                            />
                            <div className="mb-4">
                                <span className="mb-1.5 block text-[11px] font-medium text-[#6B7280]">Order</span>
                                <div className="flex gap-2">
                                    {(["asc", "desc"] as const).map((dir) => (
                                        <button
                                            key={dir}
                                            type="button"
                                            onClick={() => {
                                                setSortDir(dir)
                                                setCurrentPage(0)
                                            }}
                                            className={`h-8 flex-1 rounded-lg text-[12px] font-medium transition-colors ${
                                                sortDir === dir
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
                                    setSearchQuery("")
                                    setRoleFilter("all")
                                    setSessionFilter("all")
                                    setSortBy("role")
                                    setSortDir("asc")
                                    setCurrentPage(0)
                                    setIsFilterOpen(false)
                                }}
                                className="h-8 w-full rounded-lg border-t border-[#EFECF4] text-[12px] font-medium text-[#6B7280] transition-colors hover:bg-[#FAF9FD] hover:text-[#374151]"
                            >
                                Clear All Filters
                            </button>
                        </PanelPopover>
                    )}
                </div>
                <PanelButton
                    onClick={expireSessions}
                    disabled={expiring}
                    icon={<RefreshCw className={`h-4 w-4 ${expiring ? "animate-spin" : ""}`} />}
                    title="Expire sessions that have passed their deadline"
                >
                    Update Sessions
                </PanelButton>
                <PanelButton variant="primary" onClick={() => setShowCreate(true)} icon={<Plus className="h-4 w-4" />}>
                    Create User
                </PanelButton>
            </PanelHeader>

            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <LoadingSpinner label="Loading User Data..." />
                </div>
            ) : (
                <PanelCard>
                    {filteredRows.length === 0 ? (
                        <PanelEmptyState
                            message={searchQuery ? "No users match your search." : "No users found."}
                            image={<Image src="/assets/no-client.png" alt="" width={176} height={176} className="h-auto w-44" />}
                        >
                            {!searchQuery && (
                                <PanelButton variant="primary" onClick={() => setShowCreate(true)} icon={<Plus className="h-4 w-4" />}>
                                    Create User
                                </PanelButton>
                            )}
                        </PanelEmptyState>
                    ) : (
                        <>
                            <PanelTable>
                                <PanelThead>
                                    <PanelTh>User</PanelTh>
                                    <PanelTh>Role</PanelTh>
                                    {showCompanyColumn && <PanelTh>Company</PanelTh>}
                                    <PanelTh>Session</PanelTh>
                                    <PanelTh>Manage</PanelTh>
                                </PanelThead>
                                <PanelTbody>
                                    {paginatedRows.map((u) => {
                                        const session = u.session
                                        const canManageAccount = !u.isSessionOnly && u.hasAccount !== false
                                        return (
                                            <PanelTr key={u.id}>
                                                <PanelTd>
                                                    <div className="flex items-center gap-3">
                                                        <ProfileImage
                                                            src={u.image ? `/api/admin/getUserImage?userId=${u.id}&v=${u.imageVersion ?? 0}` : null}
                                                            name={u.name || u.email || "User"}
                                                            size={32}
                                                            alt={`${u.name || u.email || "User"}'s profile`}
                                                        />
                                                        <div className="min-w-0">
                                                            <div className="truncate font-medium text-[#111827]">{u.name || "—"}</div>
                                                            <div className="truncate text-[12px] text-[#6B7280]">{u.email || "—"}</div>
                                                        </div>
                                                    </div>
                                                </PanelTd>
                                                <PanelTd>
                                                    <div className="flex flex-wrap items-center gap-1.5">
                                                        <PanelBadge tone={ROLE_TONES[normalizeRole(u.role)]}>
                                                            {ROLE_LABELS[normalizeRole(u.role)]}
                                                        </PanelBadge>
                                                        {!canManageAccount && <PanelBadge tone="neutral">No account</PanelBadge>}
                                                    </div>
                                                </PanelTd>
                                                {showCompanyColumn && <PanelTd>{u.companyName || <PanelEmptyCell />}</PanelTd>}
                                                <PanelTd>
                                                    {session ? (
                                                        <PanelBadge tone={SESSION_TONES[session.status]}>
                                                            {SESSION_LABELS[session.status]}
                                                        </PanelBadge>
                                                    ) : (
                                                        <PanelEmptyCell />
                                                    )}
                                                </PanelTd>
                                                <PanelTd className="relative">
                                                    <RowActionMenu label={`Manage ${u.name || u.email || "user"}`}>
                                                        {canManageAccount && (
                                                            <RowActionMenuItem
                                                                onClick={() => sendPasswordReset(u.id)}
                                                                disabled={resetSending[u.id]}
                                                                icon={<KeyRound className="w-4 h-4" />}
                                                                tone="accent"
                                                            >
                                                                {resetSending[u.id] ? "Sending…" : "Send reset email"}
                                                            </RowActionMenuItem>
                                                        )}
                                                        {canManageAccount && !u.isPlatformAdmin && (
                                                            <>
                                                                <RowActionMenuLabel>Change role</RowActionMenuLabel>
                                                                {ROLE_CHOICES.filter((choice) => choice.value !== normalizeRole(u.role)).map((choice) => (
                                                                    <RowActionMenuItem
                                                                        key={choice.value}
                                                                        onClick={() => updateRole(u.id, choice.value === "client" ? "user" : choice.value)}
                                                                        icon={<UserCog className="w-4 h-4" />}
                                                                    >
                                                                        {choice.label}
                                                                    </RowActionMenuItem>
                                                                ))}
                                                            </>
                                                        )}
                                                        {session && <RowActionMenuLabel>Session</RowActionMenuLabel>}
                                                        {session && session.status !== "expired" && (
                                                            <RowActionMenuItem
                                                                onClick={() => handleGetLink(session.token, session.clientEmail)}
                                                                disabled={loadingLink === session.token}
                                                                icon={<LinkIcon className="w-4 h-4" />}
                                                            >
                                                                {loadingLink === session.token ? "Loading…" : "Get session link"}
                                                            </RowActionMenuItem>
                                                        )}
                                                        {session && (
                                                            <RowActionMenuItem
                                                                onClick={() => handleRenewSession(session.token)}
                                                                disabled={renewingSession === session.token}
                                                                icon={<RotateCw className={`w-4 h-4 ${renewingSession === session.token ? "animate-spin" : ""}`} />}
                                                            >
                                                                Renew session
                                                            </RowActionMenuItem>
                                                        )}
                                                        {(session || (canManageAccount && !u.isSelf && !u.isPlatformAdmin)) && <RowActionMenuDivider />}
                                                        {session && (
                                                            <RowActionMenuItem
                                                                onClick={() => {
                                                                    setSessionToDelete({ token: session.token, clientName: session.clientName })
                                                                    setDeleteSessionModalOpen(true)
                                                                }}
                                                                icon={<Trash2 className="w-4 h-4" />}
                                                                tone="danger"
                                                            >
                                                                Delete session
                                                            </RowActionMenuItem>
                                                        )}
                                                        {canManageAccount && !u.isSelf && !u.isPlatformAdmin && (
                                                            <RowActionMenuItem
                                                                onClick={() => deleteUser(u.id)}
                                                                icon={<Trash2 className="w-4 h-4" />}
                                                                tone="danger"
                                                            >
                                                                Remove user
                                                            </RowActionMenuItem>
                                                        )}
                                                    </RowActionMenu>
                                                </PanelTd>
                                            </PanelTr>
                                        )
                                    })}
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

            {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
            {notice && !error && <div className="mt-3 text-sm text-[#6B7280]">{notice}</div>}

            {showCreate && (
                <CreateUserModal
                    onClose={() => setShowCreate(false)}
                    onCreated={() => {
                        setShowCreate(false)
                        load()
                    }}
                />
            )}

            <ConfirmActionModal
                isOpen={deleteModalOpen}
                title="Remove User"
                message={
                    <>
                        Are you sure you want to remove{" "}
                        <span className="font-semibold text-[#111827]">{userToDelete?.name || userToDelete?.email || ""}</span>? This action is permanent and cannot be undone. All associated data will be removed.
                    </>
                }
                confirmLabel="Remove User"
                onConfirm={confirmDeleteUser}
                onCancel={() => {
                    setDeleteModalOpen(false)
                    setUserToDelete(null)
                }}
            />

            <UpdateSessionsModal
                isOpen={showUpdateSessionsModal}
                success={updateSessionsSuccess}
                updatedCount={updatedCount}
                onClose={() => setShowUpdateSessionsModal(false)}
            />

            <ConfirmDeleteSessionModal
                isOpen={deleteSessionModalOpen}
                clientName={sessionToDelete?.clientName || ""}
                onConfirm={handleDeleteSession}
                onCancel={() => {
                    setDeleteSessionModalOpen(false)
                    setSessionToDelete(null)
                }}
                isDeleting={deletingSession !== null}
            />

            <GetLinkModal
                isOpen={getLinkModalOpen}
                link={copiedLink}
                onClose={() => {
                    setGetLinkModalOpen(false)
                    setCopiedLink(null)
                }}
            />

            <RenewSessionModal
                isOpen={renewModalOpen}
                success={renewSuccess}
                onClose={() => {
                    setRenewModalOpen(false)
                    setRenewSuccess(false)
                }}
            />
        </PanelPage>
    )
}

function CreateUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
    const [name, setName] = useState<string>("")
    const [email, setEmail] = useState<string>("")
    const [password, setPassword] = useState<string>("")
    const [role, setRole] = useState<string>("staff")
    const [submitting, setSubmitting] = useState<boolean>(false)
    const [error, setError] = useState<string>("")
    const [showSuccess, setShowSuccess] = useState<boolean>(false)
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

    const isValidEmail = (email: string) => {
        const emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i
        return emailRegex.test(email)
    }

    const validateForm = () => {
        const errors: Record<string, string> = {}

        if (!name.trim()) {
            errors.name = "Name is required"
        }

        if (!email.trim()) {
            errors.email = "Email is required"
        } else if (!isValidEmail(email)) {
            errors.email = "Please enter a valid email address."
        }

        if (!password.trim()) {
            errors.password = "Password is required"
        }

        setFieldErrors(errors)
        return Object.keys(errors).length === 0
    }

    const submit = async () => {
        if (!validateForm()) {
            return
        }

        setSubmitting(true)
        setError("")
        try {
            const r = await fetch("/api/admin/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, email, password, role }),
            })
            if (!r.ok) throw new Error((await r.json())?.message || "Failed to create user")
            setShowSuccess(true)
        } catch (e: any) {
            setError(e?.message || "Failed to create user")
        } finally {
            setSubmitting(false)
        }
    }

    const handleFieldChange = (field: string, value: string) => {
        setFieldErrors((prev) => ({ ...prev, [field]: "" }))
        setError("")
        if (field === "name") setName(value)
        else if (field === "email") setEmail(value)
        else if (field === "password") setPassword(value)
        else if (field === "role") setRole(value)
    }

    if (showSuccess) {
    return (
            <Modal
                zIndexClass="z-[200]"
                backdropClassName="bg-black/50 backdrop-blur-sm"
                cardClassName="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4"
                label="User Created"
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
                        <h3 className="text-xl font-semibold text-[#111827] mb-2">User Created Successfully!</h3>
                        <p className={`text-sm text-[#6B7280] mb-6 ${inter.className}`}>
                            The user has been created successfully and can now access the system.
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
            zIndexClass="z-[200]"
            backdropClassName="bg-black/50 backdrop-blur-sm"
            cardClassName="w-full max-w-2xl rounded-lg bg-white shadow-xl border border-[#E5E7EB] p-6"
            label="Create User"
            onClose={onClose}
        >
                <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#701CC0]/10 text-[#701CC0] inline-flex items-center justify-center">
                            <FiPlus className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-[#111827]">Create User</h2>
                            <p className="text-sm text-[#6B7280] mt-0.5">Add a new user to the system</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="p-1.5 rounded-md text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#374151]"
                        aria-label="Close modal"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                        <label htmlFor="create-user-name" className="block text-sm font-medium text-[#374151] mb-1">
                            Name <span className="text-red-500">*</span>
                        </label>
                        <input 
                            id="create-user-name"
                            type="text" 
                            value={name} 
                            onChange={(e) => handleFieldChange("name", e.target.value)} 
                            placeholder="Enter Name"
                            className={`w-full rounded-lg border px-3 py-2 text-sm text-[#111827] outline-none focus:ring-2 focus:ring-[#701CC0] ${
                                fieldErrors.name ? 'border-red-500 bg-red-50' : 'border-[#E5E7EB]'
                            }`}
                        />
                        {fieldErrors.name ? <p className="mt-1 text-xs text-red-600">{fieldErrors.name}</p> : null}
                    </div>

                    <div>
                        <label htmlFor="create-user-role" className="block text-sm font-medium text-[#374151] mb-1">
                            Role <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                            <select 
                                id="create-user-role"
                                value={role} 
                                onChange={(e) => handleFieldChange("role", e.target.value)} 
                                className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 pr-10 text-sm bg-white text-[#111827] outline-none focus:ring-2 focus:ring-[#701CC0] appearance-none"
                            >
                                <option value="admin">Admin</option>
                                <option value="staff">Staff</option>
                            </select>
                            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                <ChevronDown className="w-4 h-4 text-[#6B7280]" />
                            </div>
                        </div>
                        <p className="mt-1 text-xs text-[#6B7280]">
                            Need a client account? Use <span className="font-medium">Clients &rarr; Add Client</span> instead — clients set their own password via an onboarding link.
                        </p>
                    </div>

                    <div className="md:col-span-2">
                        <label htmlFor="create-user-email" className="block text-sm font-medium text-[#374151] mb-1">
                            Email <span className="text-red-500">*</span>
                        </label>
                        <input 
                            id="create-user-email"
                            type="email" 
                            value={email} 
                            onChange={(e) => handleFieldChange("email", e.target.value)} 
                            placeholder="Enter Email"
                            className={`w-full rounded-lg border px-3 py-2 text-sm text-[#111827] outline-none focus:ring-2 focus:ring-[#701CC0] ${
                                fieldErrors.email || (email && !isValidEmail(email))
                                    ? 'border-red-500 bg-red-50' 
                                    : 'border-[#E5E7EB]'
                            }`}
                        />
                        {fieldErrors.email ? <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p> : null}
                        {email && !fieldErrors.email && !isValidEmail(email) ? (
                            <p className="mt-1 text-xs text-red-600">Please enter a valid email address.</p>
                        ) : null}
                    </div>

                    <div className="md:col-span-2">
                        <label htmlFor="create-user-password" className="block text-sm font-medium text-[#374151] mb-1">
                            Password <span className="text-red-500">*</span>
                        </label>
                        <input 
                            id="create-user-password"
                            type="password" 
                            value={password} 
                            onChange={(e) => handleFieldChange("password", e.target.value)} 
                            placeholder="Enter Password"
                            className={`w-full rounded-lg border px-3 py-2 text-sm text-[#111827] outline-none focus:ring-2 focus:ring-[#701CC0] ${
                                fieldErrors.password ? 'border-red-500 bg-red-50' : 'border-[#E5E7EB]'
                            }`}
                        />
                        {fieldErrors.password ? <p className="mt-1 text-xs text-red-600">{fieldErrors.password}</p> : null}
                    </div>
                </div>

                {error ? (
                    <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
                ) : null}

                <div className="flex items-center justify-between mt-5">
                    <button 
                        onClick={onClose}
                        disabled={submitting}
                        className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Cancel
                    </button>
                    <button 
                        disabled={submitting || !name.trim() || !email.trim() || !password.trim() || (email ? !isValidEmail(email) : false)} 
                        onClick={submit} 
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#701CC0] text-white text-sm font-medium hover:bg-[#5f17a5] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {submitting ? (
                            <>
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                Creating...
                            </>
                        ) : (
                            <>
                                <FiPlus className="w-4 h-4" />
                                Create User
                            </>
                        )}
                    </button>
                </div>
        </Modal>
    )
}

/**
 * Result of the expiry sweep. Lifted out of the panel's JSX, where it was a hand-rolled backdrop
 * with its own click-outside handling rather than the shared Modal every other dialog here uses.
 */
const UpdateSessionsModal: React.FC<{
    isOpen: boolean
    success: boolean
    updatedCount: number
    onClose: () => void
}> = ({ isOpen, success, updatedCount, onClose }) => {
    if (!isOpen) return null

    return (
        <Modal
            zIndexClass="z-50"
            backdropClassName="bg-black/50 backdrop-blur-sm"
            cardClassName="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4"
            label="Update Sessions"
            onClose={onClose}
        >
            <div className="flex flex-col items-center text-center">
                {success ? (
                    <>
                        <div className="relative mb-4 inline-flex h-16 w-16 items-center justify-center">
                            <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-30 animate-ping" />
                            <span className="relative inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500 text-white">
                                    <FiCheck className="h-6 w-6" />
                                </span>
                            </span>
                        </div>
                        <h3 className="text-xl font-semibold text-[#111827] mb-2">Sessions Updated Successfully!</h3>
                        <p className={`text-sm text-[#6B7280] mb-6 ${inter.className}`}>
                            {updatedCount > 0
                                ? `Successfully updated ${updatedCount} session${updatedCount === 1 ? "" : "s"}.`
                                : "No sessions needed updating."}
                        </p>
                    </>
                ) : (
                    <>
                        <div className="relative mb-4 inline-flex h-16 w-16 items-center justify-center">
                            <span className="relative inline-flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500 text-white">
                                    <XCircle className="h-6 w-6" />
                                </span>
                            </span>
                        </div>
                        <h3 className="text-xl font-semibold text-[#111827] mb-2">Failed To Update Sessions</h3>
                        <p className={`text-sm text-[#6B7280] mb-6 ${inter.className}`}>
                            An error occurred while updating sessions. Please try again.
                        </p>
                    </>
                )}
                <button
                    className={`w-full rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                        success ? "bg-[#701CC0] text-white hover:bg-[#5f17a5]" : "bg-red-600 text-white hover:bg-red-700"
                    }`}
                    onClick={onClose}
                >
                    Done
                </button>
            </div>
        </Modal>
    )
}

const ConfirmDeleteSessionModal: React.FC<{
    isOpen: boolean
    clientName: string
    onConfirm: () => void
    onCancel: () => void
    isDeleting: boolean
}> = ({ isOpen, clientName, onConfirm, onCancel, isDeleting }) => {
    if (!isOpen) return null

    return (
        <Modal
            zIndexClass="z-50"
            backdropClassName="bg-black/50 backdrop-blur-sm"
            cardClassName="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4"
            label="Delete Session"
            onClose={onCancel}
        >
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                        <FiTrash2 className="w-6 h-6 text-red-600" />
                    </div>
                    <h3 className="text-xl font-semibold text-[#111827]">Delete Session</h3>
                </div>
                <p className="text-sm text-[#6B7280] mb-6">
                    Are you sure you want to delete the session for <span className="font-semibold text-[#111827]">{clientName}</span>? 
                    This action is permanent and cannot be undone. All associated data will be removed.
                </p>
                <div className="flex gap-3 justify-end">
                    <button
                        onClick={onCancel}
                        disabled={isDeleting}
                        className="px-4 py-2 rounded-lg border border-[#E5E7EB] text-[#374151] hover:bg-gray-50 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isDeleting}
                        className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {isDeleting && (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        )}
                        Delete Session
                    </button>
                </div>
        </Modal>
    )
}

const GetLinkModal: React.FC<{
    isOpen: boolean
    link: string | null
    onClose: () => void
}> = ({ isOpen, link, onClose }) => {
    const [copied, setCopied] = useState<boolean>(false)

    const handleCopy = async () => {
        if (link) {
            try {
                await navigator.clipboard.writeText(link)
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
            } catch {
            }
        }
    }

    if (!isOpen) return null

    return (
        <Modal
            zIndexClass="z-50"
            backdropClassName="bg-black/50 backdrop-blur-sm"
            cardClassName="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4"
            label="Session Link"
            onClose={onClose}
        >
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                        <LinkIcon className="w-6 h-6 text-[#701CC0]" />
                    </div>
                    <h3 className="text-xl font-semibold text-[#111827]">Session Link</h3>
                </div>

                {link ? (
                    <>
                        <div className="mb-4">
                            <label className="block text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#8B8598] mb-1.5">Session Link</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={link}
                                    readOnly
                                    className="flex-1 px-3 py-2 border border-[#E5E7EB] rounded-lg text-sm text-[#111827] bg-gray-50"
                                />
                                <button
                                    onClick={handleCopy}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                        copied
                                            ? "bg-green-100 text-green-700 border border-green-200"
                                            : "bg-[#701CC0] text-white hover:bg-[#5f17a5]"
                                    }`}
                                >
                                    {copied ? "Copied!" : "Copy"}
                                </button>
                            </div>
                        </div>
                        <p className="text-sm text-[#6B7280] mb-4">
                            The session link has been copied to your clipboard. You can share this link with the client.
                        </p>
                    </>
                ) : (
                    <>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                                <XCircle className="w-6 h-6 text-red-600" />
                            </div>
                            <h3 className="text-lg font-semibold text-[#111827]">Failed To Get Link</h3>
                        </div>
                        <p className="text-sm text-[#6B7280] mb-4">
                            Unable to retrieve the session link. Please try again.
                        </p>
                    </>
                )}

                <div className="flex justify-center mt-6">
                    <button
                        onClick={onClose}
                        className="w-full rounded-lg px-4 py-2 bg-[#701CC0] text-white hover:bg-[#5f17a5] text-sm font-medium transition-colors"
                    >
                        Done
                    </button>
                </div>
        </Modal>
    )
}

const RenewSessionModal: React.FC<{
    isOpen: boolean
    success: boolean
    onClose: () => void
}> = ({ isOpen, success, onClose }) => {
    if (!isOpen) return null

    return (
        <Modal
            zIndexClass="z-50"
            backdropClassName="bg-black/50 backdrop-blur-sm"
            cardClassName="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4"
            label="Renew Session"
            onClose={onClose}
        >
                {success ? (
                    <>
                        <div className="flex flex-col items-center text-center mb-6">
                            <div className="relative mb-4 inline-flex h-16 w-16 items-center justify-center">
                                <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-30 animate-ping" />
                                <span className="relative inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500 text-white">
                                        <FiCheck className="h-6 w-6" />
                                    </span>
                                </span>
                            </div>
                            <h3 className="text-xl font-semibold text-[#111827] mb-2">Session Renewed Successfully!</h3>
                            <p className={`text-sm text-[#6B7280] mb-6 ${inter.className}`}>
                                The session has been renewed and changed from Expired to Not Started. The session link is now active.
                            </p>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                                <XCircle className="w-6 h-6 text-red-600" />
                            </div>
                            <h3 className="text-xl font-semibold text-[#111827]">Failed To Renew Session</h3>
                        </div>
                        <p className="text-sm text-[#6B7280] mb-6">
                            Unable to renew the session. Please try again.
                        </p>
                    </>
                )}

                <div className="flex justify-center mt-6">
                    <button
                        onClick={onClose}
                        className={`w-full rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                            success
                                ? "bg-[#701CC0] text-white hover:bg-[#5f17a5]"
                                : "bg-red-600 text-white hover:bg-red-700"
                        }`}
                    >
                        Done
                    </button>
                </div>
        </Modal>
    )
}
