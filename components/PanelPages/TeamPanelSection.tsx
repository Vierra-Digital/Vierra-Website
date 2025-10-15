import React, { useEffect, useMemo, useState } from "react"
import { FiPlus, FiSearch, FiFilter } from 'react-icons/fi'

type TeamRow = {
    id: string
    name: string
    position: string
    country: string
    timeZone: string
    phone: string
    email: string
    companyEmail: string
    status: string
}

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
    const isActive = status === "active" || status === "online"
    const label = status === "active" ? "Active" : status === "online" ? "Online" : "Offline"
    return (
        <span className={`px-3 py-1 rounded-full text-xs ${isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
            {label}
        </span>
    )
}

const TeamPanelSection: React.FC = () => {
    const [rows, setRows] = useState<TeamRow[]>([])
    const [loading, setLoading] = useState(true)
    const [error] = useState<string | null>(null)
    const [currentPage, setCurrentPage] = useState(0)
    const pageSize = 10

    useEffect(() => {
        // Sample data for demonstration
        const sampleData: TeamRow[] = [
            {
                id: "1",
                name: "John Smith",
                position: "Senior Developer",
                country: "United States",
                timeZone: "EST",
                phone: "+1 (555) 123-4567",
                email: "john.smith@vierra.com",
                companyEmail: "john.smith@vierra.com",
                status: "active"
            },
            {
                id: "2",
                name: "Sarah Johnson",
                position: "Marketing Manager",
                country: "Canada",
                timeZone: "PST",
                phone: "+1 (555) 987-6543",
                email: "sarah.johnson@vierra.com",
                companyEmail: "sarah.johnson@vierra.com",
                status: "online"
            },
            {
                id: "3",
                name: "Mike Chen",
                position: "Designer",
                country: "Australia",
                timeZone: "AEST",
                phone: "+61 2 1234 5678",
                email: "mike.chen@vierra.com",
                companyEmail: "mike.chen@vierra.com",
                status: "offline"
            }
        ]
        
        setRows(sampleData)
        setLoading(false)
    }, [])

    const columns = useMemo(
        () => [
            { key: "name", header: "Name" },
            { key: "position", header: "Position" },
            { key: "country", header: "Country" },
            { key: "timeZone", header: "Time Zone" },
            { key: "phone", header: "Phone" },
            { key: "email", header: "Email" },
            { key: "companyEmail", header: "Company Email" },
            { key: "status", header: "Status" },
            { key: "manage", header: "Manage" },
        ],
        []
    )

    return (
        <div className="w-full h-full bg-white text-[#111014] flex flex-col p-4">
            <div className="w-full flex justify-between items-center mb-2">
                <div>
                    <h2 className="text-2xl font-semibold text-[#111827]">Team</h2>
                    <p className="text-sm text-[#6B7280] mt-0">All Team Members</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 shadow-sm border border-transparent focus-within:ring-2 focus-within:ring-[#701CC0] transition">
                        <FiSearch className="w-4 h-4 text-[#701CC0] flex-shrink-0" />
                        <label htmlFor="team-search" className="sr-only">Search Team</label>
                        <input id="team-search" type="search" placeholder="Search Team" className="w-64 md:w-80 text-sm placeholder:text-[#9CA3AF] bg-transparent outline-none" />
                    </div>
                    <button className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white text-sm text-[#374151] border border-[#E5E7EB] hover:bg-gray-50">
                        <FiFilter className="w-4 h-4" />
                        <span className="text-sm">Filter</span>
                    </button>
                    <button className="inline-flex items-center px-4 py-2 rounded-lg bg-[#701CC0] text-white text-sm hover:bg-[#5f17a5]">
                        <FiPlus className="w-4 h-4 mr-2" />
                        Add Team Member
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
                                    <td className="px-4 py-6 text-sm text-gray-500" colSpan={columns.length}>No team members found</td>
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
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-sm">{r.position || "—"}</td>
                                    <td className="px-4 py-4 text-sm">{r.country || "—"}</td>
                                    <td className="px-4 py-4 text-sm">{r.timeZone || "—"}</td>
                                    <td className="px-4 py-4 text-sm">{r.phone || "—"}</td>
                                    <td className="px-4 py-4 text-sm">{r.email || "—"}</td>
                                    <td className="px-4 py-4 text-sm">{r.companyEmail || "—"}</td>
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

export default TeamPanelSection;