import React, { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import ProfileImage from "../ProfileImage"
import { FiPlus, FiFilter, FiTrash2, FiCheckCircle, FiXCircle, FiEye, FiChevronDown } from 'react-icons/fi'
import LoadingSpinner from "@/components/ui/LoadingSpinner"
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
import ConfirmActionModal from "@/components/ui/ConfirmActionModal"
import RowActionMenu, { RowActionMenuItem } from "@/components/ui/RowActionMenu"

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
    clientGoal?: number | null
    status: string
    isActive: boolean
    isExpired: boolean
    image: boolean
}

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
    if (status === "completed") return <PanelBadge tone="positive">Active</PanelBadge>
    if (status === "pending" || status === "in_progress") return <PanelBadge tone="warning">Pending</PanelBadge>
    return <PanelBadge tone="danger">Inactive</PanelBadge>
}

const ClientActionsMenu: React.FC<{
    clientId: string
    clientName: string
    isActive: boolean
    hasImage: boolean
    onView: () => void
    onDelete: () => void
    onToggleStatus: (isActive: boolean) => void
}> = ({ clientName, isActive, onView, onDelete, onToggleStatus }) => {
    return (
        <RowActionMenu label={`Manage ${clientName}`}>
          <RowActionMenuItem onClick={onView} icon={<FiEye className="w-4 h-4" />}>
            View Client
          </RowActionMenuItem>
          <RowActionMenuItem
            onClick={() => onToggleStatus(!isActive)}
            icon={isActive ? <FiXCircle className="w-4 h-4" /> : <FiCheckCircle className="w-4 h-4" />}
          >
            {isActive ? "Mark As Inactive" : "Mark As Active"}
          </RowActionMenuItem>
          <RowActionMenuItem onClick={onDelete} icon={<FiTrash2 className="w-4 h-4" />} tone="danger">
            Remove Client
          </RowActionMenuItem>
        </RowActionMenu>
    )
}

interface ClientsSectionProps { 
    onAddClient?: () => void
    refreshTrigger?: number
    onViewClient?: (client: Pick<ClientRow, "id" | "name" | "email">) => void
}

const ClientsSection: React.FC<ClientsSectionProps> = ({ onAddClient, refreshTrigger, onViewClient }) => {
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
            setImageStamp(Date.now())
        } catch (e: any) {
            setError(e?.message ?? "Failed to load clients")
        } finally {
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
        if (!clientToDelete) return

        try {
            const r = await fetch(`/api/admin/deleteClient?clientId=${clientToDelete.id}`, {
                method: "DELETE",
            })
            
            if (!r.ok) {
                const data = await r.json()
                throw new Error(data.message || `HTTP ${r.status}`)
            }
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
            await fetchClients()
        } catch (e: any) {
            setError(e?.message ?? "Failed to update client status")
        }
    }


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

    return (
        <>
        <PanelPage>
            <PanelHeader title="Clients">
                <PanelSearch
                    id="clients-search"
                    label="Search Clients"
                    placeholder="Search clients"
                    value={searchQuery}
                    onChange={setSearchQuery}
                />
                <div
                    className="relative"
                    onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsFilterOpen(false) }}
                    tabIndex={-1}
                >
                    <PanelButton onClick={() => setIsFilterOpen((v) => !v)} icon={<FiFilter className="h-4 w-4" />}>
                        Filter
                        <FiChevronDown className={`h-3.5 w-3.5 transition-transform ${isFilterOpen ? "rotate-180" : ""}`} />
                    </PanelButton>
                    {isFilterOpen && (
                        <PanelPopover>
                            <h3 className="mb-3 text-[13px] font-semibold text-[#111827]">Sort &amp; Filter</h3>
                            <div className="mb-4">
                                <span className="mb-1.5 block text-[11px] font-medium text-[#6B7280]">Name</span>
                                <div className="flex gap-2">
                                    {([["asc", "A–Z"], ["desc", "Z–A"]] as const).map(([dir, label]) => (
                                        <button
                                            key={dir}
                                            type="button"
                                            onClick={() => { setNameSort(dir); setRetainerSort("none") }}
                                            className={`h-8 flex-1 rounded-lg text-[12px] font-medium transition-colors ${
                                                nameSort === dir ? "bg-[#701CC0] text-white" : "bg-[#F3F1F8] text-[#5B5468] hover:bg-[#EAE6F3]"
                                            }`}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="mb-4">
                                <span className="mb-1.5 block text-[11px] font-medium text-[#6B7280]">Monthly Retainer</span>
                                <div className="flex gap-2">
                                    {([["asc", "Low → High"], ["desc", "High → Low"]] as const).map(([dir, label]) => (
                                        <button
                                            key={dir}
                                            type="button"
                                            onClick={() => { setRetainerSort(dir); setNameSort("none") }}
                                            className={`h-8 flex-1 rounded-lg text-[12px] font-medium transition-colors ${
                                                retainerSort === dir ? "bg-[#701CC0] text-white" : "bg-[#F3F1F8] text-[#5B5468] hover:bg-[#EAE6F3]"
                                            }`}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <PanelSelect
                                label="Status"
                                value={statusFilter}
                                onChange={(value) => setStatusFilter(value as typeof statusFilter)}
                                options={[
                                    { value: "all", label: "All Status" },
                                    { value: "active", label: "Active" },
                                    { value: "inactive", label: "Inactive" },
                                    { value: "pending", label: "Pending" },
                                ]}
                            />
                            <PanelClearFilters
                                onClick={() => {
                                    setNameSort("none")
                                    setRetainerSort("none")
                                    setStatusFilter("all")
                                    setIsFilterOpen(false)
                                }}
                            />
                        </PanelPopover>
                    )}
                </div>
                <PanelButton variant="primary" onClick={onAddClient} icon={<FiPlus className="h-4 w-4" />}>
                    Add Client
                </PanelButton>
            </PanelHeader>

            <PanelDataTable<ClientRow>
                rows={filteredRows}
                getRowKey={(r) => r.id}
                loading={loading}
                loadingLabel={<LoadingSpinner label="Loading Client Data..." />}
                page={page}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                emptyTitle={searchQuery ? "No Clients Found" : "No Clients Yet"}
                emptyMessage={
                    searchQuery ? "No clients match your search." : "Clients you add will appear here."
                }
                emptyImage={<Image src="/assets/no-client.png" alt="" width={176} height={176} className="h-auto w-44" priority />}
                emptyAction={
                    !searchQuery ? (
                        <PanelButton variant="primary" onClick={onAddClient} icon={<FiPlus className="h-4 w-4" />}>
                            Add Client
                        </PanelButton>
                    ) : null
                }
                columns={[
                    {
                        key: "name",
                        header: "Client Name",
                        cell: (r) => (
                            <div className="flex items-center gap-3">
                                <ProfileImage
                                    src={r.image ? `/api/admin/getClientImage?clientId=${r.id}&t=${imageStamp}` : null}
                                    name={r.name}
                                    size={32}
                                    alt={`${r.name}'s profile`}
                                />
                                <div className="min-w-0">
                                    <button
                                        type="button"
                                        onClick={() => onViewClient?.({ id: r.id, name: r.name, email: r.email })}
                                        className="block max-w-full truncate text-left font-medium text-[#111827] transition-colors hover:text-[#701CC0]"
                                    >
                                        {r.name || "—"}
                                    </button>
                                    <div className="truncate text-[12px] text-[#6B7280]">{r.email || ""}</div>
                                </div>
                            </div>
                        ),
                    },
                    { key: "business", header: "Business Name", cell: (r) => r.businessName || <PanelEmptyCell /> },
                    { key: "industry", header: "Industry", cell: (r) => r.industry || r.targetAudience || <PanelEmptyCell /> },
                    {
                        key: "retainer",
                        header: "Monthly Retainer ($)",
                        className: "tabular-nums",
                        cell: (r) =>
                            typeof r.monthlyRetainer === "number" ? `$${r.monthlyRetainer.toLocaleString()}` : <PanelEmptyCell />,
                    },
                    {
                        key: "goal",
                        header: "Client Goal",
                        className: "tabular-nums",
                        cell: (r) =>
                            typeof r.clientGoal === "number"
                                ? `${r.clientGoal.toLocaleString()} ${r.clientGoal === 1 ? "Lead" : "Leads"}`
                                : <PanelEmptyCell />,
                    },
                    { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
                    {
                        key: "manage",
                        header: "Manage",
                        className: "relative",
                        cell: (r) => (
                            <ClientActionsMenu
                                clientId={r.id}
                                clientName={r.name}
                                isActive={r.isActive}
                                hasImage={r.image}
                                onView={() => onViewClient?.({ id: r.id, name: r.name, email: r.email })}
                                onDelete={() => openDeleteModal({ id: r.id, name: r.name })}
                                onToggleStatus={(newStatus) => handleToggleStatus(r.id, newStatus)}
                            />
                        ),
                    },
                ]}
            />

            {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
        </PanelPage>

        <ConfirmActionModal
          isOpen={deleteModalOpen}
          title="Remove Client"
          message={
            <>
              Are you sure you want to remove{" "}
              <span className="font-semibold text-[#111827]">{clientToDelete?.name || ""}</span>? This action is permanent
              and cannot be undone. All associated data will be removed.
            </>
          }
          confirmLabel="Remove Client"
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