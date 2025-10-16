"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
import { Users, Shield, Briefcase, FileText, Edit, Settings, RefreshCw, AlertCircle, CheckCircle2, Timer, XCircle, ArrowUpDown, ChevronUp, ChevronDown, Eye } from "lucide-react"

type TabType = "users" | "clients" | "staff" | "sessions" | "blogs" | "system"

const AdminEditorSection = () => {
    const [activeTab, setActiveTab] = useState<TabType>("sessions")

    const tabs = [
        { id: "users" as TabType, label: "Users", icon: Users },
        { id: "clients" as TabType, label: "Client Management", icon: Shield },
        { id: "staff" as TabType, label: "Staff", icon: Briefcase },
        { id: "sessions" as TabType, label: "Sessions", icon: FileText },
        { id: "blogs" as TabType, label: "Blogs", icon: Edit },
        { id: "system" as TabType, label: "System", icon: Settings },
    ]

    const renderTabContent = () => {
        switch (activeTab) {
            case "users":
                return <UsersPanel />
            case "clients":
                return <AdminClientsPanel />
            case "staff":
                return <StaffPanel />
            case "sessions":
                return <SessionsPanel />
            case "blogs":
                return <div className="text-gray-600">Blogs section - Coming soon</div>
            case "system":
                return <SystemPanel />
            default:
                return null
        }
    }

    return (
        <div className="w-full min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-8">
            <div className="max-w-7xl mx-auto">
                <h1 className="text-4xl font-bold text-black mb-8">Admin Control Panel</h1>
                
                {/* Tabs Navigation */}
                <div className="flex flex-wrap gap-3 mb-8">
                    {tabs.map((tab) => {
                        const Icon = tab.icon
                        const isActive = activeTab === tab.id
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`
                                    flex items-center gap-2 px-6 py-3 rounded-lg font-medium
                                    transition-all duration-200 ease-in-out
                                    ${isActive 
                                        ? "bg-black text-white shadow-lg" 
                                        : "bg-white text-gray-700 hover:bg-gray-100 shadow-sm"
                                    }
                                `}
                            >
                                <Icon size={20} />
                                <span>{tab.label}</span>
                            </button>
                        )
                    })}
                </div>

                {/* Tab Content */}
                <div className="bg-white rounded-lg shadow-lg p-8 min-h-[400px]">
                    {renderTabContent()}
                </div>
            </div>
        </div>
    )
}

export default AdminEditorSection

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

// ----- System Panel -----

function SystemPanel() {
    const [stats, setStats] = useState<{ users: number; clients: number; sessions: number; blogPosts: number; staff: number } | null>(null)
    const [expiring, setExpiring] = useState<boolean>(false)
    const [message, setMessage] = useState<string>("")

    const loadStats = useCallback(async () => {
        try {
            const r = await fetch("/api/admin/systemStats", { cache: "no-store" })
            if (!r.ok) throw new Error("Failed to load stats")
            setStats(await r.json())
        } catch {
            // ignore
        }
    }, [])

    const expireNow = useCallback(async (silent = false) => {
        try {
            setExpiring(!silent)
            const r = await fetch("/api/admin/expireSessions", { method: "POST" })
            const j = await r.json()
            if (!silent) setMessage(`Updated ${j.updated ?? 0} sessions`)
            await loadStats()
        } catch {
            if (!silent) setMessage("Failed to update sessions")
        } finally {
            setExpiring(false)
        }
    }, [loadStats])

    useEffect(() => {
        Promise.all([loadStats(), expireNow(true)])
            .catch(() => {})
    }, [loadStats, expireNow])

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Database Card */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6">
                <div className="flex items-center justify-between">
                    <div className="text-xl font-semibold text-black flex items-center gap-2"><DatabaseIcon /> Database</div>
                    <button className="px-4 py-2 rounded-md bg-gray-100 text-gray-700">View Stats</button>
                </div>
                <div className="mt-6 space-y-2 text-sm text-gray-700">
                    <div>Total Users: <span className="float-right font-medium">{stats?.users ?? "-"}</span></div>
                    <div>Total Clients: <span className="float-right font-medium">{stats?.clients ?? "-"}</span></div>
                    <div>Total Sessions: <span className="float-right font-medium">{stats?.sessions ?? "-"}</span></div>
                    <div>Blog Posts: <span className="float-right font-medium">{stats?.blogPosts ?? "-"}</span></div>
                    <div>Staff Members: <span className="float-right font-medium">{stats?.staff ?? "-"}</span></div>
                </div>
            </div>

            {/* Session Expiry Card */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6">
                <div className="text-xl font-semibold text-black flex items-center gap-2"><ClockIcon /> Session Expiry</div>
                <p className="text-gray-600 mt-2">Update expired sessions automatically</p>
                <div className="mt-4">
                    <button onClick={() => expireNow()} disabled={expiring}
                        className="px-4 py-2 rounded-md bg-gray-800 text-white hover:bg-black disabled:opacity-60">
                        {expiring ? "Updating..." : "Update Expired Sessions"}
                    </button>
                    {!!message && <div className="mt-3 text-sm text-gray-600">{message}</div>}
                    <div className="mt-2 text-xs text-gray-500">Sessions are auto-checked on page load</div>
                </div>
            </div>
        </div>
    )
}

function DatabaseIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
            <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
            <path d="M3 5v6c0 1.7 4 3 9 3s9-1.3 9-3V5"></path>
            <path d="M3 11v6c0 1.7 4 3 9 3s9-1.3 9-3v-6"></path>
        </svg>
    )
}

function ClockIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M12 6v6l4 2"></path>
        </svg>
    )
}

// ----- Users Panel -----

type ListedUser = {
    id: number
    email: string | null
    role: string
    clientName: string | null
    hasPassword: boolean
}

function UsersPanel() {
    const [users, setUsers] = useState<ListedUser[]>([])
    const [loading, setLoading] = useState<boolean>(false)
    const [error, setError] = useState<string>("")
    const [showCreate, setShowCreate] = useState<boolean>(false)
    const [revealed, setRevealed] = useState<Record<number, string>>({})

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
            if (data?.password) setRevealed((prev) => ({ ...prev, [userId]: data.password }))
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

    const deleteUser = async (userId: number) => {
        if (!confirm("Delete this user?")) return
        try {
            await fetch(`/api/admin/users?id=${userId}`, { method: "DELETE" })
            setUsers((prev) => prev.filter((u) => u.id !== userId))
        } catch {}
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-semibold text-black">User Management</h2>
                <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg shadow">
                    <span>➕ Create New User</span>
                </button>
            </div>

            <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full bg-white">
                    <thead>
                        <tr className="text-left text-sm text-gray-600">
                            <th className="px-6 py-3">ID</th>
                            <th className="px-6 py-3">Email</th>
                            <th className="px-6 py-3">Password</th>
                            <th className="px-6 py-3">Role</th>
                            <th className="px-6 py-3">Client</th>
                            <th className="px-6 py-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && (
                            <tr>
                                <td colSpan={6} className="px-6 py-10 text-center text-gray-500">Loading...</td>
                            </tr>
                        )}
                        {!loading && error && (
                            <tr>
                                <td colSpan={6} className="px-6 py-10 text-center text-red-600">{error}</td>
                            </tr>
                        )}

                        {users.map((u) => {
                            const masked = revealed[u.id] ? revealed[u.id] : (u.hasPassword ? "••••••••" : "N/A")
                            return (
                                <tr key={u.id} className="border-t border-gray-100 text-sm">
                                    <td className="px-6 py-4 text-gray-700">{u.id}</td>
                                    <td className="px-6 py-4">
                                        <div className="text-gray-900">{u.email ?? "-"}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <span className="text-gray-700 font-mono">{masked}</span>
                                            {u.hasPassword && !revealed[u.id] && (
                                                <button onClick={() => revealPassword(u.id)} className="px-2 py-1 rounded-md text-xs bg-gray-100 hover:bg-gray-200">Reveal</button>
                                            )}
                                            {revealed[u.id] && (
                                                <button onClick={() => hidePassword(u.id)} className="px-2 py-1 rounded-md text-xs bg-gray-100 hover:bg-gray-200">Hide</button>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <select value={u.role || "user"} onChange={(e) => updateRole(u.id, e.target.value)} className="border rounded-md px-2 py-1 text-sm bg-white text-gray-800">
                                            <option value="user">user</option>
                                            <option value="admin">admin</option>
                                            <option value="client">client</option>
                                        </select>
                                    </td>
                                    <td className="px-6 py-4 text-gray-700">{u.clientName ?? "N/A"}</td>
                                    <td className="px-6 py-4">
                                        <button onClick={() => deleteUser(u.id)} className="inline-flex items-center gap-1 px-3 py-1 rounded-md text-xs bg-red-50 text-red-700 border border-red-200">Delete</button>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />}
        </div>
    )
}

function CreateUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
    const [email, setEmail] = useState<string>("")
    const [password, setPassword] = useState<string>("")
    const [role, setRole] = useState<string>("user")
    const [submitting, setSubmitting] = useState<boolean>(false)
    const [error, setError] = useState<string>("")

    const submit = async () => {
        setSubmitting(true)
        setError("")
        try {
            const r = await fetch("/api/admin/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password, role }),
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
                <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full border rounded-md px-3 py-2" />
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="w-full border rounded-md px-3 py-2" />
                    <select value={role} onChange={(e) => setRole(e.target.value)} className="w-full border rounded-md px-3 py-2">
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
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

// ----- Admin Clients Panel (simplified columns, session + delete, create client modal reuse) -----

type AdminClientRow = { id: string; name: string; email: string; status: string }

function AdminClientsPanel() {
    const [rows, setRows] = useState<AdminClientRow[]>([])
    const [loading, setLoading] = useState<boolean>(false)
    const [error, setError] = useState<string>("")
    const [success, setSuccess] = useState<{ open: boolean; link?: string } | null>(null)
    const [showAdd, setShowAdd] = useState<boolean>(false)

    const load = async () => {
        setLoading(true)
        setError("")
        try {
            const r = await fetch("/api/admin/clients")
            if (!r.ok) throw new Error("Failed to load clients")
            const data = await r.json()
            const mapped: AdminClientRow[] = data.map((d: any) => ({ id: d.id, name: d.name, email: d.email, status: d.status }))
            setRows(mapped)
        } catch (e: any) {
            setError(e?.message || "Failed to load clients")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { load() }, [])

    const regenerateSession = async (client: AdminClientRow) => {
        try {
            // Use existing logic: generate session and email link
            const r = await fetch("/api/session/generateClientSession", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ clientName: client.name, clientEmail: client.email, businessName: client.name, industry: undefined }),
            })
            if (!r.ok) throw new Error("Failed to create session")
            const { link } = await r.json()
            const fullLink = (() => {
                try { return new URL(link, window.location.origin).toString() } catch { return link }
            })()
            // Send email with existing endpoint
            await fetch("/api/sendSessionLinkEmail", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: client.email, clientName: client.name, link: fullLink }),
            })
            setSuccess({ open: true, link: fullLink })
        } catch (e: any) {
            setError(e?.message || "Failed to regenerate session")
        }
    }

    const deleteClient = async (clientId: string) => {
        if (!confirm("Delete this client?")) return
        try {
            const r = await fetch(`/api/admin/deleteClient?clientId=${clientId}`, { method: "DELETE" })
            if (!r.ok) throw new Error("Failed to delete client")
            setRows((prev) => prev.filter((c) => c.id !== clientId))
        } catch (e: any) {
            setError(e?.message || "Delete failed")
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-semibold text-black">Client Management</h2>
                <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg shadow">
                    <span>➕ Create Client</span>
                </button>
            </div>

            <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full bg-white">
                    <thead>
                        <tr className="text-left text-sm text-gray-600">
                            <th className="px-6 py-3">Name</th>
                            <th className="px-6 py-3">Email</th>
                            <th className="px-6 py-3">Status</th>
                            <th className="px-6 py-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && (
                            <tr><td colSpan={4} className="px-6 py-10 text-center text-gray-500">Loading...</td></tr>
                        )}
                        {!loading && error && (
                            <tr><td colSpan={4} className="px-6 py-10 text-center text-red-600">{error}</td></tr>
                        )}
                        {!loading && rows.length === 0 && (
                            <tr><td colSpan={4} className="px-6 py-10 text-center text-gray-500">No clients</td></tr>
                        )}

                        {rows.map((c) => (
                            <tr key={c.id} className="border-t border-gray-100 text-sm">
                                <td className="px-6 py-4 text-gray-900">{c.name}</td>
                                <td className="px-6 py-4 text-gray-700">{c.email}</td>
                                <td className="px-6 py-4">
                                    {c.status === "completed" ? (
                                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs bg-green-50 text-green-700 border border-green-200">completed</span>
                                    ) : c.status === "pending" || c.status === "in_progress" ? (
                                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs bg-yellow-50 text-yellow-700 border border-yellow-200">pending</span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs bg-red-50 text-red-700 border border-red-200">expired</span>
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => regenerateSession(c)} className="px-3 py-1 rounded-md text-xs bg-blue-600 text-white hover:bg-blue-700">Session</button>
                                        <button onClick={() => deleteClient(c.id)} className="px-3 py-1 rounded-md text-xs bg-red-50 text-red-700 border border-red-200">Delete</button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {showAdd && <AddClientModal onClose={() => setShowAdd(false)} onCreated={() => { setShowAdd(false); load(); }} />}

            {success?.open && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-lg text-gray-900">
                        <div className="flex items-center justify-between px-6 py-4 border-b">
                            <div className="text-xl font-semibold">Client Profile Created Successfully</div>
                            <button onClick={() => setSuccess(null)} className="text-gray-600 hover:text-black">×</button>
                        </div>
                        <div className="p-6 space-y-4">
                            <button onClick={() => { if (success?.link) navigator.clipboard.writeText(success.link.startsWith('http') ? success.link : `${window.location.origin}${success.link}`) }} className="w-full px-4 py-2 rounded-md bg-white border text-gray-800">Copy Session Link</button>
                            <button onClick={() => setSuccess(null)} className="w-full px-4 py-2 rounded-md bg-purple-600 text-white">Done</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

function AddClientModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
    const [name, setName] = useState("")
    const [email, setEmail] = useState("")
    const [business, setBusiness] = useState("")
    const [industry, setIndustry] = useState("")
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState("")

    const submit = async () => {
        setSubmitting(true)
        setError("")
        try {
            const r = await fetch("/api/session/generateClientSession", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ clientName: name, clientEmail: email, businessName: business || name, industry }),
            })
            if (!r.ok) throw new Error("Failed to create client session")
            const { link } = await r.json()
            await fetch("/api/sendSessionLinkEmail", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, clientName: name, link }) })
            onCreated()
        } catch (e: any) {
            setError(e?.message || "Failed to create client")
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md text-gray-900">
                <div className="flex items-center justify-between px-6 py-4 border-b">
                    <div className="text-xl font-semibold">Add Client</div>
                    <button onClick={onClose} className="text-gray-600 hover:text-black">×</button>
                </div>
                <div className="p-6 space-y-4">
                    <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Client Name" className="w-full border rounded-md px-3 py-2" />
                    <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Client Email" className="w-full border rounded-md px-3 py-2" />
                    <input value={business} onChange={(e) => setBusiness(e.target.value)} placeholder="Business Name" className="w-full border rounded-md px-3 py-2" />
                    <input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="Industry" className="w-full border rounded-md px-3 py-2" />
                    {error && <div className="text-sm text-red-600">{error}</div>}
                </div>
                <div className="px-6 pb-6">
                    <button disabled={submitting} onClick={submit} className="w-full inline-flex items-center justify-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg disabled:opacity-60">
                        {submitting ? "Adding..." : "Add Client"}
                    </button>
                </div>
            </div>
        </div>
    )
}

function StaffPanel() {
    const [staff, setStaff] = useState<Array<{ id: number; email: string | null }>>([])
    const [loading, setLoading] = useState<boolean>(false)
    const [error, setError] = useState<string>("")

    useEffect(() => {
        const load = async () => {
            setLoading(true)
            setError("")
            try {
                const r = await fetch("/api/admin/staff")
                if (!r.ok) throw new Error("Failed to load staff")
                setStaff(await r.json())
            } catch (e: any) {
                setError(e?.message || "Failed to load staff")
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [])

    return (
        <div className="space-y-6">
            <h2 className="text-3xl font-semibold text-black">Staff</h2>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full bg-white">
                    <thead>
                        <tr className="text-left text-sm text-gray-600">
                            <th className="px-6 py-3">ID</th>
                            <th className="px-6 py-3">Email</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && (
                            <tr><td colSpan={2} className="px-6 py-10 text-center text-gray-500">Loading...</td></tr>
                        )}
                        {!loading && error && (
                            <tr><td colSpan={2} className="px-6 py-10 text-center text-red-600">{error}</td></tr>
                        )}
                        {!loading && staff.length === 0 && (
                            <tr><td colSpan={2} className="px-6 py-10 text-center text-gray-500">No staff</td></tr>
                        )}
                        {staff.map((s) => (
                            <tr key={s.id} className="border-t border-gray-100 text-sm">
                                <td className="px-6 py-4 text-gray-700">{s.id}</td>
                                <td className="px-6 py-4 text-gray-900">{s.email ?? "-"}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

function SessionsPanel() {
    const [sessions, setSessions] = useState<SessionRow[]>([])
    const [loading, setLoading] = useState<boolean>(false)
    const [error, setError] = useState<string>("")
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

    const counts = useMemo(() => {
        const by: Record<SessionStatus, number> = {
            pending: 0,
            in_progress: 0,
            completed: 0,
            expired: 0,
            canceled: 0,
        }
        for (const s of sessions) {
            by[s.status] = (by[s.status] ?? 0) + 1
        }
        return by
    }, [sessions])

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

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-semibold text-black">Onboarding Sessions</h2>
                <button
                    onClick={load}
                    disabled={loading}
                    className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg shadow disabled:opacity-60"
                >
                    <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                    <span>Refresh</span>
                </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-5">
                    <div className="flex items-center gap-2 text-yellow-800 font-medium"><AlertCircle size={18} /> Pending</div>
                    <div className="mt-3 text-3xl font-bold text-yellow-900">{counts.pending}</div>
                </div>
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
                    <div className="flex items-center gap-2 text-blue-800 font-medium"><Timer size={18} /> In Progress</div>
                    <div className="mt-3 text-3xl font-bold text-blue-900">{counts.in_progress}</div>
                </div>
                <div className="rounded-xl border border-green-200 bg-green-50 p-5">
                    <div className="flex items-center gap-2 text-green-800 font-medium"><CheckCircle2 size={18} /> Completed</div>
                    <div className="mt-3 text-3xl font-bold text-green-900">{counts.completed}</div>
                </div>
                <div className="rounded-xl border border-red-200 bg-red-50 p-5">
                    <div className="flex items-center gap-2 text-red-800 font-medium"><XCircle size={18} /> Expired</div>
                    <div className="mt-3 text-3xl font-bold text-red-900">{counts.expired}</div>
                </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full bg-white">
                    <thead>
                        <tr className="text-left text-sm text-gray-600">
                            <th className="px-6 py-3">
                                <button onClick={() => toggleSort("client")} className="inline-flex items-center gap-1 hover:text-black">
                                    <span>Client</span>
                                    <SortIcon active={sortKey === "client"} dir={sortDir} />
                                </button>
                            </th>
                            <th className="px-6 py-3">
                                <button onClick={() => toggleSort("business")} className="inline-flex items-center gap-1 hover:text-black">
                                    <span>Business</span>
                                    <SortIcon active={sortKey === "business"} dir={sortDir} />
                                </button>
                            </th>
                            <th className="px-6 py-3">
                                <button onClick={() => toggleSort("status")} className="inline-flex items-center gap-1 hover:text-black">
                                    <span>Status</span>
                                    <SortIcon active={sortKey === "status"} dir={sortDir} />
                                </button>
                            </th>
                            <th className="px-6 py-3">
                                <button onClick={() => toggleSort("created")} className="inline-flex items-center gap-1 hover:text-black">
                                    <span>Created</span>
                                    <SortIcon active={sortKey === "created"} dir={sortDir} />
                                </button>
                            </th>
                            <th className="px-6 py-3">
                                <button onClick={() => toggleSort("updated")} className="inline-flex items-center gap-1 hover:text-black">
                                    <span>Last Updated</span>
                                    <SortIcon active={sortKey === "updated"} dir={sortDir} />
                                </button>
                            </th>
                            <th className="px-6 py-3">
                                <button onClick={() => toggleSort("platforms")} className="inline-flex items-center gap-1 hover:text-black">
                                    <span>Platforms</span>
                                    <SortIcon active={sortKey === "platforms"} dir={sortDir} />
                                </button>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && (
                            <tr>
                                <td colSpan={6} className="px-6 py-10 text-center text-gray-500">Loading...</td>
                            </tr>
                        )}
                        {!loading && error && (
                            <tr>
                                <td colSpan={6} className="px-6 py-10 text-center text-red-600">{error}</td>
                            </tr>
                        )}
                        {!loading && !error && sessions.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-6 py-10 text-center text-gray-500">No sessions found</td>
                            </tr>
                        )}

                        {sorted.map((s) => (
                            <tr key={s.token} className="border-t border-gray-100 text-sm">
                                <td className="px-6 py-4">
                                    <div className="font-medium text-gray-900">{s.clientName}</div>
                                    <div className="text-gray-500">{s.clientEmail}</div>
                                </td>
                                <td className="px-6 py-4 text-gray-700">{s.businessName}</td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        {s.status === "completed" && (
                                            <button
                                                onClick={() => openAnswers(s.token)}
                                                className="inline-flex items-center gap-1 px-3 py-1 rounded-md text-xs bg-purple-600 text-white hover:bg-purple-700"
                                            >
                                                <Eye size={14} /> View Response
                                            </button>
                                        )}
                                        {statusBadge(s.status)}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-gray-700">{formatDate(s.createdAt)}</td>
                                <td className="px-6 py-4 text-gray-700">{formatDate(s.lastUpdatedAt)}</td>
                                <td className="px-6 py-4 text-gray-700">
                                    {(!s.platforms || s.platforms.length === 0) ? (
                                        <span className="text-gray-400">None</span>
                                    ) : (
                                        <div className="flex flex-wrap gap-2">
                                            {s.platforms.map((p, idx) => (
                                                <span key={`${p}-${idx}`} className="px-2 py-1 rounded-md text-xs bg-gray-100 text-gray-700 border border-gray-200 uppercase">{p}</span>
                                            ))}
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

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
        </div>
    )
}
