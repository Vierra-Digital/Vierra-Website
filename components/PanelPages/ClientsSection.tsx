import React, { useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import ProfileImage from "../ProfileImage"
import { FiPlus, FiFilter, FiChevronDown, FiTrash2, FiCheckCircle, FiXCircle, FiEye, FiBriefcase } from 'react-icons/fi'
import LoadingSpinner from "@/components/ui/LoadingSpinner"
import {
    PanelBulkBar,
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
    triggerId?: string
    onSetActive: () => void
    onDelete: () => void
    onToggleStatus: (isActive: boolean) => void
}> = ({ clientName, isActive, isAdmin, busy, onView, onSetActive, onDelete, onToggleStatus, triggerId }) => {
    return (
        <RowActionMenu label={`Manage ${clientName}`} triggerId={triggerId}>
          <RowActionMenuItem onClick={onSetActive} icon={<FiBriefcase className="w-4 h-4" />}>
            Work On This Client
          </RowActionMenuItem>
          <RowActionMenuItem onClick={onView} icon={<FiEye className="w-4 h-4" />}>
            Open Client Workspace
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
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false)
    const [bulkDeleting, setBulkDeleting] = useState(false)
    const [bulkDeleteError, setBulkDeleteError] = useState("")
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

    const toggleRowSelection = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const togglePageSelection = (keys: string[], nextChecked: boolean) => {
        setSelectedIds(prev => {
            const next = new Set(prev)
            for (const key of keys) {
                if (nextChecked) next.add(key)
                else next.delete(key)
            }
            return next
        })
    }

    const clearSelection = () => setSelectedIds(new Set())

    const handleBulkDeleteClients = async () => {
        if (activeSelectedIds.size === 0 || mutationPending.current || fetchPending.current) return
        mutationPending.current = true
        setBulkDeleting(true)
        setBulkDeleteError("")
        setNotice("")
        const targets = rows.filter(client => activeSelectedIds.has(client.id))
        // Sequential, not Promise.all: this hits the same admin delete route per client (each of
        // which also calls out to Supabase Auth), and a bulk removal is rare enough that there's no
        // reason to fire a burst of concurrent admin-auth calls when one at a time is safer.
        const failedIds = new Set<string>()
        const failedNames: string[] = []
        for (const client of targets) {
            try {
                const r = await fetch(`/api/admin/deleteClient?clientId=${client.id}`, { method: "DELETE" })
                if (!r.ok) throw new Error("failed")
                const result = await r.json()
                if (result?.clientId !== client.id) throw new Error("failed")
            } catch {
                failedIds.add(client.id)
                failedNames.push(client.name || client.id)
            }
        }
        const removedIds = new Set(targets.filter(c => !failedIds.has(c.id)).map(c => c.id))
        setRows(prev => prev.filter(client => !removedIds.has(client.id)))
        setSelectedIds(new Set())
        if (failedIds.size > 0) {
            setBulkDeleteError(
                failedIds.size === targets.length
                    ? "Could not remove any of the selected clients. Close this dialog and try again."
                    : `Removed ${targets.length - failedIds.size} of ${targets.length}. Failed: ${failedNames.join(", ")}.`
            )
        } else {
            setNotice(`Removed ${targets.length} client${targets.length === 1 ? "" : "s"}.`)
            setBulkDeleteModalOpen(false)
        }
        mutationPending.current = false
        setBulkDeleting(false)
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

    // Derived, not synced via an effect: a refetch or a single-row delete can drop ids that are
    // still in selectedIds, and re-deriving here (rather than pruning selectedIds itself in an
    // effect) keeps the bulk bar's count from ever including a row that's already gone.
    const activeSelectedIds = new Set<string>()
    for (const row of rows) {
        if (selectedIds.has(row.id)) activeSelectedIds.add(row.id)
    }

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

            {isAdmin && (
                <PanelBulkBar count={activeSelectedIds.size} onClear={clearSelection} label={(n) => `${n} client${n === 1 ? "" : "s"} selected`}>
                    <PanelButton
                        onClick={() => { setBulkDeleteError(""); setBulkDeleteModalOpen(true) }}
                        icon={<FiTrash2 className="h-4 w-4" />}
                    >
                        Remove
                    </PanelButton>
                </PanelBulkBar>
            )}

            <PanelDataTable<ClientRow>
                rows={filteredRows}
                getRowKey={(r) => r.id}
                loading={loading}
                loadingLabel={<LoadingSpinner label="Loading Client Data..." />}
                page={page}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                emptyTitle={hasFilters ? "No Clients Found" : "No Clients Yet"}
                emptyMessage={
                    hasFilters ? "No clients match your search." : "Clients you add will appear here."
                }
                emptyImage={<Image src="/assets/no-client.png" alt="" width={176} height={176} className="h-auto w-44" priority />}
                emptyAction={
                    hasFilters ? (
                        <PanelButton onClick={clearFilters}>Clear All Filters</PanelButton>
                    ) : (
                        <PanelButton variant="primary" onClick={onAddClient} icon={<FiPlus className="h-4 w-4" />}>
                            Add Client
                        </PanelButton>
                    )
                }
                selection={
                    isAdmin
                        ? {
                              selectedKeys: activeSelectedIds,
                              onToggleRow: toggleRowSelection,
                              onTogglePage: togglePageSelection,
                          }
                        : undefined
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
                    {
                        key: "status",
                        header: "Status",
                        cell: (r) =>
                            updatingClient === r.id ? (
                                <span role="status" className="text-[12px] text-[#6B7280]">Updating…</span>
                            ) : statusNeedsRefresh === r.id ? (
                                <span className="text-[12px] text-amber-700">Refresh required</span>
                            ) : (
                                <StatusBadge status={r.status} />
                            ),
                    },
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
                                isAdmin={isAdmin}
                                busy={updatingClient === r.id || deleting}
                                triggerId={`open-client-${r.id}`}
                                onView={() => onViewClient?.({ id: r.id, name: r.name, email: r.email })}
                                onSetActive={() => onSetActiveClient?.({ companyId: r.companyId, businessName: r.businessName })}
                                onDelete={() => openDeleteModal({ id: r.id, name: r.name })}
                                onToggleStatus={(newStatus) => handleToggleStatus(r.id, newStatus)}
                            />
                        ),
                    },
                ]}
            />

            {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
            {notice && !error && (
                <p role="status" className="mt-3 text-sm text-[#6B7280]">{notice}</p>
            )}
            {Object.entries(rowErrors).map(([id, message]) => (
                <p key={id} role="alert" className="mt-2 text-sm text-red-600">{message}</p>
            ))}
        </PanelPage>

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

        <ConfirmActionModal
          isOpen={bulkDeleteModalOpen}
          title="Remove Clients"
          message={
            <>
              Are you sure you want to remove{" "}
              <span className="font-semibold text-[#111827]">
                {activeSelectedIds.size} client{activeSelectedIds.size === 1 ? "" : "s"}
              </span>
              ? This action is permanent and cannot be undone.
            </>
          }
          confirmLabel="Remove Clients"
          busy={bulkDeleting}
          busyLabel="Removing…"
          error={bulkDeleteError}
          onConfirm={handleBulkDeleteClients}
          onCancel={() => {
            if (mutationPending.current) return
            setBulkDeleteModalOpen(false)
            setBulkDeleteError("")
          }}
        />
        </>
    )
}

export default ClientsSection
