import React, { useEffect, useMemo, useState, useRef } from "react"
import Image from "next/image"
import ProfileImage from "../ProfileImage"
import { FiPlus, FiSearch, FiFilter, FiTrash2, FiCheckCircle, FiXCircle } from 'react-icons/fi'
import { MoreVertical } from "lucide-react"

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
    image: boolean
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
                    <h3 className="text-xl font-semibold text-[#111827]">Remove Client</h3>
                </div>
                <p className="text-sm text-[#6B7280] mb-6">
                    Are you sure you want to remove <span className="font-semibold text-[#111827]">{clientName}</span>? 
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
                        Remove Client
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
    hasImage: boolean
    onDelete: () => void
    onToggleStatus: (isActive: boolean) => void
}> = ({ clientId, clientName, isActive, onDelete, onToggleStatus }) => {
    const [isOpen, setIsOpen] = useState(false)
    const [position, setPosition] = useState<{ top: number; right: number } | null>(null)
    const buttonRef = useRef<HTMLButtonElement>(null)
    const menuRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node) && 
                buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
                setIsOpen(false)
                setPosition(null)
            }
        }

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside)
            return () => document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [isOpen])

    useEffect(() => {
        if (isOpen && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect()
            const dropdownHeight = 150 // Approximate height
            const viewportHeight = window.innerHeight
            const viewportMiddle = viewportHeight / 2
            
            // Show below if in first half of page, above if in bottom half
            const showAbove = rect.top > viewportMiddle
            
            setPosition({
                top: showAbove ? rect.top - dropdownHeight - 2 : rect.bottom + 2,
                right: window.innerWidth - rect.right,
            })
        } else {
            setPosition(null)
        }
    }, [isOpen])

    return (
        <div className="relative">
            <button
                ref={buttonRef}
                onClick={() => setIsOpen(!isOpen)}
                aria-label={`Manage ${clientName}`}
                className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
            >
                <MoreVertical className="w-4 h-4 text-[#6B7280]" />
            </button>
            {isOpen && position && (
                <div 
                    ref={menuRef}
                    className="fixed w-48 bg-white rounded-lg shadow-xl border border-[#E5E7EB] py-1 z-[100]"
                    style={{
                        top: `${position.top}px`,
                        right: `${position.right}px`
                    }}
                >
                    <button
                        onClick={() => {
                            setIsOpen(false)
                            setPosition(null)
                            onToggleStatus(!isActive)
                        }}
                        className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 ${
                            isActive ? 'text-orange-600' : 'text-green-600'
                        }`}
                    >
                        {isActive ? (
                            <>
                                <FiXCircle className="w-4 h-4" />
                                Mark As Inactive
                            </>
                        ) : (
                            <>
                                <FiCheckCircle className="w-4 h-4" />
                                Mark As Active
                            </>
                        )}
                    </button>
                    <button
                        onClick={() => {
                            setIsOpen(false)
                            setPosition(null)
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

interface ClientsSectionProps { 
    onAddClient?: () => void
    refreshTrigger?: number
}

const ClientsSection: React.FC<ClientsSectionProps> = ({ onAddClient, refreshTrigger }) => {
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

    useEffect(() => {
        if (refreshTrigger && refreshTrigger > 0) {
            fetchClients()
        }
    }, [refreshTrigger])

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
        <>
        <div className="flex-1 flex justify-center px-6 pt-2">
            <div className="w-full max-w-6xl flex flex-col h-full">
                <div className="w-full flex justify-between items-center mb-2">
                    <div>
                        <h1 className="text-2xl font-semibold text-[#111827] mt-6 mb-6">Clients</h1>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 shadow-sm border border-transparent focus-within:ring-2 focus-within:ring-[#701CC0] transition">
                            <FiSearch className="w-4 h-4 text-[#701CC0] flex-shrink-0" />
                            <label htmlFor="clients-search" className="sr-only">Search Clients</label>
                            <input
                                id="clients-search"
                                type="search"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search Clients"
                                className="w-64 md:w-80 text-sm text-[#111827] placeholder:text-[#9CA3AF] bg-transparent outline-none"
                            />
                        </div>
                        <div className="relative" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsFilterOpen(false) }} tabIndex={-1}>
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
                                        <h3 className="text-sm font-semibold text-[#111827] mb-4">Sort & Filter</h3>
                                        
                                        {/* Sort By */}
                                        <div className="mb-5">
                                            <label className="block text-xs font-medium text-[#6B7280] mb-2">Sort By</label>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => { setNameSort('asc'); setRetainerSort('none'); }}
                                                    className={`flex-1 text-xs py-2 px-3 rounded-lg font-medium transition-colors duration-200 ${
                                                        nameSort === 'asc' 
                                                            ? 'bg-[#701CC0] text-white shadow-sm' 
                                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                    }`}
                                                >
                                                    Name A-Z
                                                </button>
                                                <button
                                                    onClick={() => { setNameSort('desc'); setRetainerSort('none'); }}
                                                    className={`flex-1 text-xs py-2 px-3 rounded-lg font-medium transition-colors duration-200 ${
                                                        nameSort === 'desc' 
                                                            ? 'bg-[#701CC0] text-white shadow-sm' 
                                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                    }`}
                                                >
                                                    Name Z-A
                                                </button>
                                            </div>
                                        </div>

                                        {/* Retainer Sort */}
                                        <div className="mb-5">
                                            <label className="block text-xs font-medium text-[#6B7280] mb-2">Monthly Retainer</label>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => { setRetainerSort('asc'); setNameSort('none'); }}
                                                    className={`flex-1 text-xs py-2 px-3 rounded-lg font-medium transition-colors duration-200 ${
                                                        retainerSort === 'asc' 
                                                            ? 'bg-[#701CC0] text-white shadow-sm' 
                                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                    }`}
                                                >
                                                    Low → High
                                                </button>
                                                <button
                                                    onClick={() => { setRetainerSort('desc'); setNameSort('none'); }}
                                                    className={`flex-1 text-xs py-2 px-3 rounded-lg font-medium transition-colors duration-200 ${
                                                        retainerSort === 'desc' 
                                                            ? 'bg-[#701CC0] text-white shadow-sm' 
                                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                    }`}
                                                >
                                                    High → Low
                                                </button>
                                            </div>
                                        </div>

                                        {/* Status Filter */}
                                        <div className="mb-4">
                                            <label className="block text-xs font-medium text-[#6B7280] mb-2">Status</label>
                                            <div className="relative">
                                                <select
                                                    value={statusFilter}
                                                    onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive' | 'pending')}
                                                    className="w-full text-sm border border-[#E5E7EB] rounded-lg px-3 py-2 pr-10 bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#701CC0] focus:border-transparent appearance-none"
                                                >
                                                    <option value="all">All Status</option>
                                                    <option value="active">Active</option>
                                                    <option value="inactive">Inactive</option>
                                                    <option value="pending">Pending</option>
                                                </select>
                                                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                                    <svg className="w-4 h-4 text-[#6B7280]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                    </svg>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        {/* Clear Button */}
                                        <div className="pt-3 border-t border-[#E5E7EB]">
                                            <button
                                                onClick={() => {
                                                    setNameSort('none')
                                                    setRetainerSort('none')
                                                    setStatusFilter('all')
                                                    setIsFilterOpen(false)
                                                }}
                                                className="w-full text-xs py-2 px-3 rounded-lg font-medium text-[#6B7280] bg-gray-50 hover:bg-gray-100 hover:text-[#374151] transition-colors duration-200"
                                            >
                                                Clear All Filters
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                    </div>
                        <button
                            onClick={onAddClient}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-[#701CC0] text-white rounded-lg hover:bg-[#5f17a5] text-sm font-medium"
                        >
                            <FiPlus className="w-4 h-4" />
                            Add Client
                        </button>
                </div>
            </div>
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="text-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#701CC0] mx-auto"></div>
                            <p className="mt-2 text-sm text-[#6B7280]">Loading Client Data...</p>
                        </div>
                    </div>
                ) : (
                    <>
                        {!loading && filteredRows.length === 0 && (
                            <div className="text-center py-12">
                                <div className="w-full h-full flex flex-col items-center justify-center text-center">
                                    <Image src="/assets/no-client.png" alt="No clients" width={224} height={224} className="w-56 h-auto mb-3" />
                                    <p className="text-sm text-gray-500 mb-3">You have no clients added.</p>
                                    <button
                                        onClick={onAddClient}
                                        className="inline-flex items-center px-4 py-2 rounded-lg bg-[#701CC0] text-white text-sm hover:bg-[#5f17a5]"
                                    >
                                        <FiPlus className="w-4 h-4 mr-2" />
                                        Add Client
                                    </button>
                                </div>
                            </div>
                        )}

                        {!loading && filteredRows.length > 0 && (
                            <div className="bg-white rounded-lg shadow-sm border border-[#E5E7EB] overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                                            <tr>
                                                {columns.map((c) => (
                                                    <th key={c.key} className="px-4 py-3 text-left text-xs font-medium text-[#6B7280] uppercase tracking-wider">
                                                        {c.header}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-[#E5E7EB]">
                                            {filteredRows.slice(currentPage * pageSize, (currentPage + 1) * pageSize).map((r) => (
                                                <tr key={r.id} className="hover:bg-purple-50">
                                                    <td className="px-4 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <ProfileImage
                                                                src={r.image ? `/api/admin/getClientImage?clientId=${r.id}&t=${Date.now()}` : null}
                                                                name={r.name}
                                                                size={32}
                                                                alt={`${r.name}'s profile`}
                                                            />
                                                            <div className="flex flex-col">
                                                                <div className="text-sm font-medium text-[#111827]">{r.name || "—"}</div>
                                                                <div className="text-sm text-[#6B7280]">{r.email || ""}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4 text-sm text-[#111827]">{r.businessName || "—"}</td>
                                                    <td className="px-4 py-4 text-sm text-[#111827]">{r.industry || r.targetAudience || "—"}</td>
                                                    <td className="px-4 py-4 text-sm text-[#111827]">{typeof r.monthlyRetainer === 'number' ? `$${r.monthlyRetainer.toLocaleString()}` : "—"}</td>
                                                    <td className="px-4 py-4 text-sm text-[#111827]">{r.clientGoal || r.adGoal || "—"}</td>
                                                    <td className="px-4 py-4 text-sm"><StatusBadge status={r.status} /></td>
                                                    <td className="px-4 py-4 text-sm text-[#6B7280]">
                                                        <ClientActionsMenu
                                                            clientId={r.id}
                                                            clientName={r.name}
                                                            isActive={r.isActive}
                                                            hasImage={r.image}
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
                        )}
                    </>
                )}

            {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
                {!loading && filteredRows.length > 0 && (
                    <div className="mt-4 pt-4 text-xs text-[#677489]">
                        <div className="w-full flex items-center justify-center">
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                                    disabled={currentPage === 0}
                                    className="px-2 py-1 text-xs rounded border border-[#E5E7EB] hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Previous
                                </button>
                                <span className="text-xs text-[#6B7280]">
                                    Page {currentPage + 1} of {Math.max(1, Math.ceil(filteredRows.length / pageSize))}
                                </span>
                                <button
                                    onClick={() => setCurrentPage(Math.min(Math.ceil(filteredRows.length / pageSize) - 1, currentPage + 1))}
                                    disabled={currentPage >= Math.ceil(filteredRows.length / pageSize) - 1}
                                    className="px-2 py-1 text-xs rounded border border-[#E5E7EB] hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>

        <ConfirmDeleteModal
                isOpen={deleteModalOpen}
                clientName={clientToDelete?.name || ""}
                onConfirm={handleDeleteClient}
                onCancel={() => {
                    setDeleteModalOpen(false)
                    setClientToDelete(null)
                }}
            />
        </>
    )
}

export default ClientsSection