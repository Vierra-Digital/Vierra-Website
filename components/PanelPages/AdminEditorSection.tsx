"use client"

import React, { useCallback, useEffect, useMemo, useState, useRef } from "react"
import {
    ChevronDown,
    Filter,
    KeyRound,
    Link as LinkIcon,
    RefreshCw,
    RotateCw,
    Trash2,
    XCircle,
} from "lucide-react"
import { FiCheck, FiTrash2 } from "react-icons/fi"
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
    PanelClearFilters,
    PanelDataTable,
    PanelEmptyCell,
    PanelHeader,
    PanelPage,
    PanelPopover,
    PanelSearch,
    PanelSelect,
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
    lastLoginAt?: string | null
    lastLoginIp?: string | null
    pendingInvite?: {
        id: string
        invitedAt: string
        expiresAt: string
        expired: boolean
    } | null
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
/** Loopback addresses say "localhost" — "::1" is not an address anyone needs to read as one. */
const formatIp = (ip?: string | null) => {
    if (!ip) return null
    const trimmed = ip.trim()
    if (trimmed === "::1" || trimmed === "127.0.0.1" || trimmed.startsWith("::ffff:127.")) return "localhost"
    return trimmed
}

/**
 * "3m Ago" up to a week, then a date.
 *
 * `now` is passed in rather than read from the clock inside, so the ticking state below is what
 * re-renders these labels. Reading Date.now() here would make the function correct and the screen
 * still wrong — React has no reason to re-render just because time passed.
 */
const formatRelative = (iso: string | null | undefined, now: number) => {
    if (!iso) return null
    const then = new Date(iso).getTime()
    if (!Number.isFinite(then)) return null
    const minutes = Math.floor((now - then) / 60000)
    if (minutes < 1) return "Just Now"
    if (minutes < 60) return `${minutes}m Ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h Ago`
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days}d Ago`
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
}

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
    const [resetSending, setResetSending] = useState<Record<string, boolean>>({})
    const [deleteModalOpen, setDeleteModalOpen] = useState<boolean>(false)
    const [userToDelete, setUserToDelete] = useState<{ id: string; name: string | null; email: string | null } | null>(null)
    const [rescindingInvite, setRescindingInvite] = useState<string | null>(null)
    // Drives the relative-time labels. Seeded at 0 so the server and the first client render agree
    // — reading the clock during render is what produces a hydration mismatch — and set for real
    // in the effect below.
    const [now, setNow] = useState(0)
    const [deleteError, setDeleteError] = useState<string>("")
    const [deletingUser, setDeletingUser] = useState<boolean>(false)
    const [searchQuery, setSearchQuery] = useState<string>("")
    const [currentPage, setCurrentPage] = useState<number>(0)
    const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "staff" | "user">("all")
    const [sessionFilter, setSessionFilter] = useState<"all" | "none" | SessionStatus>("all")
    const [sortBy, setSortBy] = useState<"name" | "email" | "role" | "session">("role")
    const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")
    const [isFilterOpen, setIsFilterOpen] = useState<boolean>(false)
    const [resetResult, setResetResult] = useState<{ success: boolean; email: string | null } | null>(null)

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

    // Twenty-five rows a page: this list holds staff, clients and pending invites together, so ten
    // meant paging through a company that fits on one screen.
    const pageSize = 25
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
            setError("Sessions could not be loaded, so the session column is empty.")
        }
        setLoading(false)
    }, [])

    useEffect(() => {
        // Loading both lists on mount; the loader flips its own loading and error state after awaiting.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        load()
    }, [load])

    /**
     * Keeps Last Login live, the same way the dashboard's staff panel keeps presence live: tick the
     * clock so "5m Ago" becomes "6m Ago" without a reload, and re-read the list on the same beat so
     * a sign-in that happened while this page was open turns up.
     *
     * Only while the tab is visible — a backgrounded admin page polling every minute is waste, and
     * it refreshes on return rather than waiting out the rest of the interval.
     */
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setNow(Date.now())
        const tick = () => {
            if (document.visibilityState !== "visible") return
            setNow(Date.now())
            void load()
        }
        const timer = window.setInterval(tick, 60_000)
        document.addEventListener("visibilitychange", tick)
        return () => {
            window.clearInterval(timer)
            document.removeEventListener("visibilitychange", tick)
        }
    }, [load])

    const sendPasswordReset = async (userId: string, email: string | null) => {
        setResetSending((prev) => ({ ...prev, [userId]: true }))
        setError("")
        try {
            const r = await fetch("/api/admin/userPassword", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: userId }),
            })
            if (r.ok) {
                setResetResult({ success: true, email })
            } else {
                // A non-ok response used to fall through silently, so a failed send looked identical
                // to a successful one — the admin had no way to know the email never went out.
                const body = await r.json().catch(() => ({}))
                setError(body?.message || `Could not send the reset link (HTTP ${r.status}).`)
                setResetResult({ success: false, email })
            }
        } catch {
            setResetResult({ success: false, email })
        } finally {
            setResetSending((prev) => ({ ...prev, [userId]: false }))
        }
    }

    const deleteUser = (userId: string) => {
        const user = users.find((u) => u.id === userId)
        if (!user) return
        setUserToDelete({ id: userId, name: user.name, email: user.email })
        setDeleteError("")
        setDeleteModalOpen(true)
    }

    const confirmDeleteUser = async () => {
        if (!userToDelete) return
        setDeletingUser(true)
        setDeleteError("")
        try {
            const r = await fetch(`/api/admin/users?id=${encodeURIComponent(userToDelete.id)}`, { method: "DELETE" })
            if (!r.ok) {
                // Shown in the dialog rather than as a line at the foot of the page: the dialog
                // used to close on failure, so the only sign that nothing had happened was the row
                // still being there.
                const body = await r.json().catch(() => ({}))
                setDeleteError(body?.message || `Could not remove the user (HTTP ${r.status}).`)
                return
            }
            setUsers((prev) => prev.filter((u) => u.id !== userToDelete.id))
            setDeleteModalOpen(false)
            setUserToDelete(null)
        } catch {
            setDeleteError("Could not remove the user — the request failed.")
        } finally {
            setDeletingUser(false)
        }
    }

    const rescindInvite = async (inviteId: string) => {
        setRescindingInvite(inviteId)
        setError("")
        try {
            const r = await fetch(`/api/admin/invitations/${encodeURIComponent(inviteId)}`, { method: "DELETE" })
            if (!r.ok) {
                const body = await r.json().catch(() => ({}))
                setError(body?.message || `Could not rescind the invite (HTTP ${r.status}).`)
                return
            }
            await load()
        } catch {
            setError("Could not rescind the invite — the request failed.")
        } finally {
            setRescindingInvite(null)
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
                pendingInvite: null,
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
                            <PanelClearFilters
                                onClick={() => {
                                    setSearchQuery("")
                                    setRoleFilter("all")
                                    setSessionFilter("all")
                                    setSortBy("role")
                                    setSortDir("asc")
                                    setCurrentPage(0)
                                    setIsFilterOpen(false)
                                }}
                            />
                        </PanelPopover>
                    )}
                </div>
                <PanelButton
                    variant="primary"
                    onClick={expireSessions}
                    disabled={expiring}
                    icon={<RefreshCw className={`h-4 w-4 ${expiring ? "animate-spin" : ""}`} />}
                    title="Expire sessions that have passed their deadline"
                >
                    Update Sessions
                </PanelButton>
            </PanelHeader>

            <PanelDataTable<MergedRow>
                rows={filteredRows}
                getRowKey={(u) => u.id}
                loading={loading}
                loadingLabel={<LoadingSpinner label="Loading User Data..." />}
                page={page}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                emptyTitle="No Users Found"
                emptyMessage="No users match your search."
                emptyImage={<Image src="/assets/no-client.png" alt="" width={176} height={176} className="h-auto w-44" priority />}
                columns={[
                    {
                        key: "user",
                        header: "User",
                        cell: (u) => (
                            <div className="flex items-center gap-3">
                                <ProfileImage
                                    src={u.image ? `/api/admin/getUserImage?userId=${u.id}&v=${u.imageVersion ?? 0}` : null}
                                    name={u.name || u.email || "User"}
                                    size={32}
                                    alt={`${u.name || u.email || "User"}'s profile`}
                                />
                                <div className="min-w-0">
                                    {/* An invitation has no name yet, and rendering an em-dash above the
                                        address left the row's main line blank. The address becomes the
                                        line when there is nothing else to put there. */}
                                    <div className="truncate font-medium text-[#111827]">{u.name || u.email || "—"}</div>
                                    {u.name && u.email ? (
                                        <div className="truncate text-[12px] text-[#6B7280]">{u.email}</div>
                                    ) : null}
                                </div>
                            </div>
                        ),
                    },
                    {
                        key: "role",
                        header: "Role",
                        cell: (u) => (
                            <PanelBadge tone={ROLE_TONES[normalizeRole(u.role)]}>{ROLE_LABELS[normalizeRole(u.role)]}</PanelBadge>
                        ),
                    },
                    ...(showCompanyColumn
                        ? [{ key: "company", header: "Company", cell: (u: MergedRow) => u.companyName || <PanelEmptyCell /> }]
                        : []),
                    {
                        key: "lastLogin",
                        header: "Last Login",
                        cell: (u) =>
                            u.pendingInvite ? (
                                <span className={`text-[12px] ${u.pendingInvite.expired ? "text-[#B42318]" : "text-[#9CA3AF]"}`}>
                                    {u.pendingInvite.expired ? "Invite Expired" : `Invited ${formatRelative(u.pendingInvite.invitedAt, now)}`}
                                </span>
                            ) : u.lastLoginAt ? (
                                /* Time first, address underneath and muted: the address is why the column
                                   is worth a join, but it is reference detail, and `whitespace-nowrap`
                                   keeps an IPv6 address on one line instead of wrapping mid-address. */
                                <div className="flex flex-col items-start gap-0.5">
                                    <span className="whitespace-nowrap" title={new Date(u.lastLoginAt).toLocaleString()}>
                                        {formatRelative(u.lastLoginAt, now)}
                                    </span>
                                    <span
                                        className="whitespace-nowrap text-[11.5px] text-[#9CA3AF]"
                                        title={u.lastLoginIp ? `IP ${u.lastLoginIp}` : undefined}
                                    >
                                        {formatIp(u.lastLoginIp) || "IP unknown"}
                                    </span>
                                </div>
                            ) : (
                                <span className="text-[12px] text-[#9CA3AF]">Never</span>
                            ),
                    },
                    {
                        key: "session",
                        header: "Session",
                        cell: (u) =>
                            u.session ? (
                                <PanelBadge tone={SESSION_TONES[u.session.status]}>{SESSION_LABELS[u.session.status]}</PanelBadge>
                            ) : (
                                <PanelEmptyCell />
                            ),
                    },
                    {
                        key: "manage",
                        header: "Manage",
                        className: "relative",
                        cell: (u) => {
                            const session = u.session
                            const canManageAccount = !u.isSessionOnly && u.hasAccount !== false && !u.pendingInvite
                            return (
                                <RowActionMenu label={`Manage ${u.name || u.email || "user"}`}>
                                    {canManageAccount && (
                                        <RowActionMenuItem
                                            onClick={() => sendPasswordReset(u.id, u.email)}
                                            disabled={resetSending[u.id]}
                                            icon={<KeyRound className="w-4 h-4" />}
                                        >
                                            {resetSending[u.id] ? "Sending…" : "Send Email Reset"}
                                        </RowActionMenuItem>
                                    )}
                                    {session && <RowActionMenuLabel>Session</RowActionMenuLabel>}
                                    {session && session.status !== "expired" && (
                                        <RowActionMenuItem
                                            onClick={() => handleGetLink(session.token, session.clientEmail)}
                                            disabled={loadingLink === session.token}
                                            icon={<LinkIcon className="w-4 h-4" />}
                                        >
                                            {loadingLink === session.token ? "Loading…" : "Get Session Link"}
                                        </RowActionMenuItem>
                                    )}
                                    {session && (
                                        <RowActionMenuItem
                                            onClick={() => handleRenewSession(session.token)}
                                            disabled={renewingSession === session.token}
                                            icon={<RotateCw className={`w-4 h-4 ${renewingSession === session.token ? "animate-spin" : ""}`} />}
                                        >
                                            Renew Session
                                        </RowActionMenuItem>
                                    )}
                                    {(session || u.pendingInvite || (canManageAccount && !u.isSelf && !u.isPlatformAdmin)) && (
                                        <RowActionMenuDivider />
                                    )}
                                    {session && (
                                        <RowActionMenuItem
                                            onClick={() => {
                                                setSessionToDelete({ token: session.token, clientName: session.clientName })
                                                setDeleteSessionModalOpen(true)
                                            }}
                                            icon={<Trash2 className="w-4 h-4" />}
                                            tone="danger"
                                        >
                                            Delete Session
                                        </RowActionMenuItem>
                                    )}
                                    {u.pendingInvite && (
                                        <RowActionMenuItem
                                            onClick={() => rescindInvite(u.pendingInvite!.id)}
                                            disabled={rescindingInvite === u.pendingInvite.id}
                                            icon={<Trash2 className="w-4 h-4" />}
                                        >
                                            Rescind Invite
                                        </RowActionMenuItem>
                                    )}
                                    {canManageAccount && !u.isSelf && !u.isPlatformAdmin && (
                                        <RowActionMenuItem onClick={() => deleteUser(u.id)} icon={<Trash2 className="w-4 h-4" />} tone="danger">
                                            Remove User
                                        </RowActionMenuItem>
                                    )}
                                </RowActionMenu>
                            )
                        },
                    },
                ]}
            />

            {error && <div className="mt-3 text-sm text-red-600">{error}</div>}

            <ConfirmActionModal
                isOpen={deleteModalOpen}
                title="Remove User"
                message={
                    <>
                        Are you sure you want to remove{" "}
                        <span className="font-semibold text-[#111827]">{userToDelete?.name || userToDelete?.email || ""}</span>? This action is permanent and cannot be undone. All associated data will be removed.
                        {deleteError && (
                            <span className="mt-3 block rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700">
                                {deleteError}
                            </span>
                        )}
                    </>
                }
                confirmLabel="Remove User"
                // Without this the confirm button stayed live through the request: a second click
                // sent a second DELETE, and the backdrop could dismiss the dialog mid-delete.
                busy={deletingUser}
                busyLabel="Removing…"
                onConfirm={confirmDeleteUser}
                onCancel={() => {
                    setDeleteModalOpen(false)
                    setUserToDelete(null)
                    setDeleteError("")
                }}
            />

            <PasswordResetModal
                isOpen={resetResult !== null}
                success={resetResult?.success ?? false}
                email={resetResult?.email ?? null}
                onClose={() => setResetResult(null)}
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

/** Result of sending a reset link — the same success/failure sheet the other one-shot actions use. */
const PasswordResetModal: React.FC<{
    isOpen: boolean
    success: boolean
    email: string | null
    onClose: () => void
}> = ({ isOpen, success, email, onClose }) => {
    if (!isOpen) return null

    return (
        <Modal
            zIndexClass="z-50"
            backdropClassName="bg-black/50 backdrop-blur-sm"
            cardClassName="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4"
            label="Password Reset"
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
                        <h3 className="text-xl font-semibold text-[#111827] mb-2">Reset Email Sent!</h3>
                        <p className={`text-sm text-[#6B7280] mb-6 ${inter.className}`}>
                            {email ? (
                                <>A password reset link is on its way to {email}.</>
                            ) : (
                                "A password reset link has been sent."
                            )}
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
                        <h3 className="text-xl font-semibold text-[#111827] mb-2">Failed To Send Reset Email</h3>
                        <p className={`text-sm text-[#6B7280] mb-6 ${inter.className}`}>
                            The reset link could not be sent. Please try again.
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
