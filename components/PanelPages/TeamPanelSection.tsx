import React, { useEffect, useMemo, useState } from "react"
import { FiPlus, FiSearch, FiFilter } from 'react-icons/fi'
import ProfileImage from "../ProfileImage"

type TeamRow = {
    id: number
    name: string | null
    email: string | null
    position: string | null
    country: string | null
    time_zone: string | null
    company_email: string | null
    mentor: string | null
    strikes: string | null
    image: boolean
    status: string
    lastActiveAt: string | null
}

const StatusBadge: React.FC<{ status: string; lastActiveAt: string | null }> = ({ status, lastActiveAt }) => {
    const getStatusInfo = () => {
        const now = new Date();
        const lastActive = lastActiveAt ? new Date(lastActiveAt) : null;
        const minutesSinceActive = lastActive ? Math.floor((now.getTime() - lastActive.getTime()) / (1000 * 60)) : null;
        
        // Determine actual status based on last activity
        let actualStatus = status;
        if (lastActive && minutesSinceActive !== null) {
            if (minutesSinceActive <= 5) {
                actualStatus = "online";
            } else if (minutesSinceActive <= 30) {
                actualStatus = "away";
            } else {
                actualStatus = "offline";
            }
        }
        
        const isActive = actualStatus === "online";
        const isAway = actualStatus === "away";
        
        let label = "Offline";
        let className = "bg-gray-100 text-gray-700";
        
        if (isActive) {
            label = "Online";
            className = "bg-green-100 text-green-700";
        } else if (isAway) {
            label = "Away";
            className = "bg-yellow-100 text-yellow-700";
        }
        
        return { label, className };
    };
    
    const { label, className } = getStatusInfo();
    
    return (
        <span className={`px-3 py-1 rounded-full text-xs ${className}`}>
            {label}
        </span>
    );
};

const PositionBadge: React.FC<{ position: string | null }> = ({ position }) => {
    const getPositionColor = (pos: string | null) => {
        if (!pos) return "bg-gray-100 text-gray-800";
        
        switch (pos) {
            case "Founder":
            case "Leadership":
            case "Business Advisor":
                return "bg-red-100 text-red-800";
            case "Developer":
                return "bg-blue-100 text-blue-800";
            case "UI/UX Designer":
                return "bg-purple-100 text-purple-800";
            case "Outreach":
                return "bg-green-100 text-green-800";
            default:
                return "bg-gray-100 text-gray-800";
        }
    };

    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPositionColor(position)}`}>
            {position || "—"}
        </span>
    );
};

const TeamPanelSection: React.FC = () => {
    const [rows, setRows] = useState<TeamRow[]>([])
    const [filteredRows, setFilteredRows] = useState<TeamRow[]>([])
    const [loading, setLoading] = useState(true)
    const [currentPage, setCurrentPage] = useState(0)
    const [showAddStaff, setShowAddStaff] = useState(false)
    const [searchTerm, setSearchTerm] = useState("")
    const [sortBy, setSortBy] = useState<"position" | "country" | "strikes" | "status">("position")
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
    const [statusFilter, setStatusFilter] = useState<"all" | "online" | "away" | "offline">("all")
    const [isFilterOpen, setIsFilterOpen] = useState(false)
    const pageSize = 10

    const loadTeamData = async () => {
        setLoading(true)
        try {
            const res = await fetch("/api/admin/users")
            if (!res.ok) throw new Error("Failed to fetch team data")
            const data = await res.json()
            const shaped = data.map((u: any) => ({
                id: u.id,
                name: u.name,
                email: u.email,
                image: u.image,
                position: u.position,
                country: u.country,
                company_email: u.company_email,
                mentor: u.mentor,
                strikes: u.strikes,
                time_zone: u.time_zone,
                status: u.status,
                lastActiveAt: u.lastActiveAt,
            }))
            setRows(shaped)
        } catch (e) {
            console.error("Failed to load team data:", e)
        } finally {
            setLoading(false)
        }
    }

    // Filter and sort logic
    const applyFiltersAndSort = useMemo(() => {
        const filtered = rows.filter(row => {
            // Search filter
            const matchesSearch = !searchTerm || 
                row.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                row.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                row.position?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                row.country?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                row.company_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                row.mentor?.toLowerCase().includes(searchTerm.toLowerCase())

            // Status filter
            const matchesStatus = statusFilter === "all" || 
                (statusFilter === "online" && row.status === "online") ||
                (statusFilter === "away" && row.status === "away") ||
                (statusFilter === "offline" && row.status === "offline")

            return matchesSearch && matchesStatus
        })

        // Sort logic
        filtered.sort((a, b) => {
            let aValue: string | number
            let bValue: string | number

            switch (sortBy) {
                case "position":
                    // Define position hierarchy for proper sorting
                    const positionOrder = {
                        "Founder": 1,
                        "Leadership": 2,
                        "Business Advisor": 3,
                        "Developer": 4,
                        "UI/UX Designer": 5,
                        "Outreach": 6
                    }
                    aValue = positionOrder[a.position as keyof typeof positionOrder] || 999
                    bValue = positionOrder[b.position as keyof typeof positionOrder] || 999
                    break
                case "country":
                    aValue = a.country || ""
                    bValue = b.country || ""
                    break
                case "strikes":
                    // Parse strikes (e.g., "2/3" -> 2)
                    aValue = parseInt(a.strikes?.split("/")[0] || "0")
                    bValue = parseInt(b.strikes?.split("/")[0] || "0")
                    break
                case "status":
                    // Define status hierarchy
                    const statusOrder = { "online": 1, "away": 2, "offline": 3 }
                    aValue = statusOrder[a.status as keyof typeof statusOrder] || 999
                    bValue = statusOrder[b.status as keyof typeof statusOrder] || 999
                    break
                default:
                    return 0
            }

            if (aValue < bValue) return sortOrder === "asc" ? -1 : 1
            if (aValue > bValue) return sortOrder === "asc" ? 1 : -1
            return 0
        })

        return filtered
    }, [rows, searchTerm, sortBy, sortOrder, statusFilter])

    useEffect(() => {
        setFilteredRows(applyFiltersAndSort)
        setCurrentPage(0) // Reset to first page when filters change
    }, [applyFiltersAndSort])

    useEffect(() => {
        loadTeamData()
    }, [])

    const columns = useMemo(
        () => [
            { key: "name", header: "Name" },
            { key: "position", header: "Position" },
            { key: "country", header: "Country" },
            { key: "company_email", header: "Company Email" },
            { key: "mentor", header: "Mentor" },
            { key: "strikes", header: "Strikes" },
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
                        <input 
                            id="team-search" 
                            type="search" 
                            placeholder="Search Team" 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-64 md:w-80 text-sm placeholder:text-[#9CA3AF] bg-transparent outline-none" 
                        />
                    </div>
                    <div className="relative">
                        <button 
                            onClick={() => setIsFilterOpen(!isFilterOpen)}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white text-sm text-[#374151] border border-[#E5E7EB] hover:bg-gray-50"
                        >
                            <FiFilter className="w-4 h-4" />
                            <span className="text-sm">Filter</span>
                        </button>
                        {isFilterOpen && (
                            <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-[#E5E7EB] py-3 z-10">
                                <div className="px-4 py-2">
                                    <h3 className="text-sm font-medium text-[#111827] mb-3">Sort & Filter</h3>
                                    
                                    {/* Sort By */}
                                    <div className="mb-4">
                                        <label className="block text-xs font-medium text-[#6B7280] mb-2">Sort By</label>
                                        <select
                                            value={sortBy}
                                            onChange={(e) => setSortBy(e.target.value as "position" | "country" | "strikes" | "status")}
                                            className="w-full text-sm border border-[#E5E7EB] rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#701CC0]"
                                        >
                                            <option value="position">Position</option>
                                            <option value="country">Country/Timezone</option>
                                            <option value="strikes">Strikes</option>
                                            <option value="status">Status</option>
                                        </select>
                                    </div>

                                    {/* Sort Order */}
                                    <div className="mb-4">
                                        <label className="block text-xs font-medium text-[#6B7280] mb-2">Order</label>
                                        <select
                                            value={sortOrder}
                                            onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
                                            className="w-full text-sm border border-[#E5E7EB] rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#701CC0]"
                                        >
                                            <option value="desc">High to Low</option>
                                            <option value="asc">Low to High</option>
                                        </select>
                                    </div>

                                    {/* Status Filter */}
                                    <div className="mb-4">
                                        <label className="block text-xs font-medium text-[#6B7280] mb-2">Status</label>
                                        <select
                                            value={statusFilter}
                                            onChange={(e) => setStatusFilter(e.target.value as "all" | "online" | "away" | "offline")}
                                            className="w-full text-sm border border-[#E5E7EB] rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#701CC0]"
                                        >
                                            <option value="all">All Status</option>
                                            <option value="online">Online</option>
                                            <option value="away">Away</option>
                                            <option value="offline">Offline</option>
                                        </select>
                                    </div>

                                    <div className="flex justify-between pt-2 border-t border-[#E5E7EB]">
                                        <button 
                                            onClick={() => {
                                                setSortBy("position")
                                                setSortOrder("desc")
                                                setStatusFilter("all")
                                                setSearchTerm("")
                                            }} 
                                            className="text-xs text-[#6B7280] hover:underline"
                                        >
                                            Clear
                                        </button>
                                        <button 
                                            onClick={() => setIsFilterOpen(false)} 
                                            className="text-xs text-[#701CC0] font-medium"
                                        >
                                            Close
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    <button onClick={() => setShowAddStaff(true)} className="inline-flex items-center px-4 py-2 rounded-lg bg-[#701CC0] text-white text-sm hover:bg-[#5f17a5]">
                        <FiPlus className="w-4 h-4 mr-2" />
                        Add Staff
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
                                    <td className="px-4 py-6 text-sm text-gray-500" colSpan={columns.length}>
                                        {searchTerm || statusFilter !== "all" ? "No team members match your filters" : "No team members found"}
                                    </td>
                                </tr>
                            )}
                            {filteredRows.slice(currentPage * pageSize, (currentPage + 1) * pageSize).map((r) => (
                                <tr key={r.id} className="bg-white hover:bg-[#F8F0FF] rounded-xl transition-colors">
                                    <td className="px-4 py-4">
                                        <div className="flex items-center gap-3">
                                            <ProfileImage
                                                src={r.image ? `/api/admin/getUserImage?userId=${r.id}&t=${Date.now()}` : null}
                                                alt={r.name || "Staff Member"}
                                                name={r.name || "Staff Member"}
                                                size={36}
                                                className="flex-shrink-0"
                                            />
                                            <div className="flex flex-col">
                                                <span className="text-sm font-semibold">{r.name || "—"}</span>
                                                <span className="text-xs text-gray-500">{r.email || "—"}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-sm">
                                        <PositionBadge position={r.position} />
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="flex flex-col">
                                            <span className="text-sm">{r.country || "—"}</span>
                                            <span className="text-xs text-gray-500">{r.time_zone || "—"}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-sm">{r.company_email || "—"}</td>
                                    <td className="px-4 py-4 text-sm">{r.mentor || "—"}</td>
                                    <td className="px-4 py-4 text-sm">{r.strikes || "0/3"}</td>
                                    <td className="px-4 py-4 text-sm">
                                        <StatusBadge status={r.status} lastActiveAt={r.lastActiveAt} />
                                    </td>
                                    <td className="px-4 py-4 text-sm text-[#6B7280]">
                                        <button aria-label={`Manage ${r.name}`} className="px-2 py-1 rounded hover:bg-white/20">⋯</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                            </table>
                        </div>
            </div>

            {!loading && filteredRows.length > 0 && (
                <div className="mt-4 text-xs text-[#677489]">
                    <div className="w-full flex items-center justify-between">
                        <div className="text-xs text-[#677489]">
                            Showing {Math.min(filteredRows.length, currentPage * pageSize + 1)}–{Math.min(filteredRows.length, (currentPage + 1) * pageSize)} of {filteredRows.length} entries
                            {filteredRows.length !== rows.length && (
                                <span className="ml-2 text-[#701CC0]">(filtered from {rows.length} total)</span>
                            )}
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
                                className={`px-3 py-1 rounded-md border ${currentPage >= Math.ceil(filteredRows.length / pageSize) - 1 ? 'text-gray-400 border-gray-200' : 'text-[#111827] border-[#D1D5DB] hover:bg-gray-50'}`}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {showAddStaff && (
                <AddStaffModal 
                    onClose={() => setShowAddStaff(false)} 
                    onCreated={() => {
                        setShowAddStaff(false)
                        loadTeamData() // Refresh the data
                    }} 
                />
            )}
        </div>
    )
}

function AddStaffModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
    const [currentStep, setCurrentStep] = useState(1)
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        position: "",
        country: "",
        company_email: "",
        mentor: "",
        time_zone: ""
    })
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState("")

    const steps = [
        { number: 1, title: "Basic Information", fields: ["name", "email"] },
        { number: 2, title: "Position & Location", fields: ["position", "country", "time_zone"] },
        { number: 3, title: "Contact & Mentor", fields: ["company_email", "mentor"] }
    ]

    const handleInputChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    const nextStep = () => {
        if (currentStep < 3) {
            setCurrentStep(currentStep + 1)
        }
    }

    const prevStep = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1)
        }
    }

    const submit = async () => {
        setSubmitting(true)
        setError("")
        try {
            const response = await fetch("/api/admin/addStaff", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...formData,
                    password: "Password" // Default password
                }),
            })
            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.message || "Failed to create staff member")
            }
            onCreated()
        } catch (e: any) {
            setError(e?.message || "Failed to create staff member")
        } finally {
            setSubmitting(false)
        }
    }

    const isStepValid = () => {
        const currentStepData = steps[currentStep - 1]
        return currentStepData.fields.every(field => formData[field as keyof typeof formData]?.trim())
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full mx-4" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-full bg-[#701CC0]/10 flex items-center justify-center">
                        <FiPlus className="w-6 h-6 text-[#701CC0]" />
                    </div>
                    <h3 className="text-xl font-semibold text-[#111827]">Add Staff Member</h3>
                </div>
                
                {/* Progress Steps */}
                <div className="mb-6">
                    <div className="flex items-center justify-between">
                        {steps.map((step, index) => (
                            <div key={step.number} className="flex items-center">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                                    currentStep >= step.number 
                                        ? 'bg-[#701CC0] text-white' 
                                        : 'bg-gray-200 text-gray-600'
                                }`}>
                                    {step.number}
                                </div>
                                <span className={`ml-2 text-sm ${
                                    currentStep >= step.number ? 'text-[#701CC0] font-medium' : 'text-gray-600'
                                }`}>
                                    {step.title}
                                </span>
                                {index < steps.length - 1 && (
                                    <div className={`w-12 h-0.5 mx-4 ${
                                        currentStep > step.number ? 'bg-[#701CC0]' : 'bg-gray-200'
                                    }`} />
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="space-y-4">
                    {currentStep === 1 && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-[#374151] mb-2">Full Name *</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => handleInputChange("name", e.target.value)}
                                    className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#701CC0] focus:border-transparent"
                                    placeholder="Enter full name"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[#374151] mb-2">Email Address *</label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => handleInputChange("email", e.target.value)}
                                    className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#701CC0] focus:border-transparent"
                                    placeholder="Enter email address"
                                />
                            </div>
                        </div>
                    )}

                    {currentStep === 2 && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-[#374151] mb-2">Position *</label>
                                <select
                                    value={formData.position}
                                    onChange={(e) => handleInputChange("position", e.target.value)}
                                    className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#701CC0] focus:border-transparent"
                                >
                                    <option value="">Select a position</option>
                                    <option value="Founder">Founder</option>
                                    <option value="Leadership">Leadership</option>
                                    <option value="Business Advisor">Business Advisor</option>
                                    <option value="Developer">Developer</option>
                                    <option value="UI/UX Designer">UI/UX Designer</option>
                                    <option value="Outreach">Outreach</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[#374151] mb-2">Country *</label>
                                <input
                                    type="text"
                                    value={formData.country}
                                    onChange={(e) => handleInputChange("country", e.target.value)}
                                    className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#701CC0] focus:border-transparent"
                                    placeholder="e.g., United States, Canada"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[#374151] mb-2">Time Zone *</label>
                                <input
                                    type="text"
                                    value={formData.time_zone}
                                    onChange={(e) => handleInputChange("time_zone", e.target.value)}
                                    className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#701CC0] focus:border-transparent"
                                    placeholder="e.g., EST, PST, GMT"
                                />
                            </div>
                        </div>
                    )}

                    {currentStep === 3 && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-[#374151] mb-2">Company Email</label>
                                <input
                                    type="email"
                                    value={formData.company_email}
                                    onChange={(e) => handleInputChange("company_email", e.target.value)}
                                    className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#701CC0] focus:border-transparent"
                                    placeholder="company email (optional)"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[#374151] mb-2">Mentor</label>
                                <input
                                    type="text"
                                    value={formData.mentor}
                                    onChange={(e) => handleInputChange("mentor", e.target.value)}
                                    className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#701CC0] focus:border-transparent"
                                    placeholder="mentor name (optional)"
                                />
                            </div>
                        </div>
                    )}

                    {error && <div className="mt-4 text-sm text-red-600">{error}</div>}
                </div>

                <div className="flex gap-3 justify-end mt-6">
                    <button
                        onClick={prevStep}
                        disabled={currentStep === 1}
                        className={`px-4 py-2 rounded-lg text-sm font-medium ${
                            currentStep === 1
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'border border-[#E5E7EB] text-[#374151] hover:bg-gray-50'
                        }`}
                    >
                        Previous
                    </button>
                    
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg border border-[#E5E7EB] text-[#374151] hover:bg-gray-50 text-sm font-medium"
                    >
                        Cancel
                    </button>
                    
                    {currentStep < 3 ? (
                        <button
                            onClick={nextStep}
                            disabled={!isStepValid()}
                            className={`px-4 py-2 rounded-lg text-sm font-medium ${
                                isStepValid()
                                    ? 'bg-[#701CC0] text-white hover:bg-[#5f17a5]'
                                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            }`}
                        >
                            Next
                        </button>
                    ) : (
                        <button
                            onClick={submit}
                            disabled={submitting || !isStepValid()}
                            className={`px-4 py-2 rounded-lg text-sm font-medium ${
                                submitting || !isStepValid()
                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                    : 'bg-[#701CC0] text-white hover:bg-[#5f17a5]'
                            }`}
                        >
                            {submitting ? "Creating..." : "Create Staff Member"}
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}

export default TeamPanelSection;