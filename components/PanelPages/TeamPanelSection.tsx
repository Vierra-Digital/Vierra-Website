import React, { useState, useEffect, useMemo, useRef } from "react";
import { FiSearch, FiFilter, FiPlus, FiEdit3, FiTrash2, FiCheck } from "react-icons/fi";
import { MoreVertical } from "lucide-react";
import Image from "next/image";
import ProfileImage from "../ProfileImage";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

const StaffActionsMenu: React.FC<{
    staffId: number
    staffName: string
    onEdit: () => void
    onDelete: () => void
}> = ({ staffName, onEdit, onDelete }) => {
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
                aria-label={`Manage ${staffName}`}
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
                            onEdit()
                        }}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-blue-600"
                    >
                        <FiEdit3 className="w-4 h-4" />
                        Edit Staff
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
                        Remove Staff
                    </button>
                </div>
            )}
        </div>
    )
}

const DeleteStaffModal: React.FC<{
    isOpen: boolean
    onClose: () => void
    onConfirm: () => void
    staffName: string
}> = ({ isOpen, onClose, onConfirm, staffName }) => {
    const modalRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
                onClose()
            }
        }

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside)
            return () => document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [isOpen, onClose])

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4" ref={modalRef}>
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                        <FiTrash2 className="w-6 h-6 text-red-600" />
                    </div>
                    <h3 className="text-xl font-semibold text-[#111827]">Remove Staff Member</h3>
                </div>
                <p className="text-sm text-[#6B7280] mb-6">
                    Are you sure you want to remove <span className="font-semibold text-[#111827]">{staffName}</span>? 
                    This action is permanent and cannot be undone. All associated data will be removed.
                </p>
                <div className="flex gap-3 justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg border border-[#E5E7EB] text-[#374151] hover:bg-gray-50 text-sm font-medium"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 text-sm font-medium"
                    >
                        Remove Staff
                    </button>
                </div>
            </div>
        </div>
    )
}

interface TeamRow {
    id: number
    name: string
    email: string
    image: any
    position: string
    country: string
    company_email: string | null
    mentor: string | null
    time_zone: string
    strikes: string
    status: string
    lastActiveAt: string | null
}

const StatusBadge: React.FC<{ lastActiveAt: string | null }> = ({ lastActiveAt }) => {
    const getActualStatus = () => {
        if (!lastActiveAt) return "offline"
        
        const lastActive = new Date(lastActiveAt)
        const now = new Date()
        const diffMinutes = (now.getTime() - lastActive.getTime()) / (1000 * 60)
        
        // If last active more than 30 minutes ago, consider offline
        if (diffMinutes > 30) return "offline"
        // If last active more than 10 minutes ago, consider away
        if (diffMinutes > 10) return "away"
        // Otherwise consider online
        return "online"
    }

    const actualStatus = getActualStatus()

    const getStatusColor = () => {
        if (actualStatus === "online") return "bg-green-100 text-green-800"
        if (actualStatus === "away") return "bg-yellow-100 text-yellow-800"
        return "bg-gray-100 text-gray-800"
    }

    const getStatusText = () => {
        if (actualStatus === "online") return "Online"
        if (actualStatus === "away") return "Away"
        return "Offline"
    }

    return (
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor()}`}>
            {getStatusText()}
        </span>
    )
}

const TeamPanelSection: React.FC<{ userRole?: string }> = ({ userRole }) => {
    const [rows, setRows] = useState<TeamRow[]>([])
    const [filteredRows, setFilteredRows] = useState<TeamRow[]>([])
    const [loading, setLoading] = useState(true)
    const [currentPage, setCurrentPage] = useState(0)
    const [showAddStaff, setShowAddStaff] = useState(false)
    const [showManageModal, setShowManageModal] = useState(false)
    const [selectedStaff, setSelectedStaff] = useState<TeamRow | null>(null)
    const [showDeleteModal, setShowDeleteModal] = useState(false)
    const [staffToDelete, setStaffToDelete] = useState<{ id: number; name: string } | null>(null)
    const [searchTerm, setSearchTerm] = useState("")
    const [sortBy, setSortBy] = useState<"position" | "country" | "strikes" | "status">("position")
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc")
    const [statusFilter, setStatusFilter] = useState<"all" | "online" | "away" | "offline">("all")
    const [isFilterOpen, setIsFilterOpen] = useState(false)
    const filterRef = useRef<HTMLDivElement>(null)
    const pageSize = 10

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
                setIsFilterOpen(false)
            }
        }

        if (isFilterOpen) {
            document.addEventListener('mousedown', handleClickOutside)
            return () => document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [isFilterOpen])

    const handleManageStaff = (staff: TeamRow) => {
        setSelectedStaff(staff)
        setShowManageModal(true)
    }

    const handleDeleteStaff = (staffId: number, staffName: string) => {
        setStaffToDelete({ id: staffId, name: staffName })
        setShowDeleteModal(true)
    }

    const confirmDeleteStaff = async () => {
        if (!staffToDelete) return

        try {
            const response = await fetch(`/api/admin/users`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: staffToDelete.id }),
            })

            if (!response.ok) {
                throw new Error("Failed to delete staff member")
            }

            // Remove from local state
            setRows(prev => prev.filter(r => r.id !== staffToDelete.id))
            setShowDeleteModal(false)
            setStaffToDelete(null)
        } catch (error) {
            console.error("Error deleting staff:", error)
            alert("Failed to delete staff member. Please try again.")
        }
    }

    const handleUpdateStaff = async (updatedData: Partial<TeamRow>) => {
        if (!selectedStaff) return

        try {
            const response = await fetch(`/api/admin/users`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    id: selectedStaff.id, 
                    ...updatedData 
                }),
            })

            if (!response.ok) {
                throw new Error("Failed to update staff member")
            }

            // Update local state
            setRows(prev => prev.map(r => 
                r.id === selectedStaff.id ? { ...r, ...updatedData } : r
            ))
            setShowManageModal(false)
            setSelectedStaff(null)
        } catch (error) {
            console.error("Error updating staff:", error)
            alert("Failed to update staff member. Please try again.")
        }
    }

    const loadTeamData = async () => {
        setLoading(true)
        try {
            // First update user statuses based on activity
            try {
                await fetch("/api/admin/updateUserStatus", { method: "POST" })
            } catch (e) {
                console.warn("Failed to update user status:", e)
            }
            
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
                lastActiveAt: u.lastActiveAt
            }))
            setRows(shaped)
        } catch (error) {
            console.error("Error loading team data:", error)
        } finally {
        setLoading(false)
        }
    }

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
                        "Designer": 5,
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
                    aValue = a.position || ""
                    bValue = b.position || ""
            }

            if (sortOrder === "asc") {
                return aValue < bValue ? -1 : aValue > bValue ? 1 : 0
            } else {
                return aValue > bValue ? -1 : aValue < bValue ? 1 : 0
            }
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

    const columns = useMemo(() => {
        const baseColumns = [
            { key: "name", header: "Name" },
            { key: "position", header: "Position" },
            { key: "country", header: "Country" },
            { key: "company_email", header: "Company Email" },
            { key: "mentor", header: "Mentor" },
            { key: "strikes", header: "Strikes" },
            { key: "status", header: "Status" },
        ]
        
        // Only add Manage column for admin users
        if (userRole === "admin") {
            baseColumns.push({ key: "manage", header: "Manage" })
        }
        
        return baseColumns
    }, [userRole])

    const getPositionColor = (position: string) => {
        switch (position) {
            case "Founder":
            case "Leadership":
            case "Business Advisor":
                return "bg-red-100 text-red-800"
            case "Developer":
                return "bg-blue-100 text-blue-800"
            case "Designer":
                return "bg-purple-100 text-purple-800"
            case "Outreach":
                return "bg-green-100 text-green-800"
            default:
                return "bg-gray-100 text-gray-800"
        }
    }

    const paginatedRows = filteredRows.slice(currentPage * pageSize, (currentPage + 1) * pageSize)
    const totalPages = Math.ceil(filteredRows.length / pageSize)

    return (
        <div className="w-full h-full bg-white text-[#111014] flex flex-col">
            <div className="flex-1 flex justify-center px-6 pt-2">
                <div className="w-full max-w-6xl flex flex-col h-full">
            <div className="w-full flex justify-between items-center mb-2">
                <div>
                            <h1 className="text-2xl font-semibold text-[#111827] mt-6 mb-6">Staff Orbital</h1>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 shadow-sm border border-transparent focus-within:ring-2 focus-within:ring-[#701CC0] transition">
                        <FiSearch className="w-4 h-4 text-[#701CC0] flex-shrink-0" />
                        <label htmlFor="staff-search" className="sr-only">Search Staff</label>
                                <input 
                                    id="staff-search" 
                                    type="search" 
                                    placeholder="Search Staff" 
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-64 md:w-80 text-sm placeholder:text-[#9CA3AF] bg-transparent outline-none" 
                                />
                    </div>
                            <div className="relative" ref={filterRef}>
                                <button 
                                    onClick={() => setIsFilterOpen(!isFilterOpen)}
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
                                                <div className="relative">
                                                    <select
                                                        value={sortBy}
                                                        onChange={(e) => setSortBy(e.target.value as "position" | "country" | "strikes" | "status")}
                                                        className="w-full text-sm border border-[#E5E7EB] rounded-lg px-3 py-2 pr-10 bg-white focus:outline-none focus:ring-2 focus:ring-[#701CC0] focus:border-transparent appearance-none"
                                                    >
                                                        <option value="position">Position</option>
                                                        <option value="country">Country/Timezone</option>
                                                        <option value="strikes">Strikes</option>
                                                        <option value="status">Status</option>
                                                    </select>
                                                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                                        <svg className="w-4 h-4 text-[#6B7280]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                        </svg>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Sort Order */}
                                            <div className="mb-5">
                                                <label className="block text-xs font-medium text-[#6B7280] mb-2">Order</label>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => setSortOrder("asc")}
                                                        className={`flex-1 text-xs py-2 px-3 rounded-lg font-medium transition-colors duration-200 ${
                                                            sortOrder === "asc" 
                                                                ? "bg-[#701CC0] text-white shadow-sm" 
                                                                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                                        }`}
                                                    >
                                                        Ascending
                    </button>
                                                    <button
                                                        onClick={() => setSortOrder("desc")}
                                                        className={`flex-1 text-xs py-2 px-3 rounded-lg font-medium transition-colors duration-200 ${
                                                            sortOrder === "desc" 
                                                                ? "bg-[#701CC0] text-white shadow-sm" 
                                                                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                                        }`}
                                                    >
                                                        Descending
                    </button>
                </div>
            </div>

                                            {/* Status Filter */}
                                            <div className="mb-4">
                                                <label className="block text-xs font-medium text-[#6B7280] mb-2">Status</label>
                                                <div className="relative">
                                                    <select
                                                        value={statusFilter}
                                                        onChange={(e) => setStatusFilter(e.target.value as "all" | "online" | "away" | "offline")}
                                                        className="w-full text-sm border border-[#E5E7EB] rounded-lg px-3 py-2 pr-10 bg-white focus:outline-none focus:ring-2 focus:ring-[#701CC0] focus:border-transparent appearance-none"
                                                    >
                                                        <option value="all">All Status</option>
                                                        <option value="online">Online</option>
                                                        <option value="away">Away</option>
                                                        <option value="offline">Offline</option>
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
                                                        setSearchTerm("")
                                                        setSortBy("position")
                                                        setSortOrder("asc")
                                                        setStatusFilter("all")
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
                        {userRole === "admin" && (
                            <button
                                onClick={() => setShowAddStaff(true)}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-[#701CC0] text-white rounded-lg hover:bg-[#5f17a5] text-sm font-medium"
                            >
                                <FiPlus className="w-4 h-4" />
                                Add Staff
                            </button>
                        )}
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="text-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#701CC0] mx-auto"></div>
                                <p className="mt-2 text-sm text-[#6B7280]">Loading Staff Data...</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            {!loading && filteredRows.length === 0 && (
                                <div className="text-center py-12">
                                    <div className="w-full h-full flex flex-col items-center justify-center text-center">
                                        <Image src="/assets/no-client.png" alt="No staff" width={224} height={224} className="w-56 h-auto mb-3" />
                                        <p className="text-sm text-gray-500 mb-3">You have no staff added.</p>
                                        {userRole === "admin" && (
                                            <button
                                                onClick={() => setShowAddStaff(true)}
                                                className="inline-flex items-center px-4 py-2 rounded-lg bg-[#701CC0] text-white text-sm hover:bg-[#5f17a5]"
                                            >
                                                <FiPlus className="w-4 h-4 mr-2" />
                                                Add Staff
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}

                            {!loading && filteredRows.length > 0 && (
                                <div className="bg-white rounded-lg shadow-sm border border-[#E5E7EB]">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                                        <tr>
                                            {columns.map((column) => (
                                                <th key={column.key} className="px-4 py-3 text-left text-xs font-medium text-[#6B7280] uppercase tracking-wider">
                                                    {column.header}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-[#E5E7EB]">
                                        {paginatedRows.map((r) => (
                                            <tr key={r.id} className="hover:bg-purple-50">
                                                <td className="px-4 py-4">
                                                    <div className="flex items-center">
                                                        <ProfileImage
                                                            src={r.image ? `/api/admin/getUserImage?userId=${r.id}&t=${Date.now()}` : null}
                                                            name={r.name}
                                                            size={32}
                                                            alt={`${r.name}'s profile`}
                                                        />
                                                        <div className="ml-3">
                                                            <div className="text-sm font-medium text-[#111827]">{r.name}</div>
                                                            <div className="text-sm text-[#6B7280]">{r.email}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 text-sm">
                                                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getPositionColor(r.position)}`}>
                                                        {r.position}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-4 text-sm text-[#111827]">
                                                    <div>{r.country}</div>
                                                    <div className="text-xs text-[#6B7280]">{r.time_zone}</div>
                                                </td>
                                                <td className="px-4 py-4 text-sm text-[#111827]">{r.company_email || "—"}</td>
                                                <td className="px-4 py-4 text-sm text-[#111827]">{r.mentor || "—"}</td>
                                                <td className="px-4 py-4 text-sm">{r.strikes || "0/3"}</td>
                                                <td className="px-4 py-4 text-sm">
                                                    <StatusBadge lastActiveAt={r.lastActiveAt} />
                                    </td>
                                                {userRole === "admin" && (
                                                    <td className="px-4 py-4 text-sm text-[#6B7280] relative">
                                                        <StaffActionsMenu
                                                            staffId={r.id}
                                                            staffName={r.name}
                                                            onEdit={() => handleManageStaff(r)}
                                                            onDelete={() => handleDeleteStaff(r.id, r.name)}
                                                        />
                                    </td>
                                                )}
                                </tr>
                            ))}
                        </tbody>
                            </table>
                        </div>
                                </div>
                            )}
                        </>
                    )}

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
                                        Page {currentPage + 1} of {totalPages}
                                    </span>
                                    <button
                                        onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
                                        disabled={currentPage >= totalPages - 1}
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

            {showAddStaff && userRole === "admin" && (
                <AddStaffModal
                    onClose={() => setShowAddStaff(false)}
                    onCreated={() => {
                        setShowAddStaff(false)
                        loadTeamData()
                    }}
                />
            )}

            {showManageModal && selectedStaff && userRole === "admin" && (
                <ManageStaffModal
                    staff={selectedStaff}
                    onClose={() => {
                        setShowManageModal(false)
                        setSelectedStaff(null)
                    }}
                    onUpdate={handleUpdateStaff}
                />
            )}

            {userRole === "admin" && (
                <DeleteStaffModal
                    isOpen={showDeleteModal}
                    onClose={() => {
                        setShowDeleteModal(false)
                        setStaffToDelete(null)
                    }}
                    onConfirm={confirmDeleteStaff}
                    staffName={staffToDelete?.name || ""}
                />
            )}
        </div>
    )
}

// Add Staff Modal Component
const AddStaffModal: React.FC<{ onClose: () => void; onCreated: () => void }> = ({ onClose, onCreated }) => {
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
    const [showSuccess, setShowSuccess] = useState(false)

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
                body: JSON.stringify(formData),
            })
            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.message || "Failed to create staff member")
            }
            setShowSuccess(true)
        } catch (e: any) {
            setError(e?.message || "Failed to create staff member")
        } finally {
            setSubmitting(false)
        }
    }

    if (showSuccess) {
        return (
            <div 
                className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[200] p-4" 
                role="dialog" 
                aria-modal="true"
                onClick={(e) => {
                    if (e.target === e.currentTarget) {
                        setShowSuccess(false)
                        onCreated()
                        onClose()
                    }
                }}
            >
                <div 
                    className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4" 
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex flex-col items-center text-center">
                        <div className="relative mb-4 inline-flex h-16 w-16 items-center justify-center">
                            <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-30 animate-ping" />
                            <span className="relative inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500 text-white">
                                    <FiCheck className="h-6 w-6" />
                                </span>
                            </span>
                        </div>
                        <h3 className="text-xl font-semibold text-[#111827] mb-2">Staff Member Added Successfully!</h3>
                        <p className={`text-sm text-[#6B7280] mb-6 ${inter.className}`}>
                            The staff member has been added successfully and can now access the system.
                        </p>
                        <button
                            className="w-full rounded-lg px-4 py-2 bg-[#701CC0] text-white hover:bg-[#5f17a5] text-sm font-medium transition-colors"
                            onClick={() => {
                                setShowSuccess(false)
                                onCreated()
                                onClose()
                            }}
                        >
                            Done
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    const isStepValid = () => {
        const currentStepData = steps[currentStep - 1]
        return currentStepData.fields.every(field => formData[field as keyof typeof formData]?.trim())
    }

    const isValidEmail = (email: string) => {
        const emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i
        return emailRegex.test(email)
    }

    const hasValidEmails = () => {
        const mainEmailValid = formData.email ? isValidEmail(formData.email) : false
        const companyEmailValid = formData.company_email ? isValidEmail(formData.company_email) : true
        return mainEmailValid && companyEmailValid
    }

    const isCurrentStepEmailValid = () => {
        if (currentStep === 1) {
            // Step 1 has the main email field
            return formData.email ? isValidEmail(formData.email) : false
        }
        if (currentStep === 3) {
            // Step 3 has company email field
            return formData.company_email ? isValidEmail(formData.company_email) : true
        }
        return true
    }

    const positionOptions = [
        "Founder",
        "Leadership",
        "Business Advisor",
        "Developer",
        "Designer",
        "Outreach"
    ]

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
                                    <div className={`w-16 h-0.5 mx-4 ${
                                        currentStep > step.number ? 'bg-[#701CC0]' : 'bg-gray-200'
                                    }`} />
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Step Content */}
                {currentStep === 1 && (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-[#374151] mb-2">Full Name</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => handleInputChange("name", e.target.value)}
                                className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#701CC0] focus:border-transparent"
                                placeholder="Enter full name"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-[#374151] mb-2">Email</label>
                            <input
                                type="email"
                                value={formData.email}
                                onChange={(e) => handleInputChange("email", e.target.value)}
                                className={`w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#701CC0] focus:border-transparent ${
                                    formData.email && !isValidEmail(formData.email) 
                                        ? 'border-red-500 bg-red-50' 
                                        : 'border-[#E5E7EB]'
                                }`}
                                placeholder="Enter email address"
                                required
                                pattern="[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$"
                            />
                        </div>
                    </div>
                )}

                {currentStep === 2 && (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-[#374151] mb-2">Position</label>
                            <div className="relative">
                                <select
                                    value={formData.position}
                                    onChange={(e) => handleInputChange("position", e.target.value)}
                                    className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-[#701CC0] focus:border-transparent appearance-none bg-white"
                                >
                                    <option value="">Select position</option>
                                    {positionOptions.map(option => (
                                        <option key={option} value={option}>{option}</option>
                                    ))}
                                </select>
                                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                    <svg className="w-4 h-4 text-[#6B7280]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-[#374151] mb-2">Country</label>
                            <input
                                type="text"
                                value={formData.country}
                                onChange={(e) => handleInputChange("country", e.target.value)}
                                className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#701CC0] focus:border-transparent"
                                placeholder="Enter country"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-[#374151] mb-2">Timezone</label>
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
                                className={`w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#701CC0] focus:border-transparent ${
                                    formData.company_email && !isValidEmail(formData.company_email) 
                                        ? 'border-red-500 bg-red-50' 
                                        : 'border-[#E5E7EB]'
                                }`}
                                placeholder="Company email"
                                pattern="[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-[#374151] mb-2">Mentor</label>
                            <input
                                type="text"
                                value={formData.mentor}
                                onChange={(e) => handleInputChange("mentor", e.target.value)}
                                className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#701CC0] focus:border-transparent"
                                placeholder="Mentor name"
                            />
                        </div>
                    </div>
                )}

                {error && <div className="mt-4 text-sm text-red-600">{error}</div>}

                <div className="flex justify-between items-center mt-6">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
                    >
                        Cancel
                    </button>
                    <div className="flex gap-3">
                        {currentStep > 1 && (
                            <button
                                onClick={prevStep}
                                className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 text-[#374151] hover:bg-gray-200"
                            >
                                Previous
                            </button>
                        )}
                        {currentStep < 3 ? (
                            <button
                                onClick={nextStep}
                                disabled={!isStepValid() || !isCurrentStepEmailValid()}
                                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                                    !isStepValid() || !isCurrentStepEmailValid()
                                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                        : 'bg-[#701CC0] text-white hover:bg-[#5f17a5]'
                                }`}
                            >
                                Next
                            </button>
                        ) : (
                            <button
                                onClick={submit}
                                disabled={submitting || !isStepValid() || !hasValidEmails()}
                                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                                    submitting || !isStepValid() || !hasValidEmails()
                                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                        : 'bg-[#701CC0] text-white hover:bg-[#5f17a5]'
                                }`}
                            >
                                {submitting ? "Adding..." : "Add Staff Member"}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

// Manage Staff Modal Component
const ManageStaffModal: React.FC<{
    staff: TeamRow
    onClose: () => void
    onUpdate: (data: Partial<TeamRow>) => void
}> = ({ staff, onClose, onUpdate }) => {
    const modalRef = useRef<HTMLDivElement>(null)
    const [formData, setFormData] = useState({
        name: staff.name || "",
        email: staff.email || "",
        position: staff.position || "",
        country: staff.country || "",
        company_email: staff.company_email || "",
        mentor: staff.mentor || "",
        time_zone: staff.time_zone || "",
        strikes: staff.strikes || "0/3"
    })
    const [isSubmitting, setIsSubmitting] = useState(false)

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
                onClose()
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [onClose])

    const handleInputChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    const isValidEmail = (email: string) => {
        const emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i
        return emailRegex.test(email)
    }

    const hasValidEmails = () => {
        const mainEmailValid = formData.email ? isValidEmail(formData.email) : false
        const companyEmailValid = formData.company_email ? isValidEmail(formData.company_email) : true
        return mainEmailValid && companyEmailValid
    }

    const handleSave = async () => {
        setIsSubmitting(true)
        try {
            await onUpdate(formData)
            onClose()
        } catch (error) {
            console.error("Error updating staff:", error)
        } finally {
            setIsSubmitting(false)
        }
    }


    const positionOptions = [
        "Founder",
        "Leadership",
        "Business Advisor",
        "Developer",
        "Designer",
        "Outreach"
    ]

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-2xl mx-4" ref={modalRef}>
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                        <FiEdit3 className="w-6 h-6 text-blue-600" />
                    </div>
                    <h3 className="text-xl font-semibold text-[#111827]">Edit Staff Member</h3>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                        <label className="block text-sm font-medium text-[#374151] mb-1">Name</label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => handleInputChange('name', e.target.value)}
                            className="w-full px-3 py-2 border border-[#D1D5DB] rounded-md focus:outline-none focus:ring-2 focus:ring-[#701CC0] text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[#374151] mb-1">Email</label>
                        <input
                            type="email"
                            value={formData.email}
                            onChange={(e) => handleInputChange('email', e.target.value)}
                            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#701CC0] text-sm ${
                                formData.email && !isValidEmail(formData.email) 
                                    ? 'border-red-500 bg-red-50' 
                                    : 'border-[#D1D5DB]'
                            }`}
                            required
                            pattern="[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[#374151] mb-1">Position</label>
                        <div className="relative">
                            <select
                                value={formData.position}
                                onChange={(e) => handleInputChange('position', e.target.value)}
                                className="w-full px-3 py-2 border border-[#D1D5DB] rounded-md focus:outline-none focus:ring-2 focus:ring-[#701CC0] text-sm pr-10 appearance-none bg-white"
                            >
                                <option value="">Select Position</option>
                                {positionOptions.map(option => (
                                    <option key={option} value={option}>{option}</option>
                                ))}
                            </select>
                            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                <svg className="w-4 h-4 text-[#6B7280]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[#374151] mb-1">Country</label>
                        <input
                            type="text"
                            value={formData.country}
                            onChange={(e) => handleInputChange('country', e.target.value)}
                            className="w-full px-3 py-2 border border-[#D1D5DB] rounded-md focus:outline-none focus:ring-2 focus:ring-[#701CC0] text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[#374151] mb-1">Timezone</label>
                        <input
                            type="text"
                            value={formData.time_zone}
                            onChange={(e) => handleInputChange('time_zone', e.target.value)}
                            className="w-full px-3 py-2 border border-[#D1D5DB] rounded-md focus:outline-none focus:ring-2 focus:ring-[#701CC0] text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[#374151] mb-1">Company Email</label>
                        <input
                            type="email"
                            value={formData.company_email}
                            onChange={(e) => handleInputChange('company_email', e.target.value)}
                            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#701CC0] text-sm ${
                                formData.company_email && !isValidEmail(formData.company_email) 
                                    ? 'border-red-500 bg-red-50' 
                                    : 'border-[#D1D5DB]'
                            }`}
                            pattern="[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[#374151] mb-1">Mentor</label>
                        <input
                            type="text"
                            value={formData.mentor}
                            onChange={(e) => handleInputChange('mentor', e.target.value)}
                            className="w-full px-3 py-2 border border-[#D1D5DB] rounded-md focus:outline-none focus:ring-2 focus:ring-[#701CC0] text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[#374151] mb-1">Strikes</label>
                        <input
                            type="text"
                            value={formData.strikes}
                            onChange={(e) => handleInputChange('strikes', e.target.value)}
                            className="w-full px-3 py-2 border border-[#D1D5DB] rounded-md focus:outline-none focus:ring-2 focus:ring-[#701CC0] text-sm"
                        />
                    </div>
                </div>
                
                <div className="flex gap-3 justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg border border-[#E5E7EB] text-[#374151] hover:bg-gray-50 text-sm font-medium"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSubmitting || !hasValidEmails()}
                        className={`px-4 py-2 rounded-lg text-sm font-medium ${
                            isSubmitting || !hasValidEmails()
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'bg-[#701CC0] text-white hover:bg-[#5f17a5]'
                        }`}
                    >
                        {isSubmitting ? "Saving..." : "Save Changes"}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default TeamPanelSection;