import React, { useState, useEffect, useMemo } from "react"
import { Inter } from "next/font/google"
import Image from "next/image"
import { useSession } from "next-auth/react"
import { FiChevronLeft, FiChevronRight, FiCalendar, FiTrendingUp, FiDollarSign, FiUsers, FiTarget } from "react-icons/fi"
import { motion } from "framer-motion"

const inter = Inter({ subsets: ["latin"] })

const statFields = [
    { key: "attempts", label: "Attempts", icon: FiTarget },
    { key: "meetings", label: "Meetings Set", icon: FiCalendar },
    { key: "clients", label: "Clients Closed", icon: FiUsers },
    { key: "revenue", label: "Revenue", icon: FiDollarSign }
];

type CardKey =
    | "LinkedIn"
    | "Instagram"
    | "Facebook"
    | "ColdCall"
    | "ColdMail"
    | "ColdMessage"
    | "WalkInNetworking"
    | "AutoResponder"
    | "Other";

type StatField = "attempts" | "meetings" | "clients" | "revenue";

type StatsType = {
    [key in CardKey]: {
        attempts: number;
        meetings: number;
        clients: number;
        revenue: number;
    };
};

type YearlySummary = {
    totalAttempt: number;
    totalMeetingsSet: number;
    totalClientsLosed: number;
    totalRevenue: number;
    attemptsToMeetingsPct: number;
    meetingsToClientsPct: number;
}

const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

const outreachConfig: Record<CardKey, { color: string; icon: string }> = {
    LinkedIn: { color: "bg-blue-50 border-blue-200", icon: "/assets/Socials/LinkedIn.png" },
    Instagram: { color: "bg-pink-50 border-pink-200", icon: "/assets/Socials/Instagram.png" },
    Facebook: { color: "bg-blue-50 border-blue-200", icon: "/assets/Socials/Facebook.png" },
    ColdCall: { color: "bg-purple-50 border-purple-200", icon: "/assets/Outreach/ColdCall.png" },
    ColdMail: { color: "bg-purple-50 border-purple-200", icon: "/assets/Outreach/ColdMail.png" },
    ColdMessage: { color: "bg-purple-50 border-purple-200", icon: "/assets/Outreach/ColdMessage.png" },
    WalkInNetworking: { color: "bg-green-50 border-green-200", icon: "/assets/Outreach/WalkInNetworking.png" },
    AutoResponder: { color: "bg-green-50 border-green-200", icon: "/assets/Outreach/AutoResponder.png" },
    Other: { color: "bg-green-50 border-green-200", icon: "/assets/Outreach/Other.png" }
};

const OutreachSection = () => {
    const { data: session } = useSession()
    const [isUpdating, setIsUpdating] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [viewMode, setViewMode] = useState<"monthly" | "yearly">("monthly")
    const [yearlySummary, setYearlySummary] = useState<YearlySummary | null>(null)

    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() + 1

    const [selectedYear, setSelectedYear] = useState(currentYear)
    const [selectedMonth, setSelectedMonth] = useState(currentMonth)

    const isCurrentMonth = selectedYear === currentYear && selectedMonth === currentMonth
    const isPastDate = selectedYear < currentYear || (selectedYear === currentYear && selectedMonth < currentMonth)
    const isFutureDate = selectedYear > currentYear || (selectedYear === currentYear && selectedMonth > currentMonth)
    const isEditable = isCurrentMonth && !isFutureDate

    const [stats, setStats] = useState<StatsType>({
        LinkedIn: { attempts: 0, meetings: 0, clients: 0, revenue: 0 },
        Instagram: { attempts: 0, meetings: 0, clients: 0, revenue: 0 },
        Facebook: { attempts: 0, meetings: 0, clients: 0, revenue: 0 },
        ColdCall: { attempts: 0, meetings: 0, clients: 0, revenue: 0 },
        ColdMail: { attempts: 0, meetings: 0, clients: 0, revenue: 0 },
        ColdMessage: { attempts: 0, meetings: 0, clients: 0, revenue: 0 },
        WalkInNetworking: { attempts: 0, meetings: 0, clients: 0, revenue: 0 },
        AutoResponder: { attempts: 0, meetings: 0, clients: 0, revenue: 0 },
        Other: { attempts: 0, meetings: 0, clients: 0, revenue: 0 }
    });

    function calculatePercentage(numerator: number, denominator: number) {
        if (!denominator) return 0
        return Math.round((numerator / denominator) * 100 * 100) / 100
    }

    function handleStatChange(card: CardKey, field: StatField, value: string) {
        if (!isEditable) return
        setStats(prev => ({
            ...prev,
            [card]: {
                ...prev[card],
                [field]: field === "revenue" ? Number(value.replace(/,/g, '')) || 0 : parseInt(value.replace(/,/g, '')) || 0
            }
        }));
    }

    function getInputValue(val: number) {
        return val === 0 ? "" : val.toLocaleString();
    }

    function formatNumber(num: number) {
        return num.toLocaleString();
    }

    function formatCurrency(num: number) {
        return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    const summary = useMemo(() => Object.values(stats).reduce(
        (acc, curr) => {
            acc.attempts += curr.attempts;
            acc.meetings += curr.meetings;
            acc.clients += curr.clients;
            acc.revenue += curr.revenue;
            return acc;
        },
        { attempts: 0, meetings: 0, clients: 0, revenue: 0 }
    ), [stats]);

    const handleUpdate = async () => {
        if (!session?.user || !isEditable) return;
        setIsUpdating(true);
        try {
            const outreachMap: Record<CardKey, string> = {
                LinkedIn: "linkedin",
                Instagram: "instagram", 
                Facebook: "facebook",
                ColdCall: "coldcall",
                ColdMail: "coldmail",
                ColdMessage: "coldmessage",
                WalkInNetworking: "walkinnetworking",
                AutoResponder: "autoresponder",
                Other: "other"
            };
            const trackerData = Object.entries(stats).map(([cardKey, data]) => ({
                outreach: outreachMap[cardKey as CardKey],
                attempt: data.attempts,
                meetingsSet: data.meetings,
                clientsClosed: data.clients,
                revenue: data.revenue,
                attemptsToMeetingsPct: calculatePercentage(data.meetings, data.attempts),
                meetingsToClientsPct: calculatePercentage(data.clients, data.meetings)
            }));
            const response = await fetch("/api/marketing/tracker", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    year: selectedYear,
                    month: selectedMonth,
                    trackerData
                })
            });
            if (!response.ok) {
                throw new Error("Failed to update marketing data");
            }
            // Show success message
            const successModal = document.createElement('div')
            successModal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm'
            successModal.innerHTML = `
                <div class="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
                    <div class="flex flex-col items-center text-center">
                        <div class="relative mb-4 inline-flex h-16 w-16 items-center justify-center">
                            <span class="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-30 animate-ping"></span>
                            <span class="relative inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                                <span class="flex h-10 w-10 items-center justify-center rounded-full bg-green-500 text-white">
                                    <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path>
                                    </svg>
                                </span>
                            </span>
                        </div>
                        <h3 class="text-xl font-semibold text-[#111827] mb-2">Data Updated Successfully!</h3>
                        <p class="text-sm text-[#6B7280] mb-6">Your marketing tracker data has been saved.</p>
                        <button onclick="this.closest('.fixed').remove()" class="w-full rounded-lg px-4 py-2 bg-[#701CC0] text-white hover:bg-[#5f17a5] text-sm font-medium transition-colors">
                            Done
                        </button>
                    </div>
                </div>
            `
            document.body.appendChild(successModal)
            setTimeout(() => successModal.remove(), 3000)
        } catch (error) {
            console.error("Error updating marketing data:", error);
            alert("Failed to update marketing data. Please try again.");
        } finally {
            setIsUpdating(false);
        }
    };

    const fetchMonthlyData = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`/api/marketing/tracker?year=${selectedYear}&month=${selectedMonth}`);
            if (!response.ok) throw new Error("Failed to fetch stats");
            const data = await response.json();
            const outreachMap: Record<string, CardKey> = {
                linkedin: "LinkedIn",
                instagram: "Instagram",
                facebook: "Facebook",
                coldcall: "ColdCall",
                coldmail: "ColdMail",
                coldmessage: "ColdMessage",
                walkinnetworking: "WalkInNetworking",
                autoresponder: "AutoResponder",
                other: "Other"
            };
            const newStats: StatsType = {
                LinkedIn: { attempts: 0, meetings: 0, clients: 0, revenue: 0 },
                Instagram: { attempts: 0, meetings: 0, clients: 0, revenue: 0 },
                Facebook: { attempts: 0, meetings: 0, clients: 0, revenue: 0 },
                ColdCall: { attempts: 0, meetings: 0, clients: 0, revenue: 0 },
                ColdMail: { attempts: 0, meetings: 0, clients: 0, revenue: 0 },
                ColdMessage: { attempts: 0, meetings: 0, clients: 0, revenue: 0 },
                WalkInNetworking: { attempts: 0, meetings: 0, clients: 0, revenue: 0 },
                AutoResponder: { attempts: 0, meetings: 0, clients: 0, revenue: 0 },
                Other: { attempts: 0, meetings: 0, clients: 0, revenue: 0 }
            };
            if (Array.isArray(data.trackerData)) {
                data.trackerData.forEach((item: any) => {
                    const key = outreachMap[item.outreach];
                    if (key) {
                        newStats[key] = {
                            attempts: item.attempt ?? 0,
                            meetings: item.meetingsSet ?? 0,
                            clients: item.clientsClosed ?? 0,
                            revenue: item.revenue ?? 0
                        };
                    }
                });
            }
            setStats(newStats);
        } catch {
            // Error handling
        } finally {
            setIsLoading(false);
        }
    };

    const fetchYearlySummary = async () => {
        setIsLoading(true);
        try {
            // Calculate yearly summary from all months
            const monthlyData: StatsType[] = []
            for (let month = 1; month <= 12; month++) {
                const response = await fetch(`/api/marketing/tracker?year=${selectedYear}&month=${month}`);
                if (response.ok) {
                    const data = await response.json();
                    const outreachMap: Record<string, CardKey> = {
                        linkedin: "LinkedIn", instagram: "Instagram", facebook: "Facebook",
                        coldcall: "ColdCall", coldmail: "ColdMail", coldmessage: "ColdMessage",
                        walkinnetworking: "WalkInNetworking", autoresponder: "AutoResponder", other: "Other"
                    };
                    const monthStats: StatsType = {
                        LinkedIn: { attempts: 0, meetings: 0, clients: 0, revenue: 0 },
                        Instagram: { attempts: 0, meetings: 0, clients: 0, revenue: 0 },
                        Facebook: { attempts: 0, meetings: 0, clients: 0, revenue: 0 },
                        ColdCall: { attempts: 0, meetings: 0, clients: 0, revenue: 0 },
                        ColdMail: { attempts: 0, meetings: 0, clients: 0, revenue: 0 },
                        ColdMessage: { attempts: 0, meetings: 0, clients: 0, revenue: 0 },
                        WalkInNetworking: { attempts: 0, meetings: 0, clients: 0, revenue: 0 },
                        AutoResponder: { attempts: 0, meetings: 0, clients: 0, revenue: 0 },
                        Other: { attempts: 0, meetings: 0, clients: 0, revenue: 0 }
                    };
                    if (Array.isArray(data.trackerData)) {
                        data.trackerData.forEach((item: any) => {
                            const key = outreachMap[item.outreach];
                            if (key) {
                                monthStats[key] = {
                                    attempts: item.attempt ?? 0,
                                    meetings: item.meetingsSet ?? 0,
                                    clients: item.clientsClosed ?? 0,
                                    revenue: item.revenue ?? 0
                                };
                            }
                        });
                    }
                    monthlyData.push(monthStats)
                }
            }
            
            const yearly = monthlyData.reduce((acc, month) => {
                Object.values(month).forEach(channel => {
                    acc.totalAttempt += channel.attempts
                    acc.totalMeetingsSet += channel.meetings
                    acc.totalClientsLosed += channel.clients
                    acc.totalRevenue += channel.revenue
                })
                return acc
            }, { totalAttempt: 0, totalMeetingsSet: 0, totalClientsLosed: 0, totalRevenue: 0 })

            setYearlySummary({
                ...yearly,
                attemptsToMeetingsPct: calculatePercentage(yearly.totalMeetingsSet, yearly.totalAttempt),
                meetingsToClientsPct: calculatePercentage(yearly.totalClientsLosed, yearly.totalMeetingsSet)
            })
        } catch {
            // Error handling
        } finally {
            setIsLoading(false);
        }
    };
    
    useEffect(() => {
        if (viewMode === "monthly") {
            fetchMonthlyData();
        } else {
            fetchYearlySummary();
        }
    }, [selectedYear, selectedMonth, viewMode]);

    const navigateMonth = (direction: "prev" | "next") => {
        if (direction === "prev") {
            if (selectedMonth === 1) {
                setSelectedMonth(12);
                setSelectedYear(selectedYear - 1);
            } else {
                setSelectedMonth(selectedMonth - 1);
            }
        } else {
            if (selectedMonth === 12) {
                setSelectedMonth(1);
                setSelectedYear(selectedYear + 1);
            } else {
                setSelectedMonth(selectedMonth + 1);
            }
        }
    };

    const canNavigatePrev = selectedYear > 2020 || (selectedYear === 2020 && selectedMonth > 1)
    const canNavigateNext = !isFutureDate && (selectedYear < currentYear || (selectedYear === currentYear && selectedMonth < currentMonth))

    const renderOutreachCard = (cardKey: CardKey) => {
        const config = outreachConfig[cardKey]
        const cardStats = stats[cardKey]
        
        return (
            <motion.div
                key={cardKey}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className={`bg-white rounded-xl shadow-sm border-2 ${config.color} overflow-hidden hover:shadow-md transition-shadow`}
            >
                <div className={`${config.color} px-4 py-3 border-b-2 ${config.color.split(' ')[1]}`}>
                    <h3 className="font-semibold text-[#111827] flex items-center gap-2">
                        <Image src={config.icon} alt={cardKey} width={20} height={20} className="w-5 h-5" />
                        {cardKey.replace(/([A-Z])/g, ' $1').trim()}
                    </h3>
                </div>
                <div className="p-5">
                    <div className="space-y-4">
                        {statFields.map(field => {
                            const Icon = field.icon
                            return (
                                <div key={field.key} className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Icon className="w-4 h-4 text-[#6B7280]" />
                                        <span className="text-sm text-[#6B7280]">{field.label}</span>
                                    </div>
                                    <input
                                        type="text"
                                        className={`text-sm font-semibold text-[#111827] w-24 bg-transparent border-b-2 ${isEditable ? 'border-[#701CC0] focus:border-[#5f17a5]' : 'border-gray-200'} focus:outline-none text-right transition-colors ${!isEditable ? 'cursor-not-allowed opacity-60' : ''}`}
                                        value={getInputValue(cardStats[field.key as keyof typeof cardStats] as number)}
                                        onChange={e => {
                                            const value = e.target.value.replace(/,/g, '');
                                            handleStatChange(cardKey, field.key as StatField, value);
                                        }}
                                        placeholder="0"
                                        disabled={!isEditable || isUpdating}
                                        readOnly={!isEditable}
                                    />
                                </div>
                            )
                        })}
                        <div className="pt-3 border-t border-gray-200 space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-[#6B7280]">Attempts → Meetings</span>
                                <span className="text-sm font-semibold text-[#701CC0]">
                                    {calculatePercentage(cardStats.meetings, cardStats.attempts)}%
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-[#6B7280]">Meetings → Clients</span>
                                <span className="text-sm font-semibold text-[#701CC0]">
                                    {calculatePercentage(cardStats.clients, cardStats.meetings)}%
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>
        )
    }

    return (
        <div className="w-full h-full bg-white text-[#111014] flex flex-col overflow-auto">
            <div className="flex-1 flex justify-center px-6 pt-2">
                <div className="w-full max-w-6xl flex flex-col h-full">
                    {/* Header */}
                    <div className="w-full flex justify-between items-center mb-2">
                        <div>
                            <h1 className="text-2xl font-semibold text-[#111827] mt-6 mb-6">Marketing Tracker</h1>
                        </div>
                        <div className="flex items-center gap-3">
                            {/* View Mode Toggle */}
                            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                                <button
                                    onClick={() => setViewMode("monthly")}
                                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                                        viewMode === "monthly"
                                            ? "bg-white text-[#701CC0] shadow-sm"
                                            : "text-gray-600 hover:text-gray-900"
                                    }`}
                                >
                                    Monthly
                                </button>
                                <button
                                    onClick={() => setViewMode("yearly")}
                                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                                        viewMode === "yearly"
                                            ? "bg-white text-[#701CC0] shadow-sm"
                                            : "text-gray-600 hover:text-gray-900"
                                    }`}
                                >
                                    Yearly
                                </button>
                            </div>

                            {viewMode === "monthly" ? (
                                <>
                                    {/* Month Navigation */}
                                    <div className="flex items-center gap-2 bg-white rounded-lg border border-[#E5E7EB] shadow-sm">
                                        <button
                                            onClick={() => navigateMonth("prev")}
                                            disabled={!canNavigatePrev}
                                            className="p-2 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors rounded-l-lg"
                                        >
                                            <FiChevronLeft className="w-4 h-4 text-[#6B7280]" />
                                        </button>
                                        <div className="px-4 py-2 text-sm font-medium text-[#111827] min-w-[140px] text-center">
                                            {months[selectedMonth - 1]} {selectedYear}
                                        </div>
                                        <button
                                            onClick={() => navigateMonth("next")}
                                            disabled={!canNavigateNext}
                                            className="p-2 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors rounded-r-lg"
                                        >
                                            <FiChevronRight className="w-4 h-4 text-[#6B7280]" />
                                        </button>
                                    </div>

                                    {/* Update Button */}
                                    {isEditable && (
                                        <button
                                            className="inline-flex items-center gap-2 px-4 py-2 bg-[#701CC0] text-white rounded-lg hover:bg-[#5f17a5] text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            disabled={isUpdating}
                                            onClick={handleUpdate}
                                        >
                                            {isUpdating ? "Updating..." : "Update"}
                                        </button>
                                    )}
                                </>
                            ) : (
                                <div className="flex items-center gap-2 bg-white rounded-lg border border-[#E5E7EB] shadow-sm">
                                    <button
                                        onClick={() => setSelectedYear(selectedYear - 1)}
                                        disabled={selectedYear <= 2020}
                                        className="p-2 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors rounded-l-lg"
                                    >
                                        <FiChevronLeft className="w-4 h-4 text-[#6B7280]" />
                                    </button>
                                    <div className="px-4 py-2 text-sm font-medium text-[#111827] min-w-[100px] text-center">
                                        {selectedYear}
                                    </div>
                                    <button
                                        onClick={() => setSelectedYear(selectedYear + 1)}
                                        disabled={selectedYear >= currentYear}
                                        className="p-2 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors rounded-r-lg"
                                    >
                                        <FiChevronRight className="w-4 h-4 text-[#6B7280]" />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="text-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#701CC0] mx-auto"></div>
                                <p className="mt-2 text-sm text-[#6B7280]">Loading data...</p>
                            </div>
                        </div>
                    ) : viewMode === "yearly" ? (
                        /* Yearly Summary View */
                        <div className="pb-32">
                            <div className="bg-gradient-to-br from-[#701CC0] to-[#5f17a5] rounded-xl shadow-lg p-8 mb-6 text-white">
                                <h2 className="text-2xl font-bold mb-2">{selectedYear} Year Summary</h2>
                                <p className="text-white/80 text-sm">Complete overview of all marketing activities</p>
                            </div>

                            {yearlySummary ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                                    <div className="bg-white rounded-lg shadow-sm border border-[#E5E7EB] p-6">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="p-2 bg-blue-100 rounded-lg">
                                                <FiTarget className="w-5 h-5 text-blue-600" />
                                            </div>
                                            <div>
                                                <p className="text-xs text-[#6B7280]">Total Attempts</p>
                                                <p className="text-2xl font-bold text-[#111827]">{formatNumber(yearlySummary.totalAttempt)}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-white rounded-lg shadow-sm border border-[#E5E7EB] p-6">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="p-2 bg-green-100 rounded-lg">
                                                <FiCalendar className="w-5 h-5 text-green-600" />
                                            </div>
                                            <div>
                                                <p className="text-xs text-[#6B7280]">Total Meetings</p>
                                                <p className="text-2xl font-bold text-[#111827]">{formatNumber(yearlySummary.totalMeetingsSet)}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-white rounded-lg shadow-sm border border-[#E5E7EB] p-6">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="p-2 bg-purple-100 rounded-lg">
                                                <FiUsers className="w-5 h-5 text-purple-600" />
                                            </div>
                                            <div>
                                                <p className="text-xs text-[#6B7280]">Clients Closed</p>
                                                <p className="text-2xl font-bold text-[#111827]">{formatNumber(yearlySummary.totalClientsLosed)}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-white rounded-lg shadow-sm border border-[#E5E7EB] p-6">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="p-2 bg-yellow-100 rounded-lg">
                                                <FiDollarSign className="w-5 h-5 text-yellow-600" />
                                            </div>
                                            <div>
                                                <p className="text-xs text-[#6B7280]">Total Revenue</p>
                                                <p className="text-2xl font-bold text-[#111827]">{formatCurrency(yearlySummary.totalRevenue)}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-12 text-gray-500">No data available for {selectedYear}</div>
                            )}

                            {yearlySummary && (
                                <div className="bg-white rounded-lg shadow-sm border border-[#E5E7EB] p-6">
                                    <h3 className="text-lg font-semibold text-[#111827] mb-4">Conversion Rates</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-sm text-[#6B7280]">Attempts to Meetings</span>
                                                <span className="text-lg font-bold text-[#701CC0]">{yearlySummary.attemptsToMeetingsPct}%</span>
                                            </div>
                                            <div className="w-full bg-gray-200 rounded-full h-2">
                                                <div 
                                                    className="bg-[#701CC0] h-2 rounded-full transition-all"
                                                    style={{ width: `${Math.min(yearlySummary.attemptsToMeetingsPct, 100)}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                        <div>
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-sm text-[#6B7280]">Meetings to Clients</span>
                                                <span className="text-lg font-bold text-[#701CC0]">{yearlySummary.meetingsToClientsPct}%</span>
                                            </div>
                                            <div className="w-full bg-gray-200 rounded-full h-2">
                                                <div 
                                                    className="bg-[#701CC0] h-2 rounded-full transition-all"
                                                    style={{ width: `${Math.min(yearlySummary.meetingsToClientsPct, 100)}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        /* Monthly View */
                        <div className="pb-32">
                            {!isEditable && (
                                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                    <p className="text-sm text-yellow-800">
                                        {isPastDate ? "Viewing past data - read only" : "Future months cannot be edited"}
                                    </p>
                                </div>
                            )}

                            {/* Outreach Cards Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                                {Object.keys(outreachConfig).map(key => renderOutreachCard(key as CardKey))}
                            </div>

                            {/* Monthly Summary */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3, delay: 0.2 }}
                                className="bg-gradient-to-br from-[#701CC0] to-[#5f17a5] rounded-xl shadow-lg p-8 text-white"
                            >
                                <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                                    <FiTrendingUp className="w-5 h-5" />
                                    Monthly Summary - {months[selectedMonth - 1]} {selectedYear}
                                </h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                    <div>
                                        <p className="text-white/80 text-sm mb-1">Total Attempts</p>
                                        <p className="text-3xl font-bold">{formatNumber(summary.attempts)}</p>
                                    </div>
                                    <div>
                                        <p className="text-white/80 text-sm mb-1">Meetings Set</p>
                                        <p className="text-3xl font-bold">{formatNumber(summary.meetings)}</p>
                                    </div>
                                    <div>
                                        <p className="text-white/80 text-sm mb-1">Clients Closed</p>
                                        <p className="text-3xl font-bold">{formatNumber(summary.clients)}</p>
                                    </div>
                                    <div>
                                        <p className="text-white/80 text-sm mb-1">Revenue</p>
                                        <p className="text-3xl font-bold">{formatCurrency(summary.revenue)}</p>
                                    </div>
                                </div>
                                <div className="mt-6 pt-6 border-t border-white/20 grid grid-cols-2 gap-6">
                                    <div>
                                        <p className="text-white/80 text-sm mb-1">Attempts → Meetings</p>
                                        <p className="text-2xl font-bold">{calculatePercentage(summary.meetings, summary.attempts)}%</p>
                                    </div>
                                    <div>
                                        <p className="text-white/80 text-sm mb-1">Meetings → Clients</p>
                                        <p className="text-2xl font-bold">{calculatePercentage(summary.clients, summary.meetings)}%</p>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default OutreachSection;
