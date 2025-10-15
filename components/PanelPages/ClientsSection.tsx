import React, { useEffect, useMemo, useState, useRef } from "react"
import { FiPlus, FiSearch, FiFilter, FiTrash2, FiMoreVertical, FiCheckCircle, FiXCircle } from 'react-icons/fi'

type ClientRow = {
    id: string
    name: string
    email: string
    businessName: string
    website: string
    targetAudience: string
    adGoal: string
    brandTone: string
    industry?: string
    monthlyRetainer?: number
    clientGoal?: string
    status: string
    isActive: boolean
    isExpired: boolean
}

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
    // pending (yellow) - session generated but not expired and not completed
    // completed (green) - session completed
    // expired/inactive (red) - session expired or manually deactivated
    
    let bgColor = "bg-red-100";
    let textColor = "text-red-700";
    let label = "Inactive";
    
    if (status === "completed") {
        bgColor = "bg-green-100";
        textColor = "text-green-700";
        label = "Active";
    } else if (status === "pending" || status === "in_progress") {
        bgColor = "bg-yellow-100";
        textColor = "text-yellow-700";
        label = "Pending";
    }
    
    return (
        <span className={`px-3 py-1 rounded-full text-xs ${bgColor} ${textColor}`}>
            {label}
        </span>
    )
}

const ConfirmDeleteModal: React.FC<{
    isOpen: boolean
    clientName: string
    onConfirm: () => void
    onCancel: () => void
}> = ({ isOpen, clientName, onConfirm, onCancel }) => {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onCancel}>
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                        <FiTrash2 className="w-6 h-6 text-red-600" />
                    </div>
                    <h3 className="text-xl font-semibold text-[#111827]">Delete Client</h3>
                </div>
                <p className="text-sm text-[#6B7280] mb-6">
                    Are you sure you want to delete <span className="font-semibold text-[#111827]">{clientName}</span>? 
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
                        Delete Client
                    </button>
                </div>
            </div>
        </div>
    )
}

const ClientActionsMenu: React.FC<{
    clientId: string
    clientName: string
    isActive: boolean
    onDelete: () => void
    onToggleStatus: (isActive: boolean) => void
}> = ({ clientName, isActive, onDelete, onToggleStatus }) => {
    const [isOpen, setIsOpen] = useState(false)
    const menuRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside)
            return () => document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [isOpen])

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                aria-label={`Manage ${clientName}`}
                className="p-2 rounded hover:bg-gray-100 transition-colors"
            >
                <FiMoreVertical className="w-5 h-5 text-[#6B7280]" />
            </button>
            {isOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-[#E5E7EB] py-1 z-10">
                    <button
                        onClick={() => {
                            setIsOpen(false)
                            onToggleStatus(!isActive)
                        }}
                        className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 ${
                            isActive ? 'text-orange-600' : 'text-green-600'
                        }`}
                    >
                        {isActive ? (
                            <>
                                <FiXCircle className="w-4 h-4" />
                                Mark Inactive
                            </>
                        ) : (
                            <>
                                <FiCheckCircle className="w-4 h-4" />
                                Mark Active
                            </>
                        )}
                    </button>
                    <button
                        onClick={() => {
                            setIsOpen(false)
                            onDelete()
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                    >
                        <FiTrash2 className="w-4 h-4" />
                        Remove Client
                    </button>
                </div>
            )}
        </div>
    )
}

interface ClientsSectionProps { onAddClient?: () => void }

const ClientsSection: React.FC<ClientsSectionProps> = ({ onAddClient }) => {
    const [rows, setRows] = useState<ClientRow[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [currentPage, setCurrentPage] = useState(0)
    const [searchQuery, setSearchQuery] = useState("")
    const [isFilterOpen, setIsFilterOpen] = useState(false)
    const [nameSort, setNameSort] = useState<'none' | 'asc' | 'desc'>("none")
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'pending'>("all")
    const [retainerSort, setRetainerSort] = useState<'none' | 'asc' | 'desc'>("none")
    const [deleteModalOpen, setDeleteModalOpen] = useState(false)
    const [clientToDelete, setClientToDelete] = useState<{ id: string; name: string } | null>(null)
    const pageSize = 10

    const fetchClients = async () => {
        try {
            setLoading(true)
            const r = await fetch("/api/admin/clients")
            if (!r.ok) throw new Error(`HTTP ${r.status}`)
            const data: ClientRow[] = await r.json()
            setRows(data)
        } catch (e: any) {
            setError(e?.message ?? "Failed to load clients")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchClients()
    }, [])

    const handleDeleteClient = async () => {
        if (!clientToDelete) return

        try {
            const r = await fetch(`/api/admin/deleteClient?clientId=${clientToDelete.id}`, {
                method: "DELETE",
            })
            
            if (!r.ok) {
                const data = await r.json()
                throw new Error(data.message || `HTTP ${r.status}`)
            }

            // Remove client from local state
            setRows(prev => prev.filter(client => client.id !== clientToDelete.id))
            setDeleteModalOpen(false)
            setClientToDelete(null)
        } catch (e: any) {
            setError(e?.message ?? "Failed to delete client")
        }
    }

    const openDeleteModal = (client: { id: string; name: string }) => {
        setClientToDelete(client)
        setDeleteModalOpen(true)
    }

    const handleToggleStatus = async (clientId: string, newStatus: boolean) => {
        try {
            const r = await fetch("/api/admin/toggleClientStatus", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ clientId, isActive: newStatus }),
            })
            
            if (!r.ok) {
                const data = await r.json()
                throw new Error(data.message || `HTTP ${r.status}`)
            }

            // Refresh the client list to get the updated status from the server
            // This ensures the status is calculated correctly based on session state
            await fetchClients()
        } catch (e: any) {
            setError(e?.message ?? "Failed to update client status")
        }
    }

    const columns = useMemo(
        () => [
            { key: "name", header: "Client Name" },
            { key: "businessName", header: "Business Name" },
            { key: "industry", header: "Industry" },
            { key: "monthlyRetainer", header: "Monthly Retainer ($)" },
            { key: "clientGoal", header: "Client Goal" },
            { key: "status", header: "Status" },
            { key: "manage", header: "Manage" },
        ],
        []
    )

    const filteredRows = useMemo(() => {
        const query = searchQuery.trim().toLowerCase()
        let base = rows
        // status filter
        if (statusFilter !== 'all') {
            base = base.filter((r) => {
                const statusKey = r.status === 'completed' ? 'active' : (r.status === 'pending' || r.status === 'in_progress') ? 'pending' : 'inactive'
                return statusKey === statusFilter
            })
        }
        // search filter
        if (query) {
            base = base.filter((r) => {
            return [
                r.name,
                r.email,
                r.businessName,
                r.industry,
                r.clientGoal,
                r.adGoal,
                r.status,
            ]
                .filter(Boolean)
                .some((v) => String(v).toLowerCase().includes(query))
            })
        }
        // sorting
        const sorted = [...base]
        if (retainerSort !== 'none') {
            sorted.sort((a, b) => {
                const av = typeof a.monthlyRetainer === 'number' ? a.monthlyRetainer : -1
                const bv = typeof b.monthlyRetainer === 'number' ? b.monthlyRetainer : -1
                return retainerSort === 'asc' ? av - bv : bv - av
            })
        } else if (nameSort !== 'none') {
            sorted.sort((a, b) => {
                const an = (a.name || '').toLowerCase()
                const bn = (b.name || '').toLowerCase()
                if (an < bn) return nameSort === 'asc' ? -1 : 1
                if (an > bn) return nameSort === 'asc' ? 1 : -1
                return 0
            })
        }
        return sorted
    }, [rows, searchQuery, statusFilter, nameSort, retainerSort])

    useEffect(() => {
        // reset to first page when search changes
        setCurrentPage(0)
    }, [searchQuery])

    return (
        <div className="w-full h-full bg-white text-[#111014] flex flex-col p-4">
                                    <div className="w-full flex justify-between items-center mb-2">
                                            <div>
                                                <h2 className="text-2xl font-semibold text-[#111827]">Clients</h2>
                                                <p className="text-sm text-[#6B7280] mt-0">All Clients</p>
                                            </div>
                                <div className="flex items-center gap-3">
                    <form
                        className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 shadow-sm border border-transparent focus-within:ring-2 focus-within:ring-[#701CC0] transition"
                        onSubmit={(e) => e.preventDefault()}
                    >
                        <button type="submit" aria-label="Search" className="flex items-center">
                            <FiSearch className="w-4 h-4 text-[#701CC0] flex-shrink-0" />
                        </button>
                        <label htmlFor="clients-search" className="sr-only">Search Clients</label>
                        <input
                            id="clients-search"
                            type="search"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search Clients"
                            className="w-64 md:w-80 text-sm placeholder:text-[#9CA3AF] bg-transparent outline-none"
                        />
                    </form>
                    <div className="relative" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsFilterOpen(false) }} tabIndex={-1}>
                        <button
                            type="button"
                            onClick={() => setIsFilterOpen((v) => !v)}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white text-sm text-[#374151] border border-[#E5E7EB] hover:bg-gray-50"
                        >
                            <FiFilter className="w-4 h-4" />
                            <span className="text-sm">Filter</span>
                        </button>
                        {isFilterOpen && (
                            <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl border border-[#E5E7EB] shadow-lg z-20 p-5 text-sm space-y-4">
                                <div className="mb-4">
                                    <div className="text-xs font-semibold text-[#6B7280] mb-1 uppercase tracking-wide">Name</div>
                                    <div className="flex gap-3">
                                        <button onClick={() => { setNameSort('asc'); setRetainerSort('none'); }} className={`px-3 py-1.5 rounded-lg border ${nameSort==='asc' ? 'bg-[#701CC0] text-white border-[#701CC0]' : 'border-[#E5E7EB] hover:bg-gray-50'}`}>A–Z</button>
                                        <button onClick={() => { setNameSort('desc'); setRetainerSort('none'); }} className={`px-3 py-1.5 rounded-lg border ${nameSort==='desc' ? 'bg-[#701CC0] text-white border-[#701CC0]' : 'border-[#E5E7EB] hover:bg-gray-50'}`}>Z–A</button>
                                    </div>
                                </div>
                                <div className="mb-4">
                                    <div className="text-xs font-semibold text-[#6B7280] mb-1 uppercase tracking-wide">Status</div>
                                    <div className="flex flex-wrap gap-3">
                                        {(['all','active','inactive','pending'] as const).map(s => (
                                            <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 rounded-lg border capitalize ${statusFilter===s ? 'bg-[#701CC0] text-white border-[#701CC0]' : 'border-[#E5E7EB] hover:bg-gray-50'}`}>{s}</button>
                                        ))}
                                    </div>
                                </div>
                                <div className="mb-4">
                                    <div className="text-xs font-semibold text-[#6B7280] mb-1 uppercase tracking-wide">Monthly Retainer</div>
                                    <div className="flex gap-3">
                                        <button onClick={() => { setRetainerSort('asc'); setNameSort('none'); }} className={`px-3 py-1.5 rounded-lg border ${retainerSort==='asc' ? 'bg-[#701CC0] text-white border-[#701CC0]' : 'border-[#E5E7EB] hover:bg-gray-50'}`}>Low → High</button>
                                        <button onClick={() => { setRetainerSort('desc'); setNameSort('none'); }} className={`px-3 py-1.5 rounded-lg border ${retainerSort==='desc' ? 'bg-[#701CC0] text-white border-[#701CC0]' : 'border-[#E5E7EB] hover:bg-gray-50'}`}>High → Low</button>
                                    </div>
                                </div>
                                <div className="flex justify-between mt-2 text-xs">
                                    <button onClick={() => { setNameSort('none'); setRetainerSort('none'); setStatusFilter('all'); }} className="text-[#6B7280] hover:underline">Clear</button>
                                    <button onClick={() => setIsFilterOpen(false)} className="text-[#701CC0] font-medium">Close</button>
                                </div>
                            </div>
                        )}
                    </div>
                    <button
                        onClick={onAddClient}
                        className="inline-flex items-center px-4 py-2 rounded-lg bg-[#701CC0] text-white text-sm hover:bg-[#5f17a5]"
                    >
                        <FiPlus className="w-4 h-4 mr-2" />
                        Add Client
                    </button>
                </div>
            </div>
            <div className="overflow-x-hidden w-full">
                            <div className="overflow-x-auto pr-6">
                                <table className="min-w-full text-left border-separate border-spacing-y-3">
                    <thead>
                        <tr className="bg-[#F8F0FF] text-black text-sm">
                            {columns.map((c) => (
                                <th key={c.key} className="px-6 py-3 font-normal text-sm">{c.header}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading && (
                            <tr>
                                <td className="px-4 py-6 text-sm text-gray-500" colSpan={columns.length}>Loading...</td>
                            </tr>
                        )}
                        {!loading && filteredRows.length === 0 && (
                            <tr>
                                <td className="px-4 py-12" colSpan={columns.length}>
                                    <div className="w-full h-full flex flex-col items-center justify-center text-center">
                                        <img src="/assets/no-client.png" alt="No clients" className="w-56 h-auto mb-3" />
                                        <p className="text-sm text-gray-500 mb-3">You have no clients added.</p>
                                        <button
                                            onClick={onAddClient}
                                            className="inline-flex items-center px-4 py-2 rounded-lg bg-[#701CC0] text-white text-sm hover:bg-[#5f17a5]"
                                        >
                                            <FiPlus className="w-4 h-4 mr-2" />
                                            Add Client
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        )}
                        {filteredRows.slice(currentPage * pageSize, (currentPage + 1) * pageSize).map((r) => (
                            <tr key={r.id} className="bg-white hover:bg-[#F8F0FF] rounded-xl transition-colors">
                                <td className="px-4 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-full bg-[#E2E8F0] flex items-center justify-center text-sm font-medium">
                                            {r.name?.charAt(0)?.toUpperCase() || "?"}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-semibold">{r.name || "—"}</span>
                                            <span className="text-xs text-[#677489]">{r.email || ""}</span>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-4 py-4 text-sm">{r.businessName || "—"}</td>
                                <td className="px-4 py-4 text-sm">{r.industry || r.targetAudience || "—"}</td>
                                <td className="px-4 py-4 text-sm">{typeof r.monthlyRetainer === 'number' ? `$${r.monthlyRetainer.toLocaleString()}` : "—"}</td>
                                <td className="px-4 py-4 text-sm">{r.clientGoal || r.adGoal || "—"}</td>
                                <td className="px-4 py-4 text-sm"><StatusBadge status={r.status} /></td>
                                <td className="px-4 py-4 text-sm text-[#6B7280]">
                                    <ClientActionsMenu
                                        clientId={r.id}
                                        clientName={r.name}
                                        isActive={r.isActive}
                                        onDelete={() => openDeleteModal({ id: r.id, name: r.name })}
                                        onToggleStatus={(newStatus) => handleToggleStatus(r.id, newStatus)}
                                    />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                            </table>
                        </div>
            </div>

            {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
            {!loading && filteredRows.length > 0 && (
                <div className="mt-4 text-xs text-[#677489]">
                    <div className="w-full flex items-center justify-between">
                        <div className="text-xs text-[#677489]">
                            Showing {Math.min(filteredRows.length, currentPage * pageSize + 1)}–{Math.min(filteredRows.length, (currentPage + 1) * pageSize)} of {filteredRows.length} Entries
                        </div>
                        <div className="text-xs text-[#677489] text-center">
                            Page {Math.min(currentPage + 1, Math.max(1, Math.ceil(filteredRows.length / pageSize)))} of {Math.max(1, Math.ceil(filteredRows.length / pageSize))}
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                                disabled={currentPage === 0}
                                className={`px-3 py-1 rounded-md border ${currentPage === 0 ? 'text-gray-400 border-gray-200' : 'text-[#111827] border-[#D1D5DB] hover:bg-gray-50'}`}
                            >
                                Previous
                            </button>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(p + 1, Math.max(0, Math.ceil(filteredRows.length / pageSize) - 1)))}
                                disabled={currentPage >= Math.ceil(filteredRows.length / pageSize) - 1}
                                className={`px-3 py-1 rounded-md border ${currentPage >= Math.ceil(rows.length / pageSize) - 1 ? 'text-gray-400 border-gray-200' : 'text-[#111827] border-[#D1D5DB] hover:bg-gray-50'}`}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmDeleteModal
                isOpen={deleteModalOpen}
                clientName={clientToDelete?.name || ""}
                onConfirm={handleDeleteClient}
                onCancel={() => {
                    setDeleteModalOpen(false)
                    setClientToDelete(null)
                }}
            />
        </div>
    )
}

export default ClientsSection