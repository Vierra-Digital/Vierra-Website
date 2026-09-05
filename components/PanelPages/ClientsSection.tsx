import React, { useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import ProfileImage from "../ProfileImage"
import { FiPlus, FiFilter, FiTrash2, FiCheckCircle, FiXCircle, FiEye, FiBriefcase } from 'react-icons/fi'
import PanelSearchInput from "@/components/ui/PanelSearchInput"
import LoadingSpinner from "@/components/ui/LoadingSpinner"
import PanelSectionHeader from "@/components/ui/PanelSectionHeader"
import PaginationControls from "@/components/ui/PaginationControls"
import ConfirmActionModal from "@/components/ui/ConfirmActionModal"
import RowActionMenu, { RowActionMenuItem } from "@/components/ui/RowActionMenu"
import { useRouter } from "next/router"

type ClientRow = {
    id: string
    companyId: string
    name: string
    email: string
    businessName: string
    website: string
    targetAudience: string
    adGoal: string
    brandTone: string
    industry?: string
    monthlyRetainer?: number
    clientGoal?: number | null
    status: string
    isActive: boolean
    isExpired: boolean
    image: boolean
}

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
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

const ClientActionsMenu: React.FC<{
    clientId: string
    clientName: string
    isActive: boolean
    hasImage: boolean
    isAdmin: boolean
    busy: boolean
    onView: () => void
    onSetActive: () => void
    onDelete: () => void
    onToggleStatus: (isActive: boolean) => void
}> = ({ clientName, isActive, isAdmin, busy, onView, onSetActive, onDelete, onToggleStatus }) => {
    return (
        <RowActionMenu label={`Manage ${clientName}`}>
          <RowActionMenuItem onClick={onSetActive} icon={<FiBriefcase className="w-4 h-4" />} tone="accent">
            Work On This Client
          </RowActionMenuItem>
          <RowActionMenuItem onClick={onView} icon={<FiEye className="w-4 h-4" />}>
            Open client workspace
          </RowActionMenuItem>
          {isAdmin && (
            <RowActionMenuItem
                onClick={() => onToggleStatus(!isActive)}
                disabled={busy}
                icon={isActive ? <FiXCircle className="w-4 h-4" /> : <FiCheckCircle className="w-4 h-4" />}
            >
                {isActive ? "Mark As Inactive" : "Mark As Active"}
            </RowActionMenuItem>
          )}
          {isAdmin && (
            <RowActionMenuItem onClick={onDelete} disabled={busy} icon={<FiTrash2 className="w-4 h-4" />} tone="danger">
                Remove Client
            </RowActionMenuItem>
          )}
        </RowActionMenu>
    )
}

interface ClientsSectionProps {
    isAdmin?: boolean
    onAddClient?: () => void
    refreshTrigger?: number
    onViewClient?: (client: Pick<ClientRow, "id" | "name" | "email">) => void
    onSetActiveClient?: (client: Pick<ClientRow, "companyId" | "businessName">) => void
}

const ClientsSection: React.FC<ClientsSectionProps> = ({ isAdmin = false, onAddClient, refreshTrigger, onViewClient, onSetActiveClient }) => {
    const router = useRouter()
    const [rows, setRows] = useState<ClientRow[]>([])
    /**
     * Cache-buster for client avatars, stamped once per load of the list.
     *
     * This was Date.now() inline in the image src, evaluated during render — so every render
     * produced a new URL and the browser re-downloaded every avatar on the page. Any state change
     * did it: typing in the search box, paging, opening a dialog. Stamping it when the list is
     * fetched still picks up a newly uploaded image, which is what the buster is for, without
     * refetching on unrelated renders.
     */
    const [imageStamp, setImageStamp] = useState(() => Date.now())
    const [loading, setLoading] = useState(true)
    const [hasLoaded, setHasLoaded] = useState(false)
    const fetchPending = useRef(false)
    const mutationPending = useRef(false)
    const [updatingClient, setUpdatingClient] = useState<string | null>(null)
    const [rowErrors, setRowErrors] = useState<Record<string, string>>({})
    const [statusNeedsRefresh, setStatusNeedsRefresh] = useState<string | null>(null)
    const [notice, setNotice] = useState("")
    const [deleting, setDeleting] = useState(false)
    const [deleteError, setDeleteError] = useState("")
    const refreshButtonRef = useRef<HTMLButtonElement>(null)
    const [error, setError] = useState<string | null>(null)
    const [currentPage, setCurrentPage] = useState(0)
    const [searchQuery, setSearchQuery] = useState("")
    const [isFilterOpen, setIsFilterOpen] = useState(false)
    const [nameSort, setNameSort] = useState<'none' | 'asc' | 'desc'>("none")
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'pending'>("all")
    const [retainerSort, setRetainerSort] = useState<'none' | 'asc' | 'desc'>("none")
    const [deleteModalOpen, setDeleteModalOpen] = useState(false)
    const [clientToDelete, setClientToDelete] = useState<{ id: string; name: string } | null>(null)
    const hydratingView = useRef(false)
    const pageSize = 10
    useEffect(() => {
        if (!router.isReady) return
        hydratingView.current = true
        const q = router.query
        /* eslint-disable react-hooks/set-state-in-effect */
        setSearchQuery(typeof q.q === "string" ? q.q : "")
        setStatusFilter(["active", "inactive", "pending"].includes(String(q.status)) ? q.status as "active" | "inactive" | "pending" : "all")
        setNameSort(q.nameSort === "asc" || q.nameSort === "desc" ? q.nameSort : "none")
        setRetainerSort(q.retainerSort === "asc" || q.retainerSort === "desc" ? q.retainerSort : "none")
        setCurrentPage(Number.isSafeInteger(Number(q.page)) ? Math.max(0, Number(q.page)) : 0)
        /* eslint-enable react-hooks/set-state-in-effect */
    }, [router.isReady, router.query])

    useEffect(() => {
        if (!router.isReady || router.query.section !== "clients") return
        if (hydratingView.current) { hydratingView.current = false; return }
        const timer = window.setTimeout(() => {
            void router.replace({ pathname: router.pathname, query: { ...router.query, q: searchQuery, status: statusFilter, nameSort, retainerSort, page: currentPage } }, undefined, { shallow: true, scroll: false }).catch(() => {})
        }, 300)
        return () => window.clearTimeout(timer)
    }, [searchQuery, statusFilter, nameSort, retainerSort, currentPage, router])

    const saveView = () => {
        void router.replace({ pathname: router.pathname, query: { ...router.query, q: searchQuery, status: statusFilter, nameSort, retainerSort, page: currentPage } }, undefined, { shallow: true, scroll: false }).catch(() => {})
    }

    const fetchClients = async () => {
        if (fetchPending.current) return false
        fetchPending.current = true
        setError(null)
        try {
            setLoading(true)
            const r = await fetch("/api/admin/clients")
            if (!r.ok) throw new Error("Could not load clients. Try again.")
            const data: ClientRow[] = await r.json()
            if (!Array.isArray(data)) throw new Error("Could not load clients. Try again.")
            setRows(data)
            setHasLoaded(true)
            setStatusNeedsRefresh(null)
            setRowErrors({})
            setImageStamp(Date.now())
            return true
        } catch {
            setError("Could not load clients. Try again.")
            return false
        } finally {
            fetchPending.current = false
            setLoading(false)
        }
    }

    useEffect(() => {
        // Loading the client list on mount; the fetch flips its own loading state after awaiting.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchClients()
    }, [])

    useEffect(() => {
        if (refreshTrigger && refreshTrigger > 0) {
            // Re-fetches when the parent bumps refreshTrigger after adding or editing a client.
            // eslint-disable-next-line react-hooks/set-state-in-effect
            fetchClients()
        }
    }, [refreshTrigger])

    const handleDeleteClient = async () => {
        if (!clientToDelete || mutationPending.current || fetchPending.current) return
        mutationPending.current = true
        setDeleting(true)
        setDeleteError("")
        setNotice("")
        try {
            const r = await fetch(`/api/admin/deleteClient?clientId=${clientToDelete.id}`, {
                method: "DELETE",
            })
            
            if (!r.ok) {
                throw new Error("Could not confirm removal. Close this dialog and refresh the list before trying again.")
            }
            const result = await r.json()
            if (result?.clientId !== clientToDelete.id) throw new Error("Unexpected removal response")
            setRows(prev => prev.filter(client => client.id !== clientToDelete.id))
            setNotice(`Removed ${clientToDelete.name}.`)
            setDeleteModalOpen(false)
            setClientToDelete(null)
            requestAnimationFrame(() => refreshButtonRef.current?.focus())
        } catch {
            setDeleteError("Could not confirm removal. Close this dialog and refresh the list before trying again.")
        } finally {
            mutationPending.current = false
            setDeleting(false)
        }
    }

    const openDeleteModal = (client: { id: string; name: string }) => {
        setDeleteError("")
        setClientToDelete(client)
        setDeleteModalOpen(true)
    }

    const handleToggleStatus = async (clientId: string, newStatus: boolean) => {
        if (mutationPending.current || fetchPending.current || statusNeedsRefresh) return
        mutationPending.current = true
        setUpdatingClient(clientId)
        setNotice("")
        setRowErrors(prev => ({ ...prev, [clientId]: "" }))
        try {
            const r = await fetch("/api/admin/toggleClientStatus", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ clientId, isActive: newStatus }),
            })
            
            if (!r.ok) {
                throw new Error("Could not confirm status change.")
            }
            const result = await r.json()
            if (result?.clientId !== clientId || result?.isActive !== newStatus) throw new Error("Unexpected status response")
            const refreshed = await fetchClients()
            if (!refreshed) {
                setStatusNeedsRefresh(clientId)
                setRowErrors(prev => ({ ...prev, [clientId]: "Status saved, but the list could not be refreshed. Refresh to see the current status." }))
            } else {
                const name = rows.find(client => client.id === clientId)?.name || "Client"
                setNotice(`${name}: status updated.`)
            }
        } catch {
            setStatusNeedsRefresh(clientId)
            setRowErrors(prev => ({ ...prev, [clientId]: "Could not confirm the status change. Refresh the list before trying again." }))
        } finally {
            mutationPending.current = false
            setUpdatingClient(null)
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
        if (statusFilter !== 'all') {
            base = base.filter((r) => {
                const statusKey = r.status === 'completed' ? 'active' : (r.status === 'pending' || r.status === 'in_progress') ? 'pending' : 'inactive'
                return statusKey === statusFilter
            })
        }
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

    // Page index clamped rather than reset from an effect. Searching to a shorter list could leave
    // currentPage past the end, and slicing beyond the array renders an empty table with nothing to
    // explain it; the old effect only covered searchQuery, not the status or sort filters.
    const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize))
    const page = Math.min(currentPage, totalPages - 1)
    const hasFilters = Boolean(searchQuery.trim() || statusFilter !== "all" || nameSort !== "none" || retainerSort !== "none")
    const clearFilters = () => {
        setSearchQuery("")
        setStatusFilter("all")
        setNameSort("none")
        setRetainerSort("none")
        setCurrentPage(0)
    }

    return (
        <>
        <div className="flex-1 flex justify-center px-6 pt-2">
            <div className="mx-auto w-full max-w-[1680px] flex flex-col h-full">
                <PanelSectionHeader
                    title="Clients"
                    actions={
                      <>
                        <PanelSearchInput
                          id="clients-search"
                          value={searchQuery}
                          onChange={setSearchQuery}
                          placeholder="Search Clients"
                          label="Search Clients"
                        />
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
                      </>
                    }
                />
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <button type="button" onClick={saveView} className="rounded text-sm text-[#701CC0] underline">Save filters to page link</button>
                    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter clients by status">
                        {(["all", "active", "pending", "inactive"] as const).map(status => (
                            <button key={status} type="button" aria-pressed={statusFilter === status} onClick={() => { setStatusFilter(status); setCurrentPage(0); }} className={`rounded-full border px-3 py-1.5 text-sm capitalize focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#701CC0] ${statusFilter === status ? "border-[#701CC0] bg-purple-50 text-[#701CC0]" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                                {status === "all" ? "All clients" : status}
                            </button>
                        ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                        {hasLoaded && <span>{filteredRows.length} of {rows.length} clients</span>}
                        {hasFilters && <button type="button" onClick={clearFilters} className="rounded font-medium text-[#701CC0] underline">Clear filters</button>}
                        <button ref={refreshButtonRef} type="button" disabled={loading || Boolean(updatingClient) || deleting} onClick={() => void fetchClients()} className="rounded border border-gray-200 px-3 py-2 disabled:opacity-50">{loading ? "Refreshing…" : "Refresh clients"}</button>
                    </div>
                </div>
                {(searchQuery.trim() || nameSort !== "none" || retainerSort !== "none") && <p className="mb-3 text-sm text-gray-600">
                    {searchQuery.trim() && <>Search: “{searchQuery.trim()}”. </>}
                    {retainerSort !== "none" ? `Retainer: ${retainerSort === "asc" ? "low to high" : "high to low"}.` : nameSort !== "none" ? `Name: ${nameSort === "asc" ? "A–Z" : "Z–A"}.` : ""}
                </p>}
                {notice && <p role="status" className="mb-3 text-sm text-green-700">{notice}</p>}
                {error && <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    <p>{error} {hasLoaded ? "Showing previously loaded clients." : ""}</p>
                    <button type="button" disabled={loading || Boolean(updatingClient) || deleting} onClick={() => void fetchClients()} className="mt-2 rounded font-medium underline disabled:opacity-50">Retry loading clients</button>
                </div>}
                {loading && !hasLoaded ? (
                    <div className="flex items-center justify-center py-12">
                        <LoadingSpinner label="Loading Client Data..." />
                    </div>
                ) : (
                    <>
                        {hasLoaded && filteredRows.length === 0 && (
                            <div className="text-center py-12">
                                <div className="w-full h-full flex flex-col items-center justify-center text-center">
                                    <Image src="/assets/no-client.png" alt="No clients" width={224} height={224} className="w-56 h-auto mb-3" />
                                    <p className="text-sm text-gray-500 mb-3">{hasFilters ? "No clients match your filters." : "You have no clients added."}</p>
                                    {hasFilters ? <button type="button" onClick={clearFilters} className="rounded text-sm font-medium text-[#701CC0] underline">Clear filters</button> : <button
                                        onClick={onAddClient}
                                        className="inline-flex items-center px-4 py-2 rounded-lg bg-[#701CC0] text-white text-sm hover:bg-[#5f17a5]"
                                    >
                                        <FiPlus className="w-4 h-4 mr-2" />
                                        Add Client
                                    </button>}
                                </div>
                            </div>
                        )}

                        {hasLoaded && filteredRows.length > 0 && (
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
                                            {filteredRows.slice(page * pageSize, (page + 1) * pageSize).map((r) => (
                                                <tr key={r.id} className="hover:bg-purple-50">
                                                    <td className="px-4 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <ProfileImage
                                                                src={r.image ? `/api/admin/getClientImage?clientId=${r.id}&t=${imageStamp}` : null}
                                                                name={r.name}
                                                                size={32}
                                                                alt={`${r.name}'s profile`}
                                                            />
                                                            <div className="flex flex-col">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => onViewClient?.({ id: r.id, name: r.name, email: r.email })}
                                                                    aria-label={`Open client workspace for ${r.name || r.email}`}
                                                                    id={`open-client-${r.id}`}
                                                                    className="text-sm font-medium text-[#111827] hover:text-[#701CC0] hover:underline text-left"
                                                                >
                                                                    {r.name || "—"}
                                                                </button>
                                                                <div className="text-sm text-[#6B7280]">{r.email || ""}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4 text-sm text-[#111827]">{r.businessName || "—"}</td>
                                                    <td className="px-4 py-4 text-sm text-[#111827]">{r.industry || r.targetAudience || "—"}</td>
                                                    <td className="px-4 py-4 text-sm text-[#111827]">{typeof r.monthlyRetainer === 'number' ? `$${r.monthlyRetainer.toLocaleString()}` : "—"}</td>
                                                    <td className="px-4 py-4 text-sm text-[#111827]">
                                                        {typeof r.clientGoal === "number"
                                                            ? `${r.clientGoal.toLocaleString()} ${r.clientGoal === 1 ? "Lead" : "leads"}`
                                                            : "N/A"}
                                                    </td>
                                                    <td className="px-4 py-4 text-sm">
                                                        {updatingClient === r.id ? <span role="status">Updating…</span> : statusNeedsRefresh === r.id ? <span className="text-amber-700">Refresh required</span> : <StatusBadge status={r.status} />}
                                                        {rowErrors[r.id] && <div role="alert" className="mt-2 max-w-xs text-xs text-red-700">
                                                            {rowErrors[r.id]}
                                                            <button type="button" disabled={loading || Boolean(updatingClient)} onClick={() => void fetchClients()} className="mt-1 block rounded font-medium underline disabled:opacity-50">Refresh status</button>
                                                        </div>}
                                                    </td>
                                                    <td className="px-4 py-4 text-sm text-[#6B7280]">
                                                        <ClientActionsMenu
                                                            clientId={r.id}
                                                            clientName={r.name}
                                                            isActive={r.isActive}
                                                            hasImage={r.image}
                                                            isAdmin={isAdmin}
                                                            busy={loading || Boolean(updatingClient) || deleting || Boolean(statusNeedsRefresh)}
                                                            onView={() => onViewClient?.({ id: r.id, name: r.name, email: r.email })}
                                                            onSetActive={() => onSetActiveClient?.({ companyId: r.companyId, businessName: r.businessName })}
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

                {hasLoaded && filteredRows.length > 0 && (
                    <PaginationControls
                      currentPage={page}
                      totalPages={totalPages}
                      onPrevious={() => setCurrentPage(Math.max(0, page - 1))}
                      onNext={() =>
                        setCurrentPage(Math.min(totalPages - 1, page + 1))
                      }
                    />
                )}
            </div>
        </div>

        <ConfirmActionModal
          isOpen={deleteModalOpen}
          title="Remove Client"
          message={
            <>
              Are you sure you want to remove{" "}
              <span className="font-semibold text-[#111827]">{clientToDelete?.name || ""}</span>? This action is permanent
              and cannot be undone.
            </>
          }
          confirmLabel="Remove Client"
          busy={deleting}
          busyLabel="Removing…"
          error={deleteError}
          onConfirm={handleDeleteClient}
          onCancel={() => {
            if (mutationPending.current) return
            setDeleteModalOpen(false)
            setClientToDelete(null)
          }}
        />
        </>
    )
}

export default ClientsSection
