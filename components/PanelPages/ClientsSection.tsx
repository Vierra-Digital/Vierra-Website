import React, { useEffect, useMemo, useState } from "react"

type ClientRow = {
    id: string
    name: string
    email: string
    businessName: string
    website: string
    targetAudience: string
    adGoal: string
    brandTone: string
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
            { key: "name", header: "Name" },
            { key: "businessName", header: "Business Name" },
            { key: "website", header: "Website" },
            { key: "targetAudience", header: "Target Audience" },
            { key: "adGoal", header: "Ad Goal" },
            { key: "brandTone", header: "Brand Tone" },
            { key: "status", header: "Status" },
        ],
        []
    )

    return (
        <div className="w-full h-full bg-white text-[#111014] flex flex-col p-4">
            <div className="w-full flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">Clients</h2>
                <button
                    onClick={onAddClient}
                    className="inline-flex items-center px-4 py-2 rounded-lg bg-[#701CC0] text-white text-sm hover:bg-[#5f17a5]"
                >
                    Add Client
                </button>
            </div>
            <div className="overflow-x-auto w-full">
                <table className="min-w-full text-left border-separate border-spacing-y-3">
                    <thead>
                        <tr className="text-[#677489] text-xs">
                            {columns.map((c) => (
                                <th key={c.key} className="px-4 py-2 font-semibold">{c.header}</th>
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
                        {rows.map((r) => (
                            <tr key={r.id} className="bg-[#F8F0FF] rounded-xl">
                                <td className="px-4 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-full bg-[#E2E8F0] flex items-center justify-center text-sm font-medium">
                                            {r.name?.charAt(0)?.toUpperCase() || "?"}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-semibold">{r.name || "—"}</span>
                                            <span className="text-xs text-[#677489]">{r.email}</span>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-4 py-4 text-sm">{r.businessName || "—"}</td>
                                <td className="px-4 py-4 text-sm">{r.website || "—"}</td>
                                <td className="px-4 py-4 text-sm">{r.targetAudience || "—"}</td>
                                <td className="px-4 py-4 text-sm">{r.adGoal || "N/A"}</td>
                                <td className="px-4 py-4 text-sm">{r.brandTone || "N/A"}</td>
                                <td className="px-4 py-4 text-sm"><StatusBadge status={r.status} /></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
            {!loading && rows.length > 0 && (
                <div className="mt-4 text-xs text-[#677489]">{rows.length} Entries</div>
            )}
        </div>
    )
}

export default ClientsSection