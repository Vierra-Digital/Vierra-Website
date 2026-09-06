import React, { useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import ProfileImage from "../ProfileImage"
import { FiPlus, FiFilter, FiChevronDown, FiTrash2, FiCheckCircle, FiXCircle, FiEye, FiBriefcase } from 'react-icons/fi'
import LoadingSpinner from "@/components/ui/LoadingSpinner"
import {
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
    onClearActive: () => void
    isWorkingOn: boolean
    onDelete: () => void
    onToggleStatus: (isActive: boolean) => void
}> = ({ clientName, isActive, isAdmin, busy, onView, onSetActive, onClearActive, isWorkingOn, onDelete, onToggleStatus, triggerId }) => {
    return (
        <RowActionMenu label={`Manage ${clientName}`} triggerId={triggerId}>
          {isWorkingOn ? (
            <RowActionMenuItem onClick={onClearActive} icon={<FiXCircle className="w-4 h-4" />}>
              Stop Working On This Client
            </RowActionMenuItem>
          ) : (
            <RowActionMenuItem onClick={onSetActive} icon={<FiBriefcase className="w-4 h-4" />}>
              Work On This Client
            </RowActionMenuItem>
          )}
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
    onSetActiveClient?: (client: Pick<ClientRow, "companyId" | "businessName"> | null) => void
    /** The company id currently being worked on, so the row can offer to stop. */
    activeCompanyId?: string | null
}

const ClientsSection: React.FC<ClientsSectionProps> = ({ isAdmin = false, onAddClient, refreshTrigger, onViewClient, onSetActiveClient, activeCompanyId = null }) => {
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
    const [sortBy, setSortBy] = useState<'name' | 'business' | 'industry' | 'retainer' | 'goal' | 'status'>("name")
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>("asc")
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'pending'>("all")
    const [industryFilter, setIndustryFilter] = useState("")
    const filterRef = useRef<HTMLDivElement>(null)
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
        setSortBy(
            ["name", "business", "industry", "retainer", "goal", "status"].includes(String(q.sortBy))
                ? (q.sortBy as typeof sortBy)
                : "name"
        )
        setSortDir(q.sortDir === "desc" ? "desc" : "asc")
        setIndustryFilter(typeof q.industry === "string" ? q.industry : "")
        setCurrentPage(Number.isSafeInteger(Number(q.page)) ? Math.max(0, Number(q.page)) : 0)
        /* eslint-enable react-hooks/set-state-in-effect */
    }, [router.isReady, router.query])

    useEffect(() => {
        if (!router.isReady || router.query.section !== "clients") return
        if (hydratingView.current) { hydratingView.current = false; return }
        const timer = window.setTimeout(() => {
            void router.replace({ pathname: router.pathname, query: { ...router.query, q: searchQuery, status: statusFilter, industry: industryFilter, sortBy, sortDir, page: currentPage } }, undefined, { shallow: true, scroll: false }).catch(() => {})
        }, 300)
        return () => window.clearTimeout(timer)
    }, [searchQuery, statusFilter, industryFilter, sortBy, sortDir, currentPage, router])

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
                setIsFilterOpen(false)
            }
        }
        if (isFilterOpen) {
            document.addEventListener("mousedown", handleClickOutside)
            return () => document.removeEventListener("mousedown", handleClickOutside)
        }
    }, [isFilterOpen])

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
        if (industryFilter) {
            base = base.filter((r) => (r.industry || "") === industryFilter)
        }
        const statusRank: Record<string, number> = { completed: 0, in_progress: 1, pending: 1 }
        const sorted = [...base].sort((a, b) => {
            let comparison: number
            switch (sortBy) {
                case "retainer":
                    // Unset sorts last in either direction rather than counting as zero.
                    comparison =
                        (typeof a.monthlyRetainer === "number" ? a.monthlyRetainer : -1) -
                        (typeof b.monthlyRetainer === "number" ? b.monthlyRetainer : -1)
                    break
                case "goal":
                    comparison = (a.clientGoal ?? -1) - (b.clientGoal ?? -1)
                    break
                case "status":
                    comparison = (statusRank[a.status] ?? 2) - (statusRank[b.status] ?? 2)
                    break
                case "business":
                    comparison = (a.businessName || "").localeCompare(b.businessName || "")
                    break
                case "industry":
                    comparison = (a.industry || "").localeCompare(b.industry || "")
                    break
                default:
                    comparison = (a.name || "").localeCompare(b.name || "")
            }
            // Name breaks every tie, so the order does not shuffle between renders.
            if (comparison === 0) comparison = (a.name || "").localeCompare(b.name || "")
            return sortDir === "asc" ? comparison : -comparison
        })
        return sorted
    }, [rows, searchQuery, statusFilter, industryFilter, sortBy, sortDir])

    // Page index clamped rather than reset from an effect. Searching to a shorter list could leave
    // currentPage past the end, and slicing beyond the array renders an empty table with nothing to
    // explain it; the old effect only covered searchQuery, not the status or sort filters.
    const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize))
    const page = Math.min(currentPage, totalPages - 1)
    /** Every industry present in the data, so the filter offers what can actually be selected. */
    const industryOptions = useMemo(
        () => Array.from(new Set(rows.map((r) => r.industry).filter((v): v is string => Boolean(v)))).sort(),
        [rows]
    )
    const clearFilters = () => {
        setSearchQuery("")
        setStatusFilter("all")
        setIndustryFilter("")
        setSortBy("name")
        setSortDir("asc")
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
                <div className="relative" ref={filterRef}>
                    <PanelButton onClick={() => setIsFilterOpen((v) => !v)} icon={<FiFilter className="h-4 w-4" />}>
                        Filter
                        <FiChevronDown className={`h-3.5 w-3.5 transition-transform ${isFilterOpen ? "rotate-180" : ""}`} />
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
                                    { value: "name", label: "Client Name" },
                                    { value: "business", label: "Business" },
                                    { value: "industry", label: "Industry" },
                                    { value: "retainer", label: "Monthly Retainer" },
                                    { value: "goal", label: "Client Goal" },
                                    { value: "status", label: "Status" },
                                ]}
                            />
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
                            <PanelSelect
                                label="Industry"
                                value={industryFilter}
                                onChange={(value) => {
                                    setIndustryFilter(value)
                                    setCurrentPage(0)
                                }}
                                options={[
                                    { value: "", label: "All Industries" },
                                    ...industryOptions.map((industry) => ({ value: industry, label: industry })),
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
                                    clearFilters()
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
                emptyTitle="No Clients Found"
                emptyMessage="No clients match your search."
                emptyImage={<Image src="/assets/no-client.png" alt="" width={176} height={176} className="h-auto w-44" priority />}
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
                                isWorkingOn={activeCompanyId === r.companyId}
                                onSetActive={() => onSetActiveClient?.({ companyId: r.companyId, businessName: r.businessName })}
                                onClearActive={() => onSetActiveClient?.(null)}
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
        </>
    )
}

export default ClientsSection
