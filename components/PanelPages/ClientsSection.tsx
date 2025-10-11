import React, { useEffect, useMemo, useState } from "react"
import { FiPlus, FiSearch, FiFilter } from 'react-icons/fi'

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
}

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
    const isActive = status === "completed" || status === "in_progress"
    const label = status === "completed" ? "Active" : status === "in_progress" ? "Active" : "Inactive"
    return (
        <span className={`px-3 py-1 rounded-full text-xs ${isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
            {label}
        </span>
    )
}

interface ClientsSectionProps { onAddClient?: () => void }

const ClientsSection: React.FC<ClientsSectionProps> = ({ onAddClient }) => {
    const [rows, setRows] = useState<ClientRow[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [currentPage, setCurrentPage] = useState(0)
    const pageSize = 10

    useEffect(() => {
        ;(async () => {
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
        })()
    }, [])

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

    return (
        <div className="w-full h-full bg-white text-[#111014] flex flex-col p-4">
                                    <div className="w-full flex justify-between items-center mb-2">
                                            <div>
                                                <h2 className="text-2xl font-semibold text-[#111827]">Clients</h2>
                                                <p className="text-sm text-[#6B7280] mt-0">All Clients</p>
                                            </div>
                                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 shadow-sm border border-transparent focus-within:ring-2 focus-within:ring-[#701CC0] transition">
                        <FiSearch className="w-4 h-4 text-[#701CC0] flex-shrink-0" />
                        <label htmlFor="clients-search" className="sr-only">Search Clients</label>
                        <input id="clients-search" type="search" placeholder="Search Clients" className="w-64 md:w-80 text-sm placeholder:text-[#9CA3AF] bg-transparent outline-none" />
                    </div>
                    <button className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white text-sm text-[#374151] border border-[#E5E7EB] hover:bg-gray-50">
                        <FiFilter className="w-4 h-4" />
                        <span className="text-sm">Filter</span>
                    </button>
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
                        {!loading && rows.length === 0 && (
                            <tr>
                                <td className="px-4 py-6 text-sm text-gray-500" colSpan={columns.length}>No clients found</td>
                            </tr>
                        )}
                        {rows.slice(currentPage * pageSize, (currentPage + 1) * pageSize).map((r) => (
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
                                    <button aria-label={`Manage ${r.name}`} className="px-2 py-1 rounded hover:bg-white/20">⋯</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                            </table>
                        </div>
            </div>

            {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
            {!loading && rows.length > 0 && (
                <div className="mt-4 text-xs text-[#677489]">
                    <div className="w-full flex items-center justify-between">
                        <div className="text-xs text-[#677489]">
                            Showing {Math.min(rows.length, currentPage * pageSize + 1)}–{Math.min(rows.length, (currentPage + 1) * pageSize)} of {rows.length} entries
                        </div>
                        <div className="text-xs text-[#677489] text-center">
                            Page {Math.min(currentPage + 1, Math.max(1, Math.ceil(rows.length / pageSize)))} of {Math.max(1, Math.ceil(rows.length / pageSize))}
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
                                onClick={() => setCurrentPage(p => Math.min(p + 1, Math.max(0, Math.ceil(rows.length / pageSize) - 1)))}
                                disabled={currentPage >= Math.ceil(rows.length / pageSize) - 1}
                                className={`px-3 py-1 rounded-md border ${currentPage >= Math.ceil(rows.length / pageSize) - 1 ? 'text-gray-400 border-gray-200' : 'text-[#111827] border-[#D1D5DB] hover:bg-gray-50'}`}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default ClientsSection