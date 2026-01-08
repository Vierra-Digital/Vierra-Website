"use client"

import React, { useCallback, useEffect, useMemo, useState, useRef } from "react"
import { Users, FileText, RefreshCw, AlertCircle, CheckCircle2, Timer, XCircle, ArrowUpDown, ChevronUp, ChevronDown, Eye, X, Check, XIcon as XIconLucide, MoreVertical, Copy, Trash2, RotateCw, Link as LinkIcon } from "lucide-react"
import { FiCheck } from "react-icons/fi"
import { FiSearch, FiFilter, FiPlus, FiTrash2, FiEdit2 } from "react-icons/fi"
import { Inter } from "next/font/google"
import Image from "next/image"
import { motion } from "framer-motion"

const inter = Inter({ subsets: ["latin"] })

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
    const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'staff' | 'client'>('all')
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
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

    useEffect(() => {
        load()
    }, [])

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
        
        // Sort by ID in the specified direction
        const sorted = [...filtered].sort((a, b) => {
            const comparison = a.id - b.id
            return sortDir === 'asc' ? comparison : -comparison
        })
        
        return sorted
    }, [users, searchQuery, roleFilter, sortDir])

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
                                    <h3 className="text-sm font-semibold text-[#111827] mb-4">Filter & Sort</h3>
                                    
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

                                    {/* Sort Direction */}
                                    <div>
                                        <label className="block text-xs font-medium text-[#6B7280] mb-2">Order</label>
                                        <div className="relative">
                                            <select
                                                value={sortDir}
                                                onChange={(e) => {
                                                    setSortDir(e.target.value as 'asc' | 'desc')
                                                    setCurrentPage(0)
                                                }}
                                                className="w-full text-sm border border-[#E5E7EB] rounded-lg px-3 py-2 pr-10 bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#701CC0] focus:border-transparent appearance-none"
                                            >
                                                <option value="asc">Ascending</option>
                                                <option value="desc">Descending</option>
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
                            <div className="w-full h-full flex flex-col items-center justify-center text-center">
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ duration: 0.5, ease: "easeOut" }}
                                >
                                    <Image 
                                        src="/assets/no-client.png" 
                                        alt="No users" 
                                        width={224} 
                                        height={224} 
                                        className="w-56 h-auto mb-3" 
                                    />
                                </motion.div>
                                <p className="text-sm text-gray-500 mb-3">
                                    {searchQuery ? "No users match your search." : "No users found."}
                                </p>
                                <button
                                    onClick={() => setShowCreate(true)}
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#701CC0] text-white text-sm font-medium hover:bg-[#5f17a5] transition-colors duration-200 shadow-sm"
                                >
                                    <FiPlus className="w-4 h-4" />
                                    Create User
                                </button>
                            </div>
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
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="text"
                                                        value={editingName[u.id]}
                                                        onChange={(e) => setEditingName(prev => ({ ...prev, [u.id]: e.target.value }))}
                                                        className="border border-[#E5E7EB] rounded-md px-3 py-1.5 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-[#701CC0] focus:border-transparent"
                                                        autoFocus
                                                    />
                                                    <button
                                                        onClick={() => updateName(u.id, editingName[u.id])}
                                                        disabled={updatingNames.has(u.id)}
                                                        className="flex items-center justify-center w-8 h-8 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 shadow-sm"
                                                        aria-label="Save name"
                                                    >
                                                        {updatingNames.has(u.id) ? (
                                                            <RefreshCw className="w-4 h-4 animate-spin" />
                                                        ) : (
                                                            <Check className="w-4 h-4" />
                                                        )}
                                                    </button>
                                                    <button
                                                        onClick={() => setEditingName(prev => {
                                                            const newState = { ...prev }
                                                            delete newState[u.id]
                                                            return newState
                                                        })}
                                                        className="flex items-center justify-center w-8 h-8 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors duration-200 shadow-sm"
                                                        aria-label="Cancel editing"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-medium text-[#111827]">{u.name ?? "-"}</span>
                                                    <button
                                                        onClick={() => setEditingName(prev => ({ ...prev, [u.id]: u.name || "" }))}
                                                        className="flex items-center justify-center gap-1.5 px-2.5 py-1 bg-[#701CC0] text-white rounded-md text-xs font-medium hover:bg-[#5f17a5] transition-colors duration-200 shadow-sm"
                                                        aria-label="Edit name"
                                                    >
                                                        <FiEdit2 className="w-3 h-3" />
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
        if (!email.trim() || !password.trim()) {
            setError("Email and password are required")
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
            onCreated()
        } catch (e: any) {
            setError(e?.message || "Failed to create user")
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[200] p-4" 
            role="dialog" 
            aria-modal="true"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose()
            }}
        >
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md border border-[#E5E7EB]" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-[#E5E7EB]">
                    <div>
                        <h2 className="text-xl font-semibold text-[#111827]">Create New User</h2>
                        <p className="text-sm text-[#6B7280] mt-1">Add a new user to the system</p>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="text-[#6B7280] hover:text-[#111827] transition-colors duration-200 p-1 rounded-md hover:bg-gray-100"
                        aria-label="Close modal"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <div className="p-6 space-y-5">
                    {/* Name Field */}
                    <div>
                        <label htmlFor="create-user-name" className="block text-sm font-medium text-[#374151] mb-1.5">
                            Name <span className="text-[#9CA3AF]">(optional)</span>
                        </label>
                        <input 
                            id="create-user-name"
                            type="text" 
                            value={name} 
                            onChange={(e) => setName(e.target.value)} 
                            placeholder="Enter user's full name"
                            className="w-full border border-[#E5E7EB] rounded-lg px-4 py-2.5 text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#701CC0] focus:border-transparent transition-colors"
                        />
                    </div>

                    {/* Email Field */}
                    <div>
                        <label htmlFor="create-user-email" className="block text-sm font-medium text-[#374151] mb-1.5">
                            Email <span className="text-red-500">*</span>
                        </label>
                        <input 
                            id="create-user-email"
                            type="email" 
                            value={email} 
                            onChange={(e) => setEmail(e.target.value)} 
                            placeholder="user@example.com"
                            required
                            className="w-full border border-[#E5E7EB] rounded-lg px-4 py-2.5 text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#701CC0] focus:border-transparent transition-colors"
                        />
                    </div>

                    {/* Password Field */}
                    <div>
                        <label htmlFor="create-user-password" className="block text-sm font-medium text-[#374151] mb-1.5">
                            Password <span className="text-red-500">*</span>
                        </label>
                        <input 
                            id="create-user-password"
                            type="password" 
                            value={password} 
                            onChange={(e) => setPassword(e.target.value)} 
                            placeholder="Enter secure password"
                            required
                            className="w-full border border-[#E5E7EB] rounded-lg px-4 py-2.5 text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#701CC0] focus:border-transparent transition-colors"
                        />
                    </div>

                    {/* Role Field */}
                    <div>
                        <label htmlFor="create-user-role" className="block text-sm font-medium text-[#374151] mb-1.5">
                            Role <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                            <select 
                                id="create-user-role"
                                value={role} 
                                onChange={(e) => setRole(e.target.value)} 
                                className="w-full border border-[#E5E7EB] rounded-lg px-4 py-2.5 pr-10 text-sm text-[#111827] bg-white focus:outline-none focus:ring-2 focus:ring-[#701CC0] focus:border-transparent appearance-none transition-colors"
                            >
                                <option value="admin">Admin</option>
                                <option value="staff">Staff</option>
                                <option value="client">Client</option>
                            </select>
                            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                <ChevronDown className="w-5 h-5 text-[#6B7280]" />
                            </div>
                        </div>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-start gap-2">
                            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-red-700">{error}</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-gray-50 border-t border-[#E5E7EB] rounded-b-xl flex items-center justify-end gap-3">
                    <button 
                        onClick={onClose}
                        disabled={submitting}
                        className="px-4 py-2 text-sm font-medium text-[#374151] bg-white border border-[#E5E7EB] rounded-lg hover:bg-gray-50 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Cancel
                    </button>
                    <button 
                        disabled={submitting || !email.trim() || !password.trim()} 
                        onClick={submit} 
                        className="inline-flex items-center gap-2 px-4 py-2 bg-[#701CC0] text-white rounded-lg hover:bg-[#5f17a5] text-sm font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
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
    const [showUpdateSessionsModal, setShowUpdateSessionsModal] = useState<boolean>(false)
    const [updateSessionsSuccess, setUpdateSessionsSuccess] = useState<boolean>(false)
    const [updatedCount, setUpdatedCount] = useState<number>(0)
    const [statusFilter, setStatusFilter] = useState<'all' | SessionStatus>('all')
    const [isStatusFilterOpen, setIsStatusFilterOpen] = useState<boolean>(false)
    const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null)
    const [actionMenuPosition, setActionMenuPosition] = useState<{ top: number; right: number; showAbove: boolean } | null>(null)
    const [deletingSession, setDeletingSession] = useState<string | null>(null)
    const [deleteModalOpen, setDeleteModalOpen] = useState<boolean>(false)
    const [sessionToDelete, setSessionToDelete] = useState<{ token: string; clientName: string } | null>(null)
    const [renewingSession, setRenewingSession] = useState<string | null>(null)
    const [getLinkModalOpen, setGetLinkModalOpen] = useState<boolean>(false)
    const [copiedLink, setCopiedLink] = useState<string | null>(null)
    const [renewModalOpen, setRenewModalOpen] = useState<boolean>(false)
    const [renewSuccess, setRenewSuccess] = useState<boolean>(false)
    const statusFilterRef = useRef<HTMLDivElement>(null)
    const actionMenuRefs = useRef<Record<string, HTMLDivElement | null>>({})
    const actionMenuButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({})
    const updateSessionsModalRef = useRef<HTMLDivElement>(null)
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
                        <AlertCircle size={14} /> Not Started
                    </span>
                )
            case "in_progress":
                return (
                    <span className={`${common} bg-blue-50 text-blue-700 border border-blue-200`}>
                        <Timer size={14} /> In Progress
                    </span>
                )
            case "completed":
                return (
                    <span className={`${common} bg-green-50 text-green-700 border border-green-200`}>
                        <CheckCircle2 size={14} /> Completed
                    </span>
                )
            case "expired":
                return (
                    <span className={`${common} bg-red-50 text-red-700 border border-red-200`}>
                        <XCircle size={14} /> Expired
                    </span>
                )
            default:
                return <span className={`${common} bg-gray-100 text-gray-600 border border-gray-200`}>Canceled</span>
        }
    }

    const [showAnswers, setShowAnswers] = useState<{ open: boolean; json: any; client?: { name: string; email: string; businessName: string } } | null>(null)

    const expireSessions = useCallback(async () => {
        try {
            setExpiring(true)
            setExpireMessage("")
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

    const handleGetLink = async (token: string, clientEmail: string) => {
        const link = await getSessionLink(token, clientEmail)
        if (link) {
            try {
                await navigator.clipboard.writeText(link)
                setCopiedLink(link)
                setGetLinkModalOpen(true)
            } catch {
                setCopiedLink(link)
                setGetLinkModalOpen(true)
            }
        } else {
            setCopiedLink(null)
            setGetLinkModalOpen(true)
        }
        setActionMenuOpen(null)
    }

    const handleRenewSession = async (token: string) => {
        setRenewingSession(token)
        try {
            const r = await fetch("/api/admin/renewSession", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token }),
            })
            if (!r.ok) {
                const data = await r.json()
                throw new Error(data.message || "Failed to renew session")
            }
            setRenewSuccess(true)
            setRenewModalOpen(true)
            await load()
        } catch (e: any) {
            setRenewSuccess(false)
            setRenewModalOpen(true)
        } finally {
            setRenewingSession(null)
            setActionMenuOpen(null)
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
                const data = await r.json()
                throw new Error(data.message || "Failed to delete session")
            }
            setExpireMessage("Session Deleted Successfully!")
            setDeleteModalOpen(false)
            setSessionToDelete(null)
            await load()
        } catch (e: any) {
            setExpireMessage("Failed To Delete Session: " + (e?.message || "Unknown Error"))
        } finally {
            setDeletingSession(null)
            setActionMenuOpen(null)
        }
    }

    const openDeleteModal = (token: string, clientName: string) => {
        setSessionToDelete({ token, clientName })
        setDeleteModalOpen(true)
        setActionMenuOpen(null)
    }

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            Object.entries(actionMenuRefs.current).forEach(([token, ref]) => {
                if (ref && !ref.contains(event.target as Node)) {
                    if (actionMenuOpen === token) {
                        setActionMenuOpen(null)
                        setActionMenuPosition(null)
                    }
                }
            })
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [actionMenuOpen])

    useEffect(() => {
        if (actionMenuOpen) {
            const button = actionMenuButtonRefs.current[actionMenuOpen]
            if (button) {
                const rect = button.getBoundingClientRect()
                const dropdownHeight = 150 // Approximate height
                const viewportHeight = window.innerHeight
                const viewportMiddle = viewportHeight / 2
                
                // Show below if in first half of page, above if in bottom half
                const showAbove = rect.top > viewportMiddle
                
                setActionMenuPosition({
                    top: showAbove ? rect.top - dropdownHeight - 2 : rect.bottom + 2,
                    right: window.innerWidth - rect.right,
                    showAbove
                })
            }
        } else {
            setActionMenuPosition(null)
        }
    }, [actionMenuOpen])

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
        let filtered = sorted
        
        // Filter by status
        if (statusFilter !== 'all') {
            filtered = filtered.filter(s => s.status === statusFilter)
        }
        
        // Filter by search query
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase()
            filtered = filtered.filter(s => {
                const statusDisplay = s.status === "pending" ? "not started" : s.status === "in_progress" ? "in progress" : s.status
                return s.clientName.toLowerCase().includes(q) ||
                    s.clientEmail.toLowerCase().includes(q) ||
                    s.businessName.toLowerCase().includes(q) ||
                    statusDisplay.toLowerCase().includes(q)
            })
        }
        
        return filtered
    }, [sorted, searchQuery, statusFilter])

    const paginatedSessions = filteredSessions.slice(currentPage * pageSize, (currentPage + 1) * pageSize)
    const totalPages = Math.ceil(filteredSessions.length / pageSize)

    return (
        <>
            <div className="w-full flex justify-between items-center mb-2">
                <div>
                    <h1 className="text-2xl font-semibold text-[#111827] mt-6 mb-6">Client Sessions</h1>
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
                    <div className="relative" ref={statusFilterRef} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsStatusFilterOpen(false) }} tabIndex={-1}>
                        <button
                            type="button"
                            onClick={() => setIsStatusFilterOpen((v) => !v)}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-sm text-[#374151] border border-[#E5E7EB] hover:bg-gray-50 hover:border-[#701CC0] transition-colors duration-200 shadow-sm"
                        >
                            <FiFilter className="w-4 h-4" />
                            <span className="text-sm font-medium">Filter</span>
                            <svg 
                                className={`w-4 h-4 transition-transform duration-200 ${isStatusFilterOpen ? 'rotate-180' : ''}`}
                                fill="none" 
                                stroke="currentColor" 
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                        {isStatusFilterOpen && (
                            <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-[#E5E7EB] py-4 z-50">
                                <div className="px-5">
                                    <h3 className="text-sm font-semibold text-[#111827] mb-4">Filter & Sort</h3>
                                    
                                    {/* Status Filter */}
                                    <div className="mb-4">
                                        <label className="block text-xs font-medium text-[#6B7280] mb-2">Status</label>
                                        <div className="relative">
                                            <select
                                                value={statusFilter}
                                                onChange={(e) => {
                                                    setStatusFilter(e.target.value as 'all' | SessionStatus)
                                                    setCurrentPage(0)
                                                }}
                                                className="w-full text-sm border border-[#E5E7EB] rounded-lg px-3 py-2 pr-10 bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#701CC0] focus:border-transparent appearance-none"
                                            >
                                                <option value="all">All Statuses</option>
                                                <option value="pending">Not Started</option>
                                                <option value="in_progress">In Progress</option>
                                                <option value="completed">Completed</option>
                                                <option value="expired">Expired</option>
                                            </select>
                                            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                                <svg className="w-4 h-4 text-[#6B7280]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Sort Direction */}
                                    <div>
                                        <label className="block text-xs font-medium text-[#6B7280] mb-2">Order</label>
                                        <div className="relative">
                                            <select
                                                value={sortDir}
                                                onChange={(e) => {
                                                    setSortDir(e.target.value as "asc" | "desc")
                                                    setCurrentPage(0)
                                                }}
                                                className="w-full text-sm border border-[#E5E7EB] rounded-lg px-3 py-2 pr-10 bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#701CC0] focus:border-transparent appearance-none"
                                            >
                                                <option value="asc">Ascending</option>
                                                <option value="desc">Descending</option>
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
                        onClick={expireSessions}
                        disabled={expiring}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-sm text-[#374151] border border-[#E5E7EB] hover:bg-gray-50 hover:border-[#701CC0] transition-colors duration-200 shadow-sm disabled:opacity-60"
                    >
                        <RefreshCw size={16} className={expiring ? "animate-spin" : ""} />
                        <span>Update Sessions</span>
                    </button>
                    <button
                        onClick={onBackToUsers}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-sm text-[#374151] border border-[#E5E7EB] hover:bg-gray-50 hover:border-[#701CC0] transition-colors duration-200 shadow-sm"
                    >
                        <Users size={16} />
                        <span>Manage Users</span>
                </button>
                </div>
            </div>


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
                            <div className="w-full h-full flex flex-col items-center justify-center text-center">
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ duration: 0.5, ease: "easeOut" }}
                                >
                                    <Image 
                                        src="/assets/no-client.png" 
                                        alt="No sessions" 
                                        width={224} 
                                        height={224} 
                                        className="w-56 h-auto mb-3" 
                                    />
                                </motion.div>
                                <p className="text-sm text-gray-500 mb-3">
                                    {searchQuery ? "No sessions match your search." : "No sessions found."}
                                </p>
                            </div>
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
                                        {s.status === "completed" && (
                                            <button
                                                onClick={() => openAnswers(s.token)}
                                                className="inline-flex items-center gap-1 px-3 py-1 rounded-md text-xs bg-[#701CC0] text-white hover:bg-[#5a1799] transition-colors"
                                            >
                                                <Eye size={14} /> View
                                            </button>
                                        )}
                                        
                                        <div className="relative" ref={(el) => { actionMenuRefs.current[s.token] = el }}>
                                            <button
                                                ref={(el) => { actionMenuButtonRefs.current[s.token] = el }}
                                                onClick={() => setActionMenuOpen(actionMenuOpen === s.token ? null : s.token)}
                                                className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
                                                aria-label="Session actions"
                                            >
                                                <MoreVertical className="w-4 h-4 text-[#6B7280]" />
                                            </button>
                                            
                                            {actionMenuOpen === s.token && actionMenuPosition && (
                                                <div 
                                                    className="fixed w-48 bg-white rounded-lg shadow-xl border border-[#E5E7EB] py-1 z-[100]"
                                                    style={{
                                                        top: `${actionMenuPosition.top}px`,
                                                        right: `${actionMenuPosition.right}px`
                                                    }}
                                                >
                                                    {s.status !== "expired" && (
                                                        <button
                                                            onClick={() => handleGetLink(s.token, s.clientEmail)}
                                                            disabled={sessionLink?.loading}
                                                            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-[#374151] disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            <LinkIcon className="w-4 h-4" />
                                                            {sessionLink?.loading ? "Loading..." : "Get Link"}
                                                        </button>
                                                    )}
                                                    
                                                    <button
                                                        onClick={() => handleRenewSession(s.token)}
                                                        disabled={renewingSession === s.token}
                                                        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-[#374151] disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        <RotateCw className={`w-4 h-4 ${renewingSession === s.token ? "animate-spin" : ""}`} />
                                                        Renew Session
                                                    </button>
                                                    
                                                    <div className="border-t border-[#E5E7EB] my-1" />
                                                    
                                                    <button
                                                        onClick={() => openDeleteModal(s.token, s.clientName)}
                                                        className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                        Delete Session
                                                    </button>
                                                </div>
                                            )}
                                        </div>
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

            {showUpdateSessionsModal && (
                <div 
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" 
                    onClick={(e) => {
                        if (updateSessionsModalRef.current && !updateSessionsModalRef.current.contains(e.target as Node)) {
                            setShowUpdateSessionsModal(false)
                        }
                    }}
                >
                    <div
                        ref={updateSessionsModalRef}
                        className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4"
                        onClick={(e) => e.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                    >
                        <div className="flex flex-col items-center text-center">
                            {updateSessionsSuccess ? (
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
                                            ? `Successfully updated ${updatedCount} session${updatedCount === 1 ? '' : 's'}.`
                                            : "No sessions needed updating."
                                        }
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
                                    updateSessionsSuccess
                                        ? 'bg-[#701CC0] text-white hover:bg-[#5f17a5]'
                                        : 'bg-red-600 text-white hover:bg-red-700'
                                }`}
                                onClick={() => setShowUpdateSessionsModal(false)}
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmDeleteSessionModal
                isOpen={deleteModalOpen}
                clientName={sessionToDelete?.clientName || ""}
                onConfirm={handleDeleteSession}
                onCancel={() => {
                    setDeleteModalOpen(false)
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
        </>
    )
}

// ----- Confirm Delete Session Modal -----

const ConfirmDeleteSessionModal: React.FC<{
    isOpen: boolean
    clientName: string
    onConfirm: () => void
    onCancel: () => void
    isDeleting: boolean
}> = ({ isOpen, clientName, onConfirm, onCancel, isDeleting }) => {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onCancel}>
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
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
            </div>
        </div>
    )
}

// ----- Get Link Modal -----

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
                // Failed to copy
            }
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                        <LinkIcon className="w-6 h-6 text-[#701CC0]" />
                    </div>
                    <h3 className="text-xl font-semibold text-[#111827]">Session Link</h3>
                </div>

                {link ? (
                    <>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-[#374151] mb-2">Session Link</label>
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
            </div>
        </div>
    )
}

// ----- Renew Session Modal -----

const RenewSessionModal: React.FC<{
    isOpen: boolean
    success: boolean
    onClose: () => void
}> = ({ isOpen, success, onClose }) => {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
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
            </div>
        </div>
    )
}
