"use client"

import React, { useCallback, useEffect, useMemo, useState, useRef } from "react"
import { Users, FileText, RefreshCw, AlertCircle, CheckCircle2, Timer, XCircle, ArrowUpDown, ChevronUp, ChevronDown, Eye, X } from "lucide-react"
import { FiSearch, FiFilter, FiPlus, FiBarChart2, FiTrash2 } from "react-icons/fi"

type ViewType = "users" | "sessions"

const AdminEditorSection = () => {
    const [currentView, setCurrentView] = useState<ViewType>("users")

    return (
        <div className="w-full h-full bg-white text-[#111014] flex flex-col">
            <div className="flex-1 flex justify-center px-6 pt-2">
                <div className="w-full max-w-6xl flex flex-col h-full">
                    {currentView === "users" ? (
                        <UsersPanel onManageSessions={() => setCurrentView("sessions")} />
                    ) : (
                        <SessionsPanel onBackToUsers={() => setCurrentView("users")} />
                    )}
                </div>
            </div>
        </div>
    )
}

export default AdminEditorSection

// ----- Users Panel -----

const ConfirmRemoveUserModal: React.FC<{
    isOpen: boolean
    userName: string
    onConfirm: () => void
    onCancel: () => void
}> = ({ isOpen, userName, onConfirm, onCancel }) => {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onCancel}>
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                        <FiTrash2 className="w-6 h-6 text-red-600" />
                    </div>
                    <h3 className="text-xl font-semibold text-[#111827]">Remove User</h3>
                </div>
                <p className="text-sm text-[#6B7280] mb-6">
                    Are you sure you want to remove <span className="font-semibold text-[#111827]">{userName}</span>? 
                    This action is permanent and cannot be undone. All associated data will be removed.
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
                        Remove User
                    </button>
                </div>
            </div>
        </div>
    )
}

type ListedUser = {
    id: number
    name: string | null
    email: string | null
    image: boolean
    role: string
    clientName: string | null
    hasPassword: boolean
}

function UsersPanel({ onManageSessions }: { onManageSessions: () => void }) {
    const [users, setUsers] = useState<ListedUser[]>([])
    const [loading, setLoading] = useState<boolean>(false)
    const [error, setError] = useState<string>("")
    const [showCreate, setShowCreate] = useState<boolean>(false)
    const [revealed, setRevealed] = useState<Record<number, string>>({})
    const [editingName, setEditingName] = useState<Record<number, string>>({})
    const [updatingNames, setUpdatingNames] = useState<Set<number>>(new Set())
    const [deleteModalOpen, setDeleteModalOpen] = useState<boolean>(false)
    const [userToDelete, setUserToDelete] = useState<{ id: number; name: string | null; email: string | null } | null>(null)
    const [searchQuery, setSearchQuery] = useState<string>("")
    const [currentPage, setCurrentPage] = useState<number>(0)
    const [showStats, setShowStats] = useState<boolean>(false)
    const [stats, setStats] = useState<{ users: number; clients: number; sessions: number; blogPosts: number } | null>(null)
    const [sessionLinks, setSessionLinks] = useState<Record<string, { link: string; loading: boolean }>>({})
    const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'staff' | 'client'>('all')
    const [isFilterOpen, setIsFilterOpen] = useState<boolean>(false)
    const pageSize = 10
    const filterRef = useRef<HTMLDivElement>(null)

    const load = async () => {
        setLoading(true)
        setError("")
        try {
            const r = await fetch("/api/admin/users")
            if (!r.ok) throw new Error("Failed to fetch users")
            setUsers(await r.json())
        } catch (e: any) {
            setError(e?.message || "Failed to load users")
        } finally {
            setLoading(false)
        }
    }

    const loadStats = useCallback(async () => {
        try {
            const r = await fetch("/api/admin/systemStats", { cache: "no-store" })
            if (!r.ok) throw new Error("Failed to load stats")
            setStats(await r.json())
        } catch {
            // ignore
        }
    }, [])

    useEffect(() => {
        load()
        loadStats()
    }, [loadStats])

    const revealPassword = async (userId: number) => {
        if (revealed[userId]) return
        try {
            const r = await fetch(`/api/admin/userPassword?id=${userId}`)
            if (!r.ok) return
            const data = await r.json()
            if (data?.password) {
                setRevealed((prev) => ({ ...prev, [userId]: data.password }))
            } else if (data?.error) {
                setRevealed((prev) => ({ ...prev, [userId]: data.error }))
            }
        } catch {}
    }

    const hidePassword = (userId: number) => {
        setRevealed((prev) => {
            const next = { ...prev }
            delete next[userId]
            return next
        })
    }

    const updateRole = async (userId: number, role: string) => {
        try {
            await fetch("/api/admin/users", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: userId, role }),
            })
            setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)))
        } catch {}
    }

    const updateName = async (userId: number, newName: string) => {
        setUpdatingNames(prev => new Set(prev).add(userId))
        try {
            await fetch("/api/admin/users", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: userId, name: newName }),
            })
            setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, name: newName } : u)))
            setEditingName(prev => {
                const newState = { ...prev }
                delete newState[userId]
                return newState
            })
        } catch {}
        finally {
            setUpdatingNames(prev => {
                const newSet = new Set(prev)
                newSet.delete(userId)
                return newSet
            })
        }
    }


    const deleteUser = async (userId: number) => {
        const user = users.find(u => u.id === userId)
        if (!user) return
        
        // Check if it's the protected email
        if (user.email?.toLowerCase() === "business@alexshick.com") {
            alert("This user cannot be removed.")
            return
        }
        
        setUserToDelete({ id: userId, name: user.name, email: user.email })
        setDeleteModalOpen(true)
    }

    const confirmDeleteUser = async () => {
        if (!userToDelete) return
        
        try {
            await fetch(`/api/admin/users?id=${userToDelete.id}`, { method: "DELETE" })
            setUsers((prev) => prev.filter((u) => u.id !== userToDelete.id))
            setDeleteModalOpen(false)
            setUserToDelete(null)
        } catch {}
    }

    const filteredUsers = useMemo(() => {
        let filtered = users
        
        // Filter by role
        if (roleFilter !== 'all') {
            filtered = filtered.filter(u => u.role === roleFilter)
        }
        
        // Filter by search query
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase()
            filtered = filtered.filter(u => 
                (u.name?.toLowerCase().includes(q)) ||
                (u.email?.toLowerCase().includes(q)) ||
                (u.clientName?.toLowerCase().includes(q)) ||
                (u.role?.toLowerCase().includes(q))
            )
        }
        
        return filtered
    }, [users, searchQuery, roleFilter])

    const paginatedUsers = filteredUsers.slice(currentPage * pageSize, (currentPage + 1) * pageSize)
    const totalPages = Math.ceil(filteredUsers.length / pageSize)

    return (
        <>
            <div className="w-full flex justify-between items-center mb-2">
                <div>
                    <h1 className="text-2xl font-semibold text-[#111827] mt-6 mb-6">User Management</h1>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 shadow-sm border border-transparent focus-within:ring-2 focus-within:ring-[#701CC0] transition">
                        <FiSearch className="w-4 h-4 text-[#701CC0] flex-shrink-0" />
                        <label htmlFor="users-search" className="sr-only">Search Users</label>
                        <input
                            id="users-search"
                            type="search"
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value)
                                setCurrentPage(0)
                            }}
                            placeholder="Search Users"
                            className="w-64 md:w-80 text-sm text-[#111827] placeholder:text-[#9CA3AF] bg-transparent outline-none"
                        />
                    </div>
                    <div className="relative" ref={filterRef} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsFilterOpen(false) }} tabIndex={-1}>
                        <button
                            type="button"
                            onClick={() => setIsFilterOpen((v) => !v)}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-sm text-[#374151] border border-[#E5E7EB] hover:bg-gray-50 hover:border-[#701CC0] transition-colors duration-200 shadow-sm"
                        >
                            <FiFilter className="w-4 h-4" />
                            <span className="text-sm font-medium">Filter</span>
                            <svg 
                                className={`w-4 h-4 transition-transform duration-200 ${isFilterOpen ? 'rotate-180' : ''}`}
                                fill="none" 
                                stroke="currentColor" 
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                        {isFilterOpen && (
                            <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-[#E5E7EB] py-4 z-50">
                                <div className="px-5">
                                    <h3 className="text-sm font-semibold text-[#111827] mb-4">Filter by Role</h3>
                                    
                                    {/* Role Filter */}
                                    <div className="mb-4">
                                        <label className="block text-xs font-medium text-[#6B7280] mb-2">Role</label>
                                        <div className="relative">
                                            <select
                                                value={roleFilter}
                                                onChange={(e) => {
                                                    setRoleFilter(e.target.value as 'all' | 'admin' | 'staff' | 'client')
                                                    setCurrentPage(0)
                                                }}
                                                className="w-full text-sm border border-[#E5E7EB] rounded-lg px-3 py-2 pr-10 bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#701CC0] focus:border-transparent appearance-none"
                                            >
                                                <option value="all">All Roles</option>
                                                <option value="admin">Admin</option>
                                                <option value="staff">Staff</option>
                                                <option value="client">Client</option>
                                            </select>
                                            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                                <svg className="w-4 h-4 text-[#6B7280]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    <button
                        onClick={() => setShowStats(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-sm text-[#374151] border border-[#E5E7EB] hover:bg-gray-50 hover:border-[#701CC0] transition-colors duration-200 shadow-sm"
                    >
                        <FiBarChart2 className="w-4 h-4" />
                        <span>Statistics</span>
                    </button>
                    <button
                        onClick={onManageSessions}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-sm text-[#374151] border border-[#E5E7EB] hover:bg-gray-50 hover:border-[#701CC0] transition-colors duration-200 shadow-sm"
                    >
                        <FileText size={16} />
                        Manage Sessions
                    </button>
                    <button
                        onClick={() => setShowCreate(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-[#701CC0] text-white rounded-lg hover:bg-[#5f17a5] text-sm font-medium"
                    >
                        <FiPlus className="w-4 h-4" />
                        Create User
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#701CC0] mx-auto"></div>
                        <p className="mt-2 text-sm text-[#6B7280]">Loading Users...</p>
                    </div>
                </div>
            ) : (
                <>
                    {!loading && filteredUsers.length === 0 && (
                        <div className="text-center py-12">
                            <p className="text-sm text-gray-500 mb-3">
                                {searchQuery ? "No users match your search." : "No users found."}
                            </p>
                            {!searchQuery && (
                                <button
                                    onClick={() => setShowCreate(true)}
                                    className="inline-flex items-center px-4 py-2 rounded-lg bg-[#701CC0] text-white text-sm hover:bg-[#5f17a5]"
                                >
                                    <FiPlus className="w-4 h-4 mr-2" />
                                    Create User
                                </button>
                            )}
                        </div>
                    )}

                    {!loading && filteredUsers.length > 0 && (
                        <div className="bg-white rounded-lg shadow-sm border border-[#E5E7EB] overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-[#6B7280] uppercase tracking-wider">ID</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-[#6B7280] uppercase tracking-wider">Name</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-[#6B7280] uppercase tracking-wider">Email</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-[#6B7280] uppercase tracking-wider">Password</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-[#6B7280] uppercase tracking-wider">Role</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-[#6B7280] uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-[#E5E7EB]">
                                        {paginatedUsers.map((u) => {
                                            const masked = revealed[u.id] ? revealed[u.id] : (u.hasPassword ? "••••••••" : "N/A")
                                            return (
                                                <tr key={u.id} className="hover:bg-purple-50">
                                                    <td className="px-4 py-4 text-sm text-[#111827]">{u.id}</td>
                                                    <td className="px-4 py-4">
                                                        <div className="flex items-center gap-2">
                                                            {editingName[u.id] !== undefined ? (
                                                                <div className="flex items-center gap-1">
                                                                    <input
                                                                        type="text"
                                                                        value={editingName[u.id]}
                                                                        onChange={(e) => setEditingName(prev => ({ ...prev, [u.id]: e.target.value }))}
                                                                        className="border rounded px-2 py-1 text-sm w-32"
                                                                        autoFocus
                                                                    />
                                                                    <button
                                                                        onClick={() => updateName(u.id, editingName[u.id])}
                                                                        disabled={updatingNames.has(u.id)}
                                                                        className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 disabled:opacity-50"
                                                                    >
                                                                        {updatingNames.has(u.id) ? "..." : "✓"}
                                                                    </button>
                                                                    <button
                                                                        onClick={() => setEditingName(prev => {
                                                                            const newState = { ...prev }
                                                                            delete newState[u.id]
                                                                            return newState
                                                                        })}
                                                                        className="px-2 py-1 bg-gray-500 text-white rounded text-xs hover:bg-gray-600"
                                                                    >
                                                                        ✕
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center gap-1">
                                                                    <span className="text-sm font-medium text-[#111827]">{u.name ?? "-"}</span>
                                                                    <button
                                                                        onClick={() => setEditingName(prev => ({ ...prev, [u.id]: u.name || "" }))}
                                                                        className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs hover:bg-gray-200"
                                                                    >
                                                                        Edit
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4 text-sm text-[#111827]">{u.email ?? "-"}</td>
                                                    <td className="px-4 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-sm text-[#6B7280] font-mono">{masked}</span>
                                                            {u.hasPassword && !revealed[u.id] && (
                                                                <button onClick={() => revealPassword(u.id)} className="px-2 py-1 rounded-md text-xs bg-gray-100 hover:bg-gray-200 text-[#374151]">Reveal</button>
                                                            )}
                                                            {revealed[u.id] && (
                                                                <button onClick={() => hidePassword(u.id)} className="px-2 py-1 rounded-md text-xs bg-gray-100 hover:bg-gray-200 text-[#374151]">Hide</button>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        <select 
                                                            value={u.role === "user" ? "admin" : (u.role || "admin")} 
                                                            onChange={(e) => updateRole(u.id, e.target.value)} 
                                                            className="text-sm border border-[#E5E7EB] rounded-md pl-2 pr-[5px] mr-10 py-0.5 bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#701CC0]"
                                                        >
                                                            <option value="admin">Admin</option>
                                                            <option value="staff">Staff</option>
                                                            <option value="client">Client</option>
                                                        </select>
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        <div className="flex items-center gap-2">
                                                            <button 
                                                                onClick={() => deleteUser(u.id)} 
                                                                disabled={u.email?.toLowerCase() === "business@alexshick.com"}
                                                                className="inline-flex items-center gap-1 px-3 py-1 rounded-md text-xs bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                                            >
                                                                Remove
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {!loading && filteredUsers.length > 0 && totalPages > 1 && (
                        <div className="mt-4 pt-4 text-xs text-[#677489]">
                            <div className="w-full flex items-center justify-center">
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                                        disabled={currentPage === 0}
                                        className="px-3 py-1 rounded-md border border-[#E5E7EB] bg-white text-[#374151] hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        Previous
                                    </button>
                                    <span className="px-3 py-1 text-[#6B7280]">
                                        Page {currentPage + 1} of {totalPages}
                                    </span>
                                    <button
                                        onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
                                        disabled={currentPage >= totalPages - 1}
                                        className="px-3 py-1 rounded-md border border-[#E5E7EB] bg-white text-[#374151] hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}

            {error && <div className="mt-3 text-sm text-red-600">{error}</div>}

            {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />}

            <ConfirmRemoveUserModal
                isOpen={deleteModalOpen}
                userName={userToDelete?.name || userToDelete?.email || ""}
                onConfirm={confirmDeleteUser}
                onCancel={() => {
                    setDeleteModalOpen(false)
                    setUserToDelete(null)
                }}
            />

            {showStats && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[200] p-4" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) setShowStats(false) }}>
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md border border-[#E5E7EB] relative" onClick={(e) => e.stopPropagation()}>
                        <button 
                            onClick={() => setShowStats(false)} 
                            className="absolute top-4 right-4 text-[#6B7280] hover:text-red-500 transition-colors z-10"
                            aria-label="Close modal"
                        >
                            <X size={24} />
                        </button>
                        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB]">
                            <div className="text-xl font-semibold text-[#111827]">System Statistics</div>
                        </div>
                        <div className="p-6 space-y-3">
                            <div className="flex justify-between items-center py-2 border-b border-[#F3F4F6]">
                                <span className="text-sm text-[#6B7280]">Total Users</span>
                                <span className="text-sm font-semibold text-[#111827]">{stats?.users ?? "-"}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-[#F3F4F6]">
                                <span className="text-sm text-[#6B7280]">Total Clients</span>
                                <span className="text-sm font-semibold text-[#111827]">{stats?.clients ?? "-"}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-[#F3F4F6]">
                                <span className="text-sm text-[#6B7280]">Total Sessions</span>
                                <span className="text-sm font-semibold text-[#111827]">{stats?.sessions ?? "-"}</span>
                            </div>
                            <div className="flex justify-between items-center py-2">
                                <span className="text-sm text-[#6B7280]">Blog Posts</span>
                                <span className="text-sm font-semibold text-[#111827]">{stats?.blogPosts ?? "-"}</span>
                            </div>
                        </div>
                        <div className="px-6 pb-6 pt-2">
                            <button onClick={() => setShowStats(false)} className="w-full px-4 py-2 rounded-lg bg-[#701CC0] text-white hover:bg-[#5f17a5] transition-colors text-sm font-medium">
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}

function CreateUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
    const [name, setName] = useState<string>("")
    const [email, setEmail] = useState<string>("")
    const [password, setPassword] = useState<string>("")
    const [role, setRole] = useState<string>("admin")
    const [submitting, setSubmitting] = useState<boolean>(false)
    const [error, setError] = useState<string>("")

    const submit = async () => {
        setSubmitting(true)
        setError("")
        try {
            const r = await fetch("/api/admin/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, email, password, role }),
            })
            if (!r.ok) throw new Error((await r.json())?.message || "Failed to create user")
            onCreated()
        } catch (e: any) {
            setError(e?.message || "Failed to create user")
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl text-gray-900">
                <div className="flex items-center justify-between px-6 py-4 border-b">
                    <div className="text-xl font-semibold">Create New User</div>
                    <button onClick={onClose} className="text-gray-600 hover:text-black">Close</button>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (optional)" className="w-full border rounded-md px-3 py-2" />
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full border rounded-md px-3 py-2" />
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="w-full border rounded-md px-3 py-2" />
                    <select value={role} onChange={(e) => setRole(e.target.value)} className="w-full border rounded-md px-3 py-2">
                        <option value="admin">Admin</option>
                        <option value="staff">Staff</option>
                        <option value="client">Client</option>
                    </select>
                </div>
                {error && <div className="px-6 pb-2 text-sm text-red-600">{error}</div>}
                <div className="px-6 pb-6">
                    <button disabled={submitting} onClick={submit} className="inline-flex items-center gap-2 bg-black text-white px-4 py-2 rounded-lg disabled:opacity-60">
                        {submitting ? "Creating..." : "Create User"}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ----- Sessions Panel -----

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

// ----- Sessions Panel -----

function SessionsPanel({ onBackToUsers }: { onBackToUsers: () => void }) {
    const [sessions, setSessions] = useState<SessionRow[]>([])
    const [loading, setLoading] = useState<boolean>(false)
    const [error, setError] = useState<string>("")
    const [searchQuery, setSearchQuery] = useState<string>("")
    const [currentPage, setCurrentPage] = useState<number>(0)
    const [expiring, setExpiring] = useState<boolean>(false)
    const [expireMessage, setExpireMessage] = useState<string>("")
    const [sessionLinks, setSessionLinks] = useState<Record<string, { link: string; loading: boolean }>>({})
    const pageSize = 10
    const [sortKey, setSortKey] = useState<"client" | "business" | "status" | "created" | "updated" | "platforms">("created")
    const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")

    const load = async () => {
        setLoading(true)
        setError("")
        try {
            const r = await fetch("/api/session/listClientSessions")
            if (!r.ok) throw new Error(`Failed to fetch (${r.status})`)
            const data = await r.json()
            setSessions(Array.isArray(data) ? data : [])
        } catch (e: any) {
            setError(e?.message || "Failed to load sessions")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
    }, [])

    const statusOrder = useMemo<Record<SessionStatus, number>>(() => ({
        pending: 1,
        in_progress: 2,
        completed: 3,
        expired: 4,
        canceled: 5,
    }), [])

    const sorted = useMemo(() => {
        const arr = [...sessions]
        const cmp = (a: SessionRow, b: SessionRow) => {
            let v = 0
            if (sortKey === "client") {
                v = a.clientName.localeCompare(b.clientName, undefined, { sensitivity: "base" })
            } else if (sortKey === "business") {
                v = a.businessName.localeCompare(b.businessName, undefined, { sensitivity: "base" })
            } else if (sortKey === "status") {
                v = (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99)
            } else if (sortKey === "created") {
                v = a.createdAt - b.createdAt
            } else if (sortKey === "updated") {
                const av = a.lastUpdatedAt ?? -Infinity
                const bv = b.lastUpdatedAt ?? -Infinity
                v = av - bv
            } else if (sortKey === "platforms") {
                const ac = a.platforms ? a.platforms.length : 0
                const bc = b.platforms ? b.platforms.length : 0
                v = ac - bc
            }
            return sortDir === "asc" ? v : -v
        }
        arr.sort(cmp)
        return arr
    }, [sessions, sortKey, sortDir, statusOrder])

    const toggleSort = (key: typeof sortKey) => {
        if (key === sortKey) {
            setSortDir((d) => (d === "asc" ? "desc" : "asc"))
        } else {
            setSortKey(key)
            setSortDir(key === "created" || key === "updated" ? "desc" : "asc")
        }
    }

    const SortIcon = ({ active, dir }: { active: boolean; dir: "asc" | "desc" }) => {
        if (!active) return <ArrowUpDown size={14} className="text-gray-400" />
        return dir === "asc" ? <ChevronUp size={14} /> : <ChevronDown size={14} />
    }


    const formatDate = (ts?: number | null) => {
        if (!ts) return "N/A"
        const d = new Date(ts)
        return d.toLocaleDateString(undefined, { year: "numeric", month: "2-digit", day: "2-digit" })
    }

    const statusBadge = (status: SessionStatus) => {
        const common = "inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium"
        switch (status) {
            case "pending":
                return (
                    <span className={`${common} bg-yellow-50 text-yellow-700 border border-yellow-200`}>
                        <AlertCircle size={14} /> pending
                    </span>
                )
            case "in_progress":
                return (
                    <span className={`${common} bg-blue-50 text-blue-700 border border-blue-200`}>
                        <Timer size={14} /> in&nbsp;progress
                    </span>
                )
            case "completed":
                return (
                    <span className={`${common} bg-green-50 text-green-700 border border-green-200`}>
                        <CheckCircle2 size={14} /> completed
                    </span>
                )
            case "expired":
                return (
                    <span className={`${common} bg-red-50 text-red-700 border border-red-200`}>
                        <XCircle size={14} /> expired
                    </span>
                )
            default:
                return <span className={`${common} bg-gray-100 text-gray-600 border border-gray-200`}>canceled</span>
        }
    }

    const [showAnswers, setShowAnswers] = useState<{ open: boolean; json: any; client?: { name: string; email: string; businessName: string } } | null>(null)

    const expireSessions = useCallback(async () => {
        try {
            setExpiring(true)
            setExpireMessage("")
            const r = await fetch("/api/admin/expireSessions", { method: "POST" })
            const j = await r.json()
            setExpireMessage(`Updated ${j.updated ?? 0} sessions`)
            await load()
        } catch {
            setExpireMessage("Failed to update sessions")
        } finally {
            setExpiring(false)
        }
    }, [])

    const getSessionLink = async (token: string, clientEmail: string): Promise<string | null> => {
        if (!token || !clientEmail) return null
        const key = `${token}-${clientEmail}`
        setSessionLinks(prev => ({ ...prev, [key]: { link: "", loading: true } }))
        try {
            const r = await fetch(`/api/admin/getClientSessionLink?clientEmail=${encodeURIComponent(clientEmail)}`)
            if (!r.ok) throw new Error("Failed to get session link")
            const data = await r.json()
            const fullLink = data.link.startsWith('http') ? data.link : `${window.location.origin}${data.link}`
            setSessionLinks(prev => ({ ...prev, [key]: { link: fullLink, loading: false } }))
            return fullLink
        } catch (e: any) {
            setSessionLinks(prev => ({ ...prev, [key]: { link: "", loading: false } }))
            alert("Failed to get session link: " + (e?.message || "Unknown error"))
            return null
        }
    }

    const openAnswers = async (token: string) => {
        try {
            const r = await fetch(`/api/admin/sessionAnswers?token=${encodeURIComponent(token)}`)
            if (!r.ok) throw new Error("Failed to fetch answers")
            const data = await r.json()
            setShowAnswers({ open: true, json: data?.answers ?? {}, client: data?.client })
        } catch {
            setShowAnswers({ open: true, json: { error: "Could not load answers" } })
        }
    }

    const filteredSessions = useMemo(() => {
        if (!searchQuery.trim()) return sorted
        const q = searchQuery.toLowerCase()
        return sorted.filter(s => 
            s.clientName.toLowerCase().includes(q) ||
            s.clientEmail.toLowerCase().includes(q) ||
            s.businessName.toLowerCase().includes(q) ||
            s.status.toLowerCase().includes(q)
        )
    }, [sorted, searchQuery])

    const paginatedSessions = filteredSessions.slice(currentPage * pageSize, (currentPage + 1) * pageSize)
    const totalPages = Math.ceil(filteredSessions.length / pageSize)

    return (
        <>
            <div className="w-full flex justify-between items-center mb-2">
                <div>
                    <h1 className="text-2xl font-semibold text-[#111827] mt-6 mb-6">Sessions</h1>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 shadow-sm border border-transparent focus-within:ring-2 focus-within:ring-[#701CC0] transition">
                        <FiSearch className="w-4 h-4 text-[#701CC0] flex-shrink-0" />
                        <label htmlFor="sessions-search" className="sr-only">Search Sessions</label>
                        <input
                            id="sessions-search"
                            type="search"
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value)
                                setCurrentPage(0)
                            }}
                            placeholder="Search Sessions"
                            className="w-64 md:w-80 text-sm text-[#111827] placeholder:text-[#9CA3AF] bg-transparent outline-none"
                        />
                    </div>
                    <button
                        onClick={expireSessions}
                        disabled={expiring}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-sm text-[#374151] border border-[#E5E7EB] hover:bg-gray-50 hover:border-[#701CC0] transition-colors duration-200 shadow-sm disabled:opacity-60"
                    >
                        <RefreshCw size={16} className={expiring ? "animate-spin" : ""} />
                        <span>Update Expired Sessions</span>
                    </button>
                    <button
                        onClick={onBackToUsers}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-sm text-[#374151] border border-[#E5E7EB] hover:bg-gray-50 hover:border-[#701CC0] transition-colors duration-200 shadow-sm"
                    >
                        <Users size={16} />
                        <span>Back to Users</span>
                    </button>
                </div>
            </div>

            {expireMessage && (
                <div className={`px-4 py-2 rounded-lg text-sm ${expireMessage.includes("Failed") ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
                    {expireMessage}
                </div>
            )}

            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#701CC0] mx-auto"></div>
                        <p className="mt-2 text-sm text-[#6B7280]">Loading Sessions...</p>
                    </div>
                </div>
            ) : (
                <>
                    {!loading && filteredSessions.length === 0 && (
                        <div className="text-center py-12">
                            <p className="text-sm text-gray-500 mb-3">
                                {searchQuery ? "No sessions match your search." : "No sessions found."}
                            </p>
                        </div>
                    )}

                    {!loading && filteredSessions.length > 0 && (
                        <div className="bg-white rounded-lg shadow-sm border border-[#E5E7EB] overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-[#6B7280] uppercase tracking-wider">
                                                <button onClick={() => toggleSort("client")} className="inline-flex items-center gap-1 hover:text-black">
                                                    <span>Client</span>
                                                    <SortIcon active={sortKey === "client"} dir={sortDir} />
                                                </button>
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-[#6B7280] uppercase tracking-wider">
                                                <button onClick={() => toggleSort("business")} className="inline-flex items-center gap-1 hover:text-black">
                                                    <span>Business</span>
                                                    <SortIcon active={sortKey === "business"} dir={sortDir} />
                                                </button>
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-[#6B7280] uppercase tracking-wider">
                                                <button onClick={() => toggleSort("status")} className="inline-flex items-center gap-1 hover:text-black">
                                                    <span>Status</span>
                                                    <SortIcon active={sortKey === "status"} dir={sortDir} />
                                                </button>
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-[#6B7280] uppercase tracking-wider">
                                                <button onClick={() => toggleSort("created")} className="inline-flex items-center gap-1 hover:text-black">
                                                    <span>Created</span>
                                                    <SortIcon active={sortKey === "created"} dir={sortDir} />
                                                </button>
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-[#6B7280] uppercase tracking-wider">
                                                <button onClick={() => toggleSort("updated")} className="inline-flex items-center gap-1 hover:text-black">
                                                    <span>Last Updated</span>
                                                    <SortIcon active={sortKey === "updated"} dir={sortDir} />
                                                </button>
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-[#6B7280] uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-[#E5E7EB]">
                                        {paginatedSessions.map((s) => {
                                            const linkKey = `${s.token}-${s.clientEmail}`
                                            const sessionLink = sessionLinks[linkKey]
                                            const isPending = s.status === "pending" || s.status === "in_progress"
                                            return (
                                                <tr key={s.token} className="hover:bg-purple-50">
                                                    <td className="px-4 py-4">
                                                        <div className="flex flex-col">
                                                            <div className="text-sm font-medium text-[#111827]">{s.clientName}</div>
                                                            <div className="text-sm text-[#6B7280]">{s.clientEmail}</div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4 text-sm text-[#111827]">{s.businessName}</td>
                                                    <td className="px-4 py-4">
                                                        {statusBadge(s.status)}
                                                    </td>
                                                    <td className="px-4 py-4 text-sm text-[#111827]">{formatDate(s.createdAt)}</td>
                                                    <td className="px-4 py-4 text-sm text-[#111827]">{formatDate(s.lastUpdatedAt)}</td>
                                                    <td className="px-4 py-4">
                                                        <div className="flex items-center gap-2">
                                                            {isPending && (
                                                                <button
                                                                    onClick={async () => {
                                                                        if (sessionLink?.link) {
                                                                            try {
                                                                                await navigator.clipboard.writeText(sessionLink.link)
                                                                                alert("Session link copied to clipboard!")
                                                                            } catch {
                                                                                alert("Failed to copy link")
                                                                            }
                                                                        } else {
                                                                            const link = await getSessionLink(s.token, s.clientEmail)
                                                                            if (link) {
                                                                                try {
                                                                                    await navigator.clipboard.writeText(link)
                                                                                    alert("Session link copied to clipboard!")
                                                                                } catch {
                                                                                    alert("Link retrieved but failed to copy")
                                                                                }
                                                                            }
                                                                        }
                                                                    }}
                                                                    disabled={sessionLink?.loading}
                                                                    className="text-xs text-[#701CC0] hover:text-[#5a1799] underline disabled:opacity-50"
                                                                >
                                                                    {sessionLink?.loading ? "Loading..." : sessionLink?.link ? "Copy Link" : "Get Link"}
                                                                </button>
                                                            )}
                                                            {s.status === "completed" && (
                                                                <button
                                                                    onClick={() => openAnswers(s.token)}
                                                                    className="inline-flex items-center gap-1 px-3 py-1 rounded-md text-xs bg-[#701CC0] text-white hover:bg-[#5a1799]"
                                                                >
                                                                    <Eye size={14} /> View
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {!loading && filteredSessions.length > 0 && totalPages > 1 && (
                        <div className="mt-4 pt-4 text-xs text-[#677489]">
                            <div className="w-full flex items-center justify-center">
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                                        disabled={currentPage === 0}
                                        className="px-3 py-1 rounded-md border border-[#E5E7EB] bg-white text-[#374151] hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        Previous
                                    </button>
                                    <span className="px-3 py-1 text-[#6B7280]">
                                        Page {currentPage + 1} of {totalPages}
                                    </span>
                                    <button
                                        onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
                                        disabled={currentPage >= totalPages - 1}
                                        className="px-3 py-1 rounded-md border border-[#E5E7EB] bg-white text-[#374151] hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}

            {error && <div className="mt-3 text-sm text-red-600">{error}</div>}

            {showAnswers?.open && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
                    <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[80vh] overflow-auto text-gray-900">
                        <div className="flex items-center justify-between px-5 py-3 border-b">
                            <div>
                                <div className="text-lg font-semibold">Client Responses</div>
                                {showAnswers?.client && (
                                    <div className="text-sm text-gray-500">{showAnswers.client.name} • {showAnswers.client.email} • {showAnswers.client.businessName}</div>
                                )}
                            </div>
                            <button className="text-gray-600 hover:text-black" onClick={() => setShowAnswers(null)}>Close</button>
                        </div>
                        <div className="p-5">
                            <pre className="text-sm font-mono text-gray-800 whitespace-pre-wrap break-words bg-gray-50 p-4 rounded border border-gray-200">{JSON.stringify(showAnswers.json, null, 2)}</pre>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
